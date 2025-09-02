/*
  # Add offering visits and review visibility

  1. New Columns
    - Add `offering_id` to `business_visits` table for tracking offering interactions
    - Add `is_visible` to `user_reviews` table for admin visibility control

  2. Data Migration
    - Set existing approved reviews to visible
    - Set existing pending/rejected reviews to hidden

  3. Security
    - Update RLS policies to handle new offering visit tracking
    - Maintain existing security for review visibility
*/

-- Add offering_id to business_visits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_visits' AND column_name = 'offering_id'
  ) THEN
    ALTER TABLE business_visits ADD COLUMN offering_id uuid;
  END IF;
END $$;

-- Add foreign key constraint for offering_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'business_visits_offering_id_fkey'
  ) THEN
    ALTER TABLE business_visits 
    ADD CONSTRAINT business_visits_offering_id_fkey 
    FOREIGN KEY (offering_id) REFERENCES offerings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make business_id nullable since visits can now be offering-specific
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_visits' 
    AND column_name = 'business_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE business_visits ALTER COLUMN business_id DROP NOT NULL;
  END IF;
END $$;

-- Add is_visible column to user_reviews table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_reviews' AND column_name = 'is_visible'
  ) THEN
    ALTER TABLE user_reviews ADD COLUMN is_visible boolean DEFAULT true;
  END IF;
END $$;

-- Migrate existing review data
-- Set approved reviews to visible, others to hidden
UPDATE user_reviews 
SET is_visible = CASE 
  WHEN status = 'approved' THEN true 
  ELSE false 
END
WHERE is_visible IS NULL;

-- Add index for performance on offering visits
CREATE INDEX IF NOT EXISTS idx_business_visits_offering_id 
ON business_visits (offering_id);

-- Add index for performance on review visibility
CREATE INDEX IF NOT EXISTS idx_user_reviews_visible_offering 
ON user_reviews (offering_id, is_visible);

-- Update RLS policies for offering visits
CREATE POLICY IF NOT EXISTS "Users can create offering visits"
  ON business_visits
  FOR INSERT
  TO authenticated
  USING (uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can read their own offering visits"
  ON business_visits
  FOR SELECT
  TO authenticated
  USING (uid() = user_id);

-- Update RLS policies for review visibility
CREATE POLICY IF NOT EXISTS "Public can read visible reviews"
  ON user_reviews
  FOR SELECT
  TO public
  USING (is_visible = true);

-- Allow admins to manage review visibility
CREATE POLICY IF NOT EXISTS "Admins can manage review visibility"
  ON user_reviews
  FOR UPDATE
  TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());