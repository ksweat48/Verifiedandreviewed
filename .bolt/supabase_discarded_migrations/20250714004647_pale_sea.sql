```sql
-- Add missing columns to the 'businesses' table
-- This script is designed to be idempotent, meaning it can be run multiple times without error
-- if a column already exists.

-- Add 'short_description' column if it does not exist
DO $$ BEGIN
    ALTER TABLE public.businesses
    ADD COLUMN short_description text;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column short_description already exists in public.businesses.';
END $$;

-- Add 'website_url' column if it does not exist
DO $$ BEGIN
    ALTER TABLE public.businesses
    ADD COLUMN website_url text;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column website_url already exists in public.businesses.';
END $$;

-- Add 'social_media' column if it does not exist
DO $$ BEGIN
    ALTER TABLE public.businesses
    ADD COLUMN social_media text[];
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column social_media already exists in public.businesses.';
END $$;

-- Add 'price_range' column if it does not exist
DO $$ BEGIN
    ALTER TABLE public.businesses
    ADD COLUMN price_range text;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column price_range already exists in public.businesses.';
END $$;

-- Add 'service_area' column if it does not exist
DO $$ BEGIN
    ALTER TABLE public.businesses
    ADD COLUMN service_area text;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column service_area already exists in public.businesses.';
END $$;

```