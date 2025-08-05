/*
  # Add Virtual Business Support

  1. Schema Changes
    - Add `is_virtual` column to `businesses` table
    - Set default value to `false` for existing businesses
    - Add index for virtual business queries

  2. Data Integrity
    - Ensure existing businesses are not affected
    - Maintain backward compatibility with existing code

  3. Notes
    - Virtual businesses operate entirely online
    - They still require addresses for 10-mile radius search functionality
    - Website URL becomes mandatory for virtual businesses
*/

-- Add is_virtual column to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'is_virtual'
  ) THEN
    ALTER TABLE businesses ADD COLUMN is_virtual boolean DEFAULT false;
  END IF;
END $$;

-- Add index for virtual business queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'businesses' AND indexname = 'idx_businesses_virtual'
  ) THEN
    CREATE INDEX idx_businesses_virtual ON businesses (is_virtual);
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN businesses.is_virtual IS 'Indicates if this is a virtual business that operates entirely online';