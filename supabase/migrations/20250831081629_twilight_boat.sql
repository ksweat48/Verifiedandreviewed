/*
  # Add favorited offering support to business recommendations

  1. New Columns
    - `favorited_offering_id` (uuid, nullable) - Links to offerings table for platform offerings
    - `favorited_business_id` (uuid, nullable) - Links to businesses table for platform offerings
  
  2. Foreign Key Constraints
    - Links favorited_offering_id to offerings table
    - Links favorited_business_id to businesses table
    - Both with SET NULL on delete to preserve favorites even if offering/business is deleted
  
  3. Indexes
    - Add indexes for efficient querying of favorited offerings
*/

-- Add new columns for favorited offerings
ALTER TABLE public.business_recommendations
ADD COLUMN favorited_offering_id uuid NULL,
ADD COLUMN favorited_business_id uuid NULL;

-- Add foreign key constraints
ALTER TABLE public.business_recommendations
ADD CONSTRAINT fk_favorited_offering
FOREIGN KEY (favorited_offering_id) REFERENCES public.offerings(id) ON DELETE SET NULL;

ALTER TABLE public.business_recommendations
ADD CONSTRAINT fk_favorited_business
FOREIGN KEY (favorited_business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_business_recommendations_favorited_offering
ON public.business_recommendations (favorited_offering_id);

CREATE INDEX IF NOT EXISTS idx_business_recommendations_favorited_business
ON public.business_recommendations (favorited_business_id);

-- Add index for user favorites with offering filter
CREATE INDEX IF NOT EXISTS idx_business_recommendations_user_offerings
ON public.business_recommendations (recommended_by, favorited_offering_id);