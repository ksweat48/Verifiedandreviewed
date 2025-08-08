/*
  # Create offerings schema for dish/item/service search

  1. New Tables
    - `offerings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `title` (text, required)
      - `description` (text, optional)
      - `tags` (text array)
      - `price_cents` (integer for precise pricing)
      - `currency` (text, default USD)
      - `status` (text, default active)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `offering_images`
      - `id` (uuid, primary key)
      - `offering_id` (uuid, foreign key to offerings)
      - `source` (text, tracks image source)
      - `url` (text, image URL)
      - `width` (integer)
      - `height` (integer)
      - `license` (text, for permissions)
      - `is_primary` (boolean)
      - `approved` (boolean)
      - `created_at` (timestamptz)
    - `offerings_embeddings`
      - `offering_id` (uuid, primary key, foreign key to offerings)
      - `embedding` (vector 1536 dimensions)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on all new tables
    - Public can read active offerings and approved images
    - Business owners can manage their own offerings
    - Service role can manage embeddings for AI processing
  3. Performance
    - Indexes for business_id, status, tags, and image queries
    - Vector index for semantic search on embeddings
    - Automatic updated_at triggers
*/

-- Drop tables in reverse dependency order to allow clean re-creation
DROP TABLE IF EXISTS public.offering_images CASCADE;
DROP TABLE IF EXISTS public.offerings_embeddings CASCADE;
DROP TABLE IF EXISTS public.offerings CASCADE;

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- offerings: menu items, products, or services
CREATE TABLE IF NOT EXISTS public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  price_cents int,
  currency text DEFAULT 'USD',
  status text DEFAULT 'active', -- active|inactive
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- images associated to an offering
CREATE TABLE IF NOT EXISTS public.offering_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
  source text NOT NULL, -- upload|website|google_places|social
  url text NOT NULL,
  width int,
  height int,
  license text, -- store license/permission info
  is_primary boolean DEFAULT FALSE,
  approved boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT now()
);

-- embeddings for semantic search
CREATE TABLE IF NOT EXISTS public.offerings_embeddings (
  offering_id uuid PRIMARY KEY REFERENCES public.offerings(id) ON DELETE CASCADE,
  embedding vector(1536), -- adjust to your embedding model dimension
  updated_at timestamptz DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_offerings_business ON public.offerings(business_id);
CREATE INDEX IF NOT EXISTS idx_offering_images_offering ON public.offering_images(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_images_primary_approved ON public.offering_images(is_primary, approved);
CREATE INDEX IF NOT EXISTS idx_offerings_status ON public.offerings(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offering_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offerings
CREATE POLICY "Public can read active offerings" ON public.offerings
  FOR SELECT USING (status = 'active');

CREATE POLICY "Business owners can manage their offerings" ON public.offerings
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_businesses WHERE business_id = offerings.business_id AND role = 'owner'));

-- RLS Policies for offering_images
CREATE POLICY "Public can read approved offering images" ON public.offering_images
  FOR SELECT USING (approved = TRUE);

CREATE POLICY "Business owners can manage their offering images" ON public.offering_images
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_businesses WHERE business_id = (SELECT business_id FROM public.offerings WHERE id = offering_id) AND role = 'owner'));

-- RLS Policies for offerings_embeddings
CREATE POLICY "Business owners can manage their offering embeddings" ON public.offerings_embeddings
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.user_businesses WHERE business_id = (SELECT business_id FROM public.offerings WHERE id = offering_id) AND role = 'owner'));

CREATE POLICY "Service role can read all offering embeddings" ON public.offerings_embeddings
  FOR SELECT TO service_role USING (TRUE);

-- Triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_offerings_updated_at
BEFORE UPDATE ON public.offerings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_offerings_embeddings_updated_at
BEFORE UPDATE ON public.offerings_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();