/*
  # Add business type column for better search intent matching

  1. Schema Changes
    - Add `business_type` column to `businesses` table
    - Add `primary_offering` column for more specific categorization
    - Add index for better query performance

  2. Data Categories
    - `business_type`: 'product', 'service', 'hybrid'
    - `primary_offering`: More specific categorization like 'food_beverage', 'health_coaching', etc.

  3. Performance
    - Add indexes for efficient filtering
*/

-- Add business_type column to categorize businesses by their primary offering type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'business_type'
  ) THEN
    ALTER TABLE businesses ADD COLUMN business_type text DEFAULT 'product';
  END IF;
END $$;

-- Add primary_offering column for more granular categorization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'primary_offering'
  ) THEN
    ALTER TABLE businesses ADD COLUMN primary_offering text DEFAULT 'general';
  END IF;
END $$;

-- Add check constraint for business_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'businesses_business_type_check'
  ) THEN
    ALTER TABLE businesses ADD CONSTRAINT businesses_business_type_check 
    CHECK (business_type IN ('product', 'service', 'hybrid'));
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_businesses_business_type ON businesses(business_type);
CREATE INDEX IF NOT EXISTS idx_businesses_primary_offering ON businesses(primary_offering);
CREATE INDEX IF NOT EXISTS idx_businesses_type_category ON businesses(business_type, category);

-- Update existing businesses with appropriate business types based on their categories
UPDATE businesses 
SET business_type = CASE 
  WHEN category IN ('Restaurant', 'Coffee & Tea', 'Retail') THEN 'product'
  WHEN category IN ('Health & Wellness', 'Professional', 'Service') THEN 'service'
  WHEN category IN ('Beauty & Spa', 'Fitness') THEN 'hybrid'
  ELSE 'product'
END
WHERE business_type = 'product'; -- Only update if still default

-- Update primary_offering based on category for better intent matching
UPDATE businesses 
SET primary_offering = CASE 
  WHEN category = 'Restaurant' THEN 'food_beverage'
  WHEN category = 'Coffee & Tea' THEN 'food_beverage'
  WHEN category = 'Health & Wellness' THEN 'health_coaching'
  WHEN category = 'Fitness' THEN 'fitness_training'
  WHEN category = 'Beauty & Spa' THEN 'beauty_services'
  WHEN category = 'Retail' THEN 'retail_products'
  WHEN category = 'Professional' THEN 'professional_services'
  WHEN category = 'Service' THEN 'general_services'
  ELSE 'general'
END
WHERE primary_offering = 'general'; -- Only update if still default