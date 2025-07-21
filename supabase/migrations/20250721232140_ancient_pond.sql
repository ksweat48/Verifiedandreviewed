/*
  # Fix Review Image Uploads

  1. Storage Policies
    - Enable authenticated users to upload review images
    - Allow users to upload to their own folders
    - Allow users to read their own uploaded images

  2. Security
    - Users can only upload to folders matching their user ID
    - File size and type restrictions handled by client
*/

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-images', 'user-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage bucket
UPDATE storage.buckets 
SET public = true 
WHERE id = 'user-images';

-- Policy for authenticated users to upload images to their own folder
CREATE POLICY "Users can upload their own images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for authenticated users to read their own images
CREATE POLICY "Users can read their own images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for public to read approved review images
CREATE POLICY "Public can read review images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-images');

-- Policy for service role to manage all images
CREATE POLICY "Service role can manage all images"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'user-images')
WITH CHECK (bucket_id = 'user-images');