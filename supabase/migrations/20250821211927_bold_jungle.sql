/*
  # Add offering reviews support

  1. Schema Changes
    - Add `offering_id` column to `user_reviews` table (nullable, allows existing business reviews)
    - Add foreign key constraint linking to `offerings` table
    - Add index for performance on offering_id queries

  2. Security Updates
    - Update RLS policies to support offering-based reviews
    - Allow users to read reviews for specific offerings
    - Allow users to create reviews for offerings they can access

  3. Backward Compatibility
    - Keep existing `business_id` column for legacy business reviews
    - Allow reviews to be tied to either businesses OR offerings
    - Existing business reviews remain unchanged
*/

-- Add offering_id column to user_reviews table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_reviews' AND column_name = 'offering_id'
  ) THEN
    ALTER TABLE user_reviews ADD COLUMN offering_id uuid;
  END IF;
END $$;

-- Add foreign key constraint to offerings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_reviews_offering_id_fkey'
  ) THEN
    ALTER TABLE user_reviews 
    ADD CONSTRAINT user_reviews_offering_id_fkey 
    FOREIGN KEY (offering_id) REFERENCES offerings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for offering_id queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_reviews_offering_id'
  ) THEN
    CREATE INDEX idx_user_reviews_offering_id ON user_reviews(offering_id);
  END IF;
END $$;

-- Add composite index for offering_id and status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_reviews_offering_status'
  ) THEN
    CREATE INDEX idx_user_reviews_offering_status ON user_reviews(offering_id, status);
  END IF;
END $$;

-- Update RLS policies to support offering-based reviews

-- Policy: Users can read reviews for specific offerings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reviews' AND policyname = 'Users can read offering reviews'
  ) THEN
    CREATE POLICY "Users can read offering reviews"
      ON user_reviews
      FOR SELECT
      TO public
      USING (
        (status = 'approved' AND offering_id IS NOT NULL) OR
        (status = 'approved' AND business_id IS NOT NULL)
      );
  END IF;
END $$;

-- Policy: Users can create reviews for offerings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reviews' AND policyname = 'Users can create offering reviews'
  ) THEN
    CREATE POLICY "Users can create offering reviews"
      ON user_reviews
      FOR INSERT
      TO public
      WITH CHECK (
        uid() = user_id AND (
          offering_id IS NOT NULL OR business_id IS NOT NULL
        )
      );
  END IF;
END $$;

-- Policy: Users can update their own offering reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reviews' AND policyname = 'Users can update offering reviews'
  ) THEN
    CREATE POLICY "Users can update offering reviews"
      ON user_reviews
      FOR UPDATE
      TO public
      USING (uid() = user_id)
      WITH CHECK (uid() = user_id);
  END IF;
END $$;

-- Policy: Users can delete their own offering reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reviews' AND policyname = 'Users can delete offering reviews'
  ) THEN
    CREATE POLICY "Users can delete offering reviews"
      ON user_reviews
      FOR DELETE
      TO public
      USING (uid() = user_id);
  END IF;
END $$;

-- Add check constraint to ensure either business_id OR offering_id is provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'user_reviews_target_check'
  ) THEN
    ALTER TABLE user_reviews 
    ADD CONSTRAINT user_reviews_target_check 
    CHECK (
      (business_id IS NOT NULL AND offering_id IS NULL) OR
      (business_id IS NULL AND offering_id IS NOT NULL)
    );
  END IF;
END $$;