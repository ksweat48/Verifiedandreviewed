/*
  # Add views column to user_reviews table

  1. Schema Changes
    - Add `views` column to `user_reviews` table
    - Set default value to 0
    - Add index for performance on views column

  2. Security
    - No RLS changes needed as existing policies cover the new column

  3. Notes
    - Views will be incremented server-side via Netlify functions
    - Default value ensures existing reviews start with 0 views
*/

-- Add views column to user_reviews table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_reviews' AND column_name = 'views'
  ) THEN
    ALTER TABLE user_reviews ADD COLUMN views integer DEFAULT 0;
  END IF;
END $$;

-- Add index for performance on views column
CREATE INDEX IF NOT EXISTS idx_user_reviews_views ON user_reviews(views DESC);

-- Update existing reviews to have 0 views
UPDATE user_reviews SET views = 0 WHERE views IS NULL;