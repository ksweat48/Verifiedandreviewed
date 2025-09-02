/*
  # Add offering visits and review visibility system

  1. Database Changes
    - Add `offering_id` column to `business_visits` table
    - Add `is_visible` column to `user_reviews` table
    - Make `business_id` nullable in visits table
    - Add proper indexes for performance

  2. Security Updates
    - Add RLS policies for offering visit tracking
    - Update review policies for visibility system

  3. Data Migration
    - Set existing approved reviews to visible
    - Set other reviews to hidden
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

-- Make business_id nullable in business_visits
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

-- Add indexes for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_business_visits_offering_user'
  ) THEN
    CREATE INDEX idx_business_visits_offering_user ON business_visits (offering_id, user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_reviews_offering_visible'
  ) THEN
    CREATE INDEX idx_user_reviews_offering_visible ON user_reviews (offering_id, is_visible);
  END IF;
END $$;

-- Migrate existing review data
UPDATE user_reviews 
SET is_visible = true 
WHERE status = 'approved' AND is_visible IS NULL;

UPDATE user_reviews 
SET is_visible = false 
WHERE status IN ('pending', 'rejected') AND is_visible IS NULL;

-- Add RLS policies for offering visits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can create offering visits'
  ) THEN
    CREATE POLICY "Users can create offering visits"
      ON business_visits
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can read their own offering visits'
  ) THEN
    CREATE POLICY "Users can read their own offering visits"
      ON business_visits
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Update review policies for visibility system
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public can read visible reviews'
  ) THEN
    CREATE POLICY "Public can read visible reviews"
      ON user_reviews
      FOR SELECT
      TO public
      USING (is_visible = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Admins can manage review visibility'
  ) THEN
    CREATE POLICY "Admins can manage review visibility"
      ON user_reviews
      FOR UPDATE
      TO authenticated
      USING (current_user_is_admin())
      WITH CHECK (current_user_is_admin());
  END IF;
END $$;