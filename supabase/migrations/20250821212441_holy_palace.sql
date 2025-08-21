/*
  # Add offering review support to user_reviews table

  1. Schema Changes
    - Add `offering_id` column to `user_reviews` table
    - Create foreign key constraint to `offerings` table
    - Add check constraint to ensure reviews are tied to either business OR offering

  2. Performance Indexes
    - Index on `offering_id` for fast review lookups
    - Composite index on `offering_id` + `status` for approved reviews

  3. Security Updates
    - Add RLS policies for offering-specific reviews
    - Maintain backward compatibility with business reviews

  4. Data Integrity
    - Ensure reviews are tied to either business_id OR offering_id (not both)
    - Maintain existing business review functionality
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

-- Add check constraint to ensure reviews are tied to either business OR offering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
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

-- Create index for offering reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_reviews_offering_id'
  ) THEN
    CREATE INDEX idx_user_reviews_offering_id ON user_reviews(offering_id);
  END IF;
END $$;

-- Create composite index for approved offering reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_user_reviews_offering_status'
  ) THEN
    CREATE INDEX idx_user_reviews_offering_status ON user_reviews(offering_id, status);
  END IF;
END $$;

-- Add RLS policies for offering reviews
DO $$
BEGIN
  -- Policy for reading approved offering reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public can read approved offering reviews'
  ) THEN
    CREATE POLICY "Public can read approved offering reviews"
      ON user_reviews
      FOR SELECT
      TO public
      USING (status = 'approved' AND offering_id IS NOT NULL);
  END IF;

  -- Policy for creating offering reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can create offering reviews'
  ) THEN
    CREATE POLICY "Users can create offering reviews"
      ON user_reviews
      FOR INSERT
      TO public
      WITH CHECK (
        auth.uid() = user_id AND (
          offering_id IS NOT NULL OR business_id IS NOT NULL
        )
      );
  END IF;

  -- Policy for updating own offering reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can update their own offering reviews'
  ) THEN
    CREATE POLICY "Users can update their own offering reviews"
      ON user_reviews
      FOR UPDATE
      TO public
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Policy for deleting own offering reviews
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can delete their own offering reviews'
  ) THEN
    CREATE POLICY "Users can delete their own offering reviews"
      ON user_reviews
      FOR DELETE
      TO public
      USING (auth.uid() = user_id);
  END IF;
END $$;