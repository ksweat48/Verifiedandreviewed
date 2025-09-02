/*
  # Add offering visits and review visibility system

  1. Database Changes
    - Add `offering_id` column to `business_visits` table
    - Make `business_id` nullable in `business_visits` table
    - Add `is_visible` column to `user_reviews` table with default true
    - Add foreign key constraint for offering visits
    - Add indexes for performance

  2. Data Migration
    - Set existing approved reviews to visible (is_visible = true)
    - Set existing pending/rejected reviews to hidden (is_visible = false)

  3. Security Updates
    - Add RLS policies for offering visit tracking
    - Update review policies to use is_visible instead of status
*/

-- Add offering_id column to business_visits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_visits' AND column_name = 'offering_id'
  ) THEN
    ALTER TABLE business_visits ADD COLUMN offering_id uuid;
  END IF;
END $$;

-- Make business_id nullable in business_visits table
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
DO $$
BEGIN
  -- Set approved reviews to visible
  UPDATE user_reviews 
  SET is_visible = true 
  WHERE status = 'approved' AND is_visible IS NULL;
  
  -- Set non-approved reviews to hidden
  UPDATE user_reviews 
  SET is_visible = false 
  WHERE status != 'approved' AND is_visible IS NULL;
END $$;

-- Add indexes for performance
DO $$
BEGIN
  -- Index for offering visits lookup
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_business_visits_offering_user'
  ) THEN
    CREATE INDEX idx_business_visits_offering_user 
    ON business_visits (offering_id, user_id);
  END IF;
  
  -- Index for user's offering visits
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_business_visits_user_offering'
  ) THEN
    CREATE INDEX idx_business_visits_user_offering 
    ON business_visits (user_id, offering_id) 
    WHERE offering_id IS NOT NULL;
  END IF;
  
  -- Index for visible reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_user_reviews_visible'
  ) THEN
    CREATE INDEX idx_user_reviews_visible 
    ON user_reviews (is_visible, offering_id) 
    WHERE is_visible = true;
  END IF;
END $$;

-- Add RLS policies for offering visits
DO $$
BEGIN
  -- Policy for users to create their own offering visits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_visits' 
    AND policyname = 'Users can create offering visits'
  ) THEN
    CREATE POLICY "Users can create offering visits"
      ON business_visits
      FOR INSERT
      TO public
      WITH CHECK (uid() = user_id);
  END IF;
  
  -- Policy for users to read their own offering visits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_visits' 
    AND policyname = 'Users can read their own offering visits'
  ) THEN
    CREATE POLICY "Users can read their own offering visits"
      ON business_visits
      FOR SELECT
      TO public
      USING (uid() = user_id);
  END IF;
END $$;

-- Update review policies to use is_visible instead of status
DO $$
BEGIN
  -- Drop old policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_reviews' 
    AND policyname = 'Public can read approved reviews'
  ) THEN
    DROP POLICY "Public can read approved reviews" ON user_reviews;
  END IF;
  
  -- Create new policy for visible reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_reviews' 
    AND policyname = 'Public can read visible reviews'
  ) THEN
    CREATE POLICY "Public can read visible reviews"
      ON user_reviews
      FOR SELECT
      TO public
      USING (is_visible = true);
  END IF;
  
  -- Drop old offering review policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_reviews' 
    AND policyname = 'Public can read approved offering reviews'
  ) THEN
    DROP POLICY "Public can read approved offering reviews" ON user_reviews;
  END IF;
  
  -- Create new policy for visible offering reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_reviews' 
    AND policyname = 'Public can read visible offering reviews'
  ) THEN
    CREATE POLICY "Public can read visible offering reviews"
      ON user_reviews
      FOR SELECT
      TO public
      USING ((is_visible = true) AND (offering_id IS NOT NULL));
  END IF;
END $$;