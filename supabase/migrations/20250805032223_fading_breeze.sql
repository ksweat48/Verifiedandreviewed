/*
  # Add mobile business support

  1. Schema Changes
    - Add `is_mobile_business` column to businesses table (boolean, default false)
    - Add index for mobile business queries

  2. Security
    - No RLS changes needed as existing policies cover the new column

  3. Notes
    - Mobile businesses will have their full address hidden from public display
    - Only city/area information will be shown publicly for mobile businesses
    - Service area becomes mandatory for mobile businesses
*/

-- Add mobile business support to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'is_mobile_business'
  ) THEN
    ALTER TABLE businesses ADD COLUMN is_mobile_business boolean DEFAULT false;
  END IF;
END $$;

-- Add index for mobile business queries
CREATE INDEX IF NOT EXISTS idx_businesses_mobile ON businesses (is_mobile_business);