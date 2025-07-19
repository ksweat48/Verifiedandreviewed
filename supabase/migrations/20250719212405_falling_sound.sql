/*
  # Add latitude and longitude columns to businesses table

  1. Schema Changes
    - Add `latitude` column (double precision, nullable)
    - Add `longitude` column (double precision, nullable)
    - Add index for geospatial queries (optional but recommended for performance)

  2. Notes
    - Columns are nullable to allow gradual population of coordinates
    - Existing businesses will have NULL coordinates until populated
    - Future businesses should include coordinates when created
*/

-- Add latitude and longitude columns to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE businesses ADD COLUMN latitude double precision;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE businesses ADD COLUMN longitude double precision;
  END IF;
END $$;

-- Add index for geospatial queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_businesses_coordinates ON businesses (latitude, longitude);

-- Add comment to document the new columns
COMMENT ON COLUMN businesses.latitude IS 'Business latitude coordinate for distance calculations';
COMMENT ON COLUMN businesses.longitude IS 'Business longitude coordinate for distance calculations';