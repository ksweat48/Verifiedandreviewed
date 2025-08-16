/*
  # Service-First Search Schema

  1. New Tables
    - `offerings` - Individual dishes/items/services tied to businesses
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `title` (text, service/dish name)
      - `description` (text, detailed description)
      - `tags` (text array, searchable keywords)
      - `service_type` (text, onsite|mobile|remote|delivery)
      - `price_cents` (integer, price in cents)
      - `currency` (text, default USD)
      - `status` (text, active|inactive)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `offering_images` - Images for offerings
      - `id` (uuid, primary key)
      - `offering_id` (uuid, foreign key to offerings)
      - `source` (text, platform|google_places|website|social)
      - `url` (text, image URL)
      - `width` (integer, image width)
      - `height` (integer, image height)
      - `license` (text, usage license info)
      - `is_primary` (boolean, primary display image)
      - `approved` (boolean, safety check passed)
      - `created_at` (timestamptz)
    
    - `offerings_embeddings` - Vector embeddings for semantic search
      - `offering_id` (uuid, primary key, foreign key to offerings)
      - `embedding` (vector(1536), OpenAI embedding)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Add policies for business owners to manage their offerings
    - Add policies for public to read approved offerings
    - Add policies for service role to manage embeddings

  3. Indexes
    - Business lookup index on offerings
    - Primary/approved image index on offering_images
    - Status index on offerings for active filtering
    - Vector index on offerings_embeddings for KNN search

  4. Triggers
    - Auto-update updated_at timestamps
*/

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Offerings table - individual dishes/items/services
CREATE TABLE IF NOT EXISTS public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  service_type text DEFAULT 'onsite' CHECK (service_type IN ('onsite', 'mobile', 'remote', 'delivery')),
  price_cents integer,
  currency text DEFAULT 'USD',
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Offering images table
CREATE TABLE IF NOT EXISTS public.offering_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('platform', 'google_places', 'website', 'social')),
  url text NOT NULL,
  width integer,
  height integer,
  license text,
  is_primary boolean DEFAULT false,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Offerings embeddings table for semantic search
CREATE TABLE IF NOT EXISTS public.offerings_embeddings (
  offering_id uuid PRIMARY KEY REFERENCES public.offerings(id) ON DELETE CASCADE,
  embedding vector(1536),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_offerings_business ON public.offerings(business_id);
CREATE INDEX IF NOT EXISTS idx_offerings_status ON public.offerings(status);
CREATE INDEX IF NOT EXISTS idx_offering_images_offering ON public.offering_images(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_images_primary_approved ON public.offering_images(is_primary, approved);

-- Enable Row Level Security
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offering_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offerings
CREATE POLICY "Public can read active offerings"
  ON public.offerings
  FOR SELECT
  TO public
  USING (status = 'active');

CREATE POLICY "Business owners can manage their offerings"
  ON public.offerings
  FOR ALL
  TO public
  USING (
    auth.uid() IN (
      SELECT user_businesses.user_id
      FROM user_businesses
      WHERE user_businesses.business_id = offerings.business_id
        AND user_businesses.role = 'owner'
    )
  );

-- RLS Policies for offering images
CREATE POLICY "Public can read approved offering images"
  ON public.offering_images
  FOR SELECT
  TO public
  USING (approved = true);

CREATE POLICY "Business owners can manage their offering images"
  ON public.offering_images
  FOR ALL
  TO public
  USING (
    auth.uid() IN (
      SELECT user_businesses.user_id
      FROM user_businesses
      WHERE user_businesses.business_id = (
        SELECT offerings.business_id
        FROM offerings
        WHERE offerings.id = offering_images.offering_id
      )
        AND user_businesses.role = 'owner'
    )
  );

-- RLS Policies for offerings embeddings
CREATE POLICY "Service role can read all offering embeddings"
  ON public.offerings_embeddings
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Business owners can manage their offering embeddings"
  ON public.offerings_embeddings
  FOR ALL
  TO public
  USING (
    auth.uid() IN (
      SELECT user_businesses.user_id
      FROM user_businesses
      WHERE user_businesses.business_id = (
        SELECT offerings.business_id
        FROM offerings
        WHERE offerings.id = offerings_embeddings.offering_id
      )
        AND user_businesses.role = 'owner'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_offerings_updated_at
  BEFORE UPDATE ON public.offerings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offerings_embeddings_updated_at
  BEFORE UPDATE ON public.offerings_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();