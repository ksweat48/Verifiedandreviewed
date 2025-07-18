/*
  # Create storage buckets for business and review images

  1. New Buckets
    - `business-images` for business logos, covers, and gallery images
    - `review-images` for user review images

  2. Security
    - Allow authenticated users to upload to both buckets
    - Allow public read access to both buckets
*/

-- Create business-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-images', 'business-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create review-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-images', 'review-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for business-images bucket
CREATE POLICY "Allow authenticated uploads to business-images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'business-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to business-images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'business-images');

CREATE POLICY "Allow users to update their business images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'business-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow users to delete their business images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'business-images' AND auth.role() = 'authenticated');

-- Policies for review-images bucket
CREATE POLICY "Allow authenticated uploads to review-images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'review-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public read access to review-images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'review-images');

CREATE POLICY "Allow users to update their review images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'review-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow users to delete their review images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'review-images' AND auth.role() = 'authenticated');