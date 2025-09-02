/*
  # Add offering visits and review visibility system

  1. New Features
    - Add `offering_id` to `business_visits` table for tracking offering interactions
    - Add `is_visible` to `user_reviews` table for admin visibility control
    - Make `business_id` nullable in visits since we now track offerings primarily

  2. Data Migration
    - Migrate existing approved reviews to visible status
    - Set other reviews to hidden status for admin review

  3. Security
    - Add RLS policies for offering visit tracking
    - Update review policies to use visibility instead of approval status

  4. Performance
    - Add indexes for new query patterns
    - Optimize for offering-based review lookups
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

-- Make business_id nullable in business_visits
DO $$
BEGIN
  ALTER TABLE business_visits ALTER COLUMN business_id DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Column might already be nullable
    NULL;
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
  
  -- Set non-approved reviews to hidden for admin review
  UPDATE user_reviews 
  SET is_visible = false 
  WHERE status != 'approved' AND is_visible IS NULL;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_visits_offering_user 
ON business_visits (offering_id, user_id);

CREATE INDEX IF NOT EXISTS idx_business_visits_offering_id 
ON business_visits (offering_id);

CREATE INDEX IF NOT EXISTS idx_user_reviews_offering_visible 
ON user_reviews (offering_id, is_visible);

CREATE INDEX IF NOT EXISTS idx_user_reviews_visibility 
ON user_reviews (is_visible);

-- Add RLS policies for offering visits
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_visits' 
    AND policyname = 'Users can create offering visits'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can create offering visits"
      ON business_visits
      FOR INSERT
      TO public
      WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_visits' 
    AND policyname = 'Users can read their offering visits'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read their offering visits"
      ON business_visits
      FOR SELECT
      TO public
      USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Add RLS policies for review visibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_reviews' 
    AND policyname = 'Public can read visible offering reviews'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can read visible offering reviews"
      ON user_reviews
      FOR SELECT
      TO public
      USING (is_visible = true AND offering_id IS NOT NULL)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_reviews' 
    AND policyname = 'Admins can manage review visibility'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can manage review visibility"
      ON user_reviews
      FOR UPDATE
      TO authenticated
      USING (current_user_is_admin())
      WITH CHECK (current_user_is_admin())';
  END IF;
END $$;

-- Add constraint to ensure either business_id or offering_id is provided in visits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'business_visits_target_check'
  ) THEN
    ALTER TABLE business_visits 
    ADD CONSTRAINT business_visits_target_check 
    CHECK (business_id IS NOT NULL OR offering_id IS NOT NULL);
  END IF;
END $$;