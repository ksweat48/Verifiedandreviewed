/*
  # Add missing columns to businesses table

  1. Changes
    - Add `days_closed` column to businesses table
    - Add `owner_user_id` column to businesses table (if not exists)
    - Add other missing columns that may be referenced in the code

  2. Security
    - No RLS changes needed as table already has RLS enabled
*/

-- Add days_closed column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'days_closed'
  ) THEN
    ALTER TABLE businesses ADD COLUMN days_closed text;
  END IF;
END $$;

-- Add owner_user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE businesses ADD COLUMN owner_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for owner_user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'businesses' AND indexname = 'idx_businesses_owner_user_id'
  ) THEN
    CREATE INDEX idx_businesses_owner_user_id ON businesses(owner_user_id);
  END IF;
END $$;