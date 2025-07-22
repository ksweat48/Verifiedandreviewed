/*
  # Create Review Images Storage Bucket and Policies

  1. Storage Bucket
    - Create `review-images` bucket for user review images
    - Set up proper RLS policies for authenticated users

  2. Security
    - Enable RLS on storage bucket
    - Allow authenticated users to upload to their own folders
    - Allow public read access to approved review images
*/

-- Create the review-images storage bucket (if it doesn't exist)
-- Note: This needs to be done manually in Supabase dashboard or via SQL
-- INSERT INTO storage.buckets (id, name, public) VALUES ('review-images', 'review-images', true);

-- Enable RLS on the review-images bucket
-- This is typically done through the Supabase dashboard

-- Create policy to allow authenticated users to upload images to their own folder
-- Policy name: "Allow authenticated users to upload review images"
-- Operation: INSERT
-- Target roles: authenticated
-- Using expression: bucket_id = 'review-images' AND (storage.foldername(name))[1] = auth.uid()::text

-- Create policy to allow public read access to review images
-- Policy name: "Allow public read access to review images"
-- Operation: SELECT
-- Target roles: public, authenticated
-- Using expression: bucket_id = 'review-images'

-- Note: These policies need to be created in the Supabase dashboard under Storage > review-images > Policies
-- The SQL commands above are for reference - storage policies are typically managed through the UI