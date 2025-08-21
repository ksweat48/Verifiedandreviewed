/*
  # Add service_type column to offerings table

  1. Schema Changes
    - Add `service_type` column to `offerings` table
    - Set default value to 'onsite'
    - Make column NOT NULL with check constraint
    - Update existing offerings to have default service type

  2. Data Migration
    - Set all existing offerings to 'onsite' service type
    - Infer service type from business data where possible

  3. Constraints
    - Add check constraint to ensure valid service types
    - Valid values: 'onsite', 'mobile', 'remote', 'delivery'
*/

-- Add the service_type column to offerings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offerings' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE offerings ADD COLUMN service_type text DEFAULT 'onsite' NOT NULL;
  END IF;
END $$;

-- Add check constraint to ensure valid service types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'offerings_service_type_check'
  ) THEN
    ALTER TABLE offerings ADD CONSTRAINT offerings_service_type_check 
    CHECK (service_type IN ('onsite', 'mobile', 'remote', 'delivery'));
  END IF;
END $$;

-- Update existing offerings to infer service type from business data
UPDATE offerings 
SET service_type = CASE 
  WHEN EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = offerings.business_id 
    AND businesses.is_virtual = true
  ) THEN 'remote'
  WHEN EXISTS (
    SELECT 1 FROM businesses 
    WHERE businesses.id = offerings.business_id 
    AND businesses.is_mobile_business = true
  ) THEN 'mobile'
  ELSE 'onsite'
END
WHERE service_type = 'onsite'; -- Only update default values

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_offerings_service_type 
ON offerings (service_type);

-- Add comment to document the column
COMMENT ON COLUMN offerings.service_type IS 'Type of service delivery: onsite (at business location), mobile (at customer location), remote (online/virtual), delivery (delivered to customer)';