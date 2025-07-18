/*
  # Fix constraints for user_businesses table
  
  1. Changes
     - Skip creating the user_businesses_user_id_business_id_key constraint that already exists
     - Add remaining table structure and policies
*/

-- Skip creating the constraint since it already exists
-- Instead, we'll add any missing parts

-- Create indexes for foreign keys if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_businesses_user_id') THEN
        CREATE INDEX idx_user_businesses_user_id ON public.user_businesses USING btree (user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_businesses_business_id') THEN
        CREATE INDEX idx_user_businesses_business_id ON public.user_businesses USING btree (business_id);
    END IF;
END
$$;

-- Enable RLS if not already enabled
ALTER TABLE public.user_businesses ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_businesses' AND policyname = 'Users can create their own business associations') THEN
        CREATE POLICY "Users can create their own business associations" ON public.user_businesses
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_businesses' AND policyname = 'Users can delete their own business associations') THEN
        CREATE POLICY "Users can delete their own business associations" ON public.user_businesses
        FOR DELETE USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_businesses' AND policyname = 'Users can update their own business associations') THEN
        CREATE POLICY "Users can update their own business associations" ON public.user_businesses
        FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_businesses' AND policyname = 'Users can view their own business associations') THEN
        CREATE POLICY "Users can view their own business associations" ON public.user_businesses
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Add is_business_owner column to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_business_owner') THEN
        ALTER TABLE public.profiles
        ADD COLUMN is_business_owner boolean DEFAULT false;
    END IF;
END
$$;

-- Add owner_user_id to businesses table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'owner_user_id') THEN
        ALTER TABLE public.businesses
        ADD COLUMN owner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- Create index for owner_user_id in businesses table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_businesses_owner_user_id') THEN
        CREATE INDEX idx_businesses_owner_user_id ON public.businesses USING btree (owner_user_id);
    END IF;
END
$$;

-- Create or replace trigger functions
CREATE OR REPLACE FUNCTION public.update_is_business_owner()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET is_business_owner = TRUE
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_remaining_businesses()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_businesses WHERE user_id = OLD.user_id) THEN
        UPDATE public.profiles
        SET is_business_owner = FALSE
        WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_is_business_owner') THEN
        CREATE TRIGGER set_is_business_owner
        AFTER INSERT ON public.user_businesses
        FOR EACH ROW EXECUTE FUNCTION public.update_is_business_owner();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'check_business_owner_status') THEN
        CREATE TRIGGER check_business_owner_status
        AFTER DELETE ON public.user_businesses
        FOR EACH ROW EXECUTE FUNCTION public.check_remaining_businesses();
    END IF;
END
$$;