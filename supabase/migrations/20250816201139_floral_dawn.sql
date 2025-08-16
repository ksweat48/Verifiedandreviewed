/*
  # Service-First Search Schema - Safe Migration

  1. New Tables
    - `offerings` - Core service/dish/item data linked to businesses
    - `offering_images` - Image management with auto-approval system  
    - `offerings_embeddings` - Vector embeddings for semantic search

  2. Security
    - Enable RLS on all new tables
    - Business owners can manage their offerings
    - Public can read active offerings and approved images
    - Service role can manage embeddings

  3. Performance
    - Optimized indexes for business lookup and vector search
    - pgvector extension for efficient KNN operations
*/

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create offerings table
CREATE TABLE IF NOT EXISTS public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  service_type text DEFAULT 'onsite' CHECK (service_type IN ('onsite', 'mobile', 'remote', 'delivery')),
  price_cents integer,
  currency text DEFAULT 'USD',
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offering_images table
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

-- Create offerings_embeddings table
CREATE TABLE IF NOT EXISTS public.offerings_embeddings (
  offering_id uuid PRIMARY KEY REFERENCES public.offerings(id) ON DELETE CASCADE,
  embedding vector(1536),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_offerings_business ON public.offerings(business_id);
CREATE INDEX IF NOT EXISTS idx_offerings_status ON public.offerings(status);
CREATE INDEX IF NOT EXISTS idx_offering_images_offering ON public.offering_images(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_images_primary_approved ON public.offering_images(is_primary, approved);

-- Enable RLS on all tables
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offering_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings_embeddings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public can read active offerings" ON public.offerings;
DROP POLICY IF EXISTS "Business owners can manage their offerings" ON public.offerings;
DROP POLICY IF EXISTS "Public can read approved offering images" ON public.offering_images;
DROP POLICY IF EXISTS "Business owners can manage their offering images" ON public.offering_images;
DROP POLICY IF EXISTS "Service role can read all offering embeddings" ON public.offerings_embeddings;
DROP POLICY IF EXISTS "Business owners can manage their offering embeddings" ON public.offerings_embeddings;

-- Create RLS policies for offerings
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

-- Create RLS policies for offering_images
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
      ) AND user_businesses.role = 'owner'
    )
  );

-- Create RLS policies for offerings_embeddings
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
      ) AND user_businesses.role = 'owner'
    )
  );

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_offerings_updated_at ON public.offerings;
CREATE TRIGGER update_offerings_updated_at
  BEFORE UPDATE ON public.offerings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_offerings_embeddings_updated_at ON public.offerings_embeddings;
CREATE TRIGGER update_offerings_embeddings_updated_at
  BEFORE UPDATE ON public.offerings_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();