/*
  # Create user_reviews table

  1. New Tables
    - `user_reviews`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `business_id` (uuid, foreign key to businesses)
      - `review_text` (text, required)
      - `rating` (integer, 1-5, required)
      - `image_urls` (text array, default empty)
      - `status` (text, default 'pending')
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `user_reviews` table
    - Add policies for users to manage their own reviews
    - Add policy for public to read approved reviews
*/

CREATE TABLE IF NOT EXISTS user_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  review_text text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  image_urls text[] DEFAULT '{}'::text[],
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own reviews" ON user_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own reviews" ON user_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" ON user_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" ON user_reviews
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public can read approved reviews" ON user_reviews
  FOR SELECT USING (status = 'approved');