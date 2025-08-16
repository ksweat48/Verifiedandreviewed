/*
  # Safe Offerings Schema Implementation

  This migration safely implements the service-first search schema with complete conflict resolution.

  ## What this migration does:
  1. Safely creates offerings table for services/dishes/items
  2. Creates offering_images table for multi-source image management  
  3. Creates offerings_embeddings table for vector search
  4. Sets up all necessary indexes for performance
  5. Implements Row Level Security policies
  6. Creates trigger functions for automatic timestamps
  7. Handles all potential conflicts from previous migration attempts

  ## Tables Created:
  - `offerings`: Core service/dish/item data linked to businesses
  - `offering_images`: Image management with source tracking and approval
  - `offerings_embeddings`: Vector embeddings for semantic search

  ## Security:
  - RLS enabled on all tables
  - Business owners can manage their offerings
  - Public can read active offerings and approved images
  - Service role can manage embeddings for batch operations
*/

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can read active offerings" ON public.offerings;
DROP POLICY IF EXISTS "Business owners can manage their offerings" ON public.offerings;
DROP POLICY IF EXISTS "Public can read approved offering images" ON public.offering_images;
DROP POLICY IF EXISTS "Business owners can manage their offering images" ON public.offering_images;
DROP POLICY IF EXISTS "Service role can read all offering embeddings" ON public.offerings_embeddings;
DROP POLICY IF EXISTS "Business owners can manage their offering embeddings" ON public.offerings_embeddings;

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS update_offerings_updated_at ON public.offerings;
DROP TRIGGER IF EXISTS update_offerings_embeddings_updated_at ON public.offerings_embeddings;

-- Drop existing indexes to avoid conflicts
DROP INDEX IF EXISTS idx_offerings_business;
DROP INDEX IF EXISTS idx_offerings_status;
DROP INDEX IF EXISTS idx_offering_images_offering;
DROP INDEX IF EXISTS idx_offering_images_primary_approved;

-- Create offerings table
CREATE TABLE IF NOT EXISTS public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  price_cents integer,
  currency text DEFAULT 'USD',
  service_type text DEFAULT 'onsite' CHECK (service_type IN ('onsite', 'mobile', 'remote', 'delivery')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offering_images table
CREATE TABLE IF NOT EXISTS public.offering_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('platform', 'google_places', 'website', 'social_media')),
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

-- Enable Row Level Security
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offering_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings_embeddings ENABLE ROW LEVEL SECURITY;

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
      )
      AND user_businesses.role = 'owner'
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
      )
      AND user_businesses.role = 'owner'
    )
  );

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_offerings_updated_at
  BEFORE UPDATE ON public.offerings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offerings_embeddings_updated_at
  BEFORE UPDATE ON public.offerings_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-approve platform images (images uploaded directly to the platform)
CREATE OR REPLACE FUNCTION auto_approve_platform_images()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-approve images from platform source
  IF NEW.source = 'platform' THEN
    NEW.approved = true;
    
    -- Set as primary if no other primary image exists for this offering
    IF NOT EXISTS (
      SELECT 1 FROM offering_images 
      WHERE offering_id = NEW.offering_id 
        AND is_primary = true 
        AND approved = true
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      NEW.is_primary = true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-approval
DROP TRIGGER IF EXISTS auto_approve_platform_images_trigger ON public.offering_images;
CREATE TRIGGER auto_approve_platform_images_trigger
  BEFORE INSERT OR UPDATE ON public.offering_images
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_platform_images();