/*
  # Create offerings schema for dish/item/service search

  1. New Tables
    - `offerings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `title` (text, not null)
      - `description` (text)
      - `tags` (text array)
      - `price_cents` (integer)
      - `currency` (text, default 'USD')
      - `status` (text, default 'active')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `offering_images`
      - `id` (uuid, primary key)
      - `offering_id` (uuid, foreign key to offerings)
      - `source` (text, not null - upload|website|google_places|social)
      - `url` (text, not null)
      - `width` (integer)
      - `height` (integer)
      - `license` (text)
      - `is_primary` (boolean, default false)
      - `approved` (boolean, default false)
      - `created_at` (timestamptz)
    
    - `offerings_embeddings`
      - `offering_id` (uuid, primary key, foreign key to offerings)
      - `embedding` (vector(1536))
      - `updated_at` (timestamptz)

  2. Extensions
    - Enable `vector` extension for semantic search

  3. Indexes
    - Performance indexes for offerings, images, and embeddings

  4. Security
    - Enable RLS on all new tables
    - Add policies for public read access to active offerings
    - Add policies for authenticated users to manage their business offerings
*/

-- Enable vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create offerings table for menu items, products, or services
CREATE TABLE IF NOT EXISTS public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  price_cents int,
  currency text DEFAULT 'USD',
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offering images table
CREATE TABLE IF NOT EXISTS public.offering_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('upload', 'website', 'google_places', 'social')),
  url text NOT NULL,
  width int,
  height int,
  license text,
  is_primary boolean DEFAULT false,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create offerings embeddings table for semantic search
CREATE TABLE IF NOT EXISTS public.offerings_embeddings (
  offering_id uuid PRIMARY KEY REFERENCES public.offerings(id) ON DELETE CASCADE,
  embedding vector(1536),
  updated_at timestamptz DEFAULT now()
);

-- Create helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_offerings_business ON public.offerings(business_id);
CREATE INDEX IF NOT EXISTS idx_offerings_status ON public.offerings(status);
CREATE INDEX IF NOT EXISTS idx_offerings_tags ON public.offerings USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_offering_images_offering ON public.offering_images(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_images_primary_approved ON public.offering_images(is_primary, approved);
CREATE INDEX IF NOT EXISTS idx_offerings_embeddings_vector ON public.offerings_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offering_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offerings table
CREATE POLICY "Public can read active offerings"
  ON public.offerings
  FOR SELECT
  TO public
  USING (status = 'active');

CREATE POLICY "Authenticated users can create offerings for their businesses"
  ON public.offerings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_businesses.user_id
      FROM user_businesses
      WHERE user_businesses.business_id = offerings.business_id
    )
  );

CREATE POLICY "Authenticated users can update their business offerings"
  ON public.offerings
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_businesses.user_id
      FROM user_businesses
      WHERE user_businesses.business_id = offerings.business_id
    )
  );

CREATE POLICY "Authenticated users can delete their business offerings"
  ON public.offerings
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_businesses.user_id
      FROM user_businesses
      WHERE user_businesses.business_id = offerings.business_id
    )
  );

-- RLS Policies for offering_images table
CREATE POLICY "Public can read approved offering images"
  ON public.offering_images
  FOR SELECT
  TO public
  USING (approved = true);

CREATE POLICY "Authenticated users can manage images for their business offerings"
  ON public.offering_images
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_businesses.user_id
      FROM user_businesses
      JOIN offerings ON offerings.business_id = user_businesses.business_id
      WHERE offerings.id = offering_images.offering_id
    )
  );

-- RLS Policies for offerings_embeddings table
CREATE POLICY "Public can read offering embeddings"
  ON public.offerings_embeddings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can manage offering embeddings"
  ON public.offerings_embeddings
  FOR ALL
  TO service_role
  USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_offerings_updated_at
  BEFORE UPDATE ON public.offerings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offerings_embeddings_updated_at
  BEFORE UPDATE ON public.offerings_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();