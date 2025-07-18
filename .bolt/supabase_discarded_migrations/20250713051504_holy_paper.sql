-- Create the 'user_businesses' table
CREATE TABLE public.user_businesses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    role text DEFAULT 'owner' NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Add unique constraint for user_id and business_id
ALTER TABLE public.user_businesses
ADD CONSTRAINT user_businesses_user_id_business_id_key UNIQUE (user_id, business_id);

-- Create unique index for user_id and business_id (this is the problematic one, commented out)
-- CREATE UNIQUE INDEX user_businesses_user_id_business_id_key ON public.user_businesses USING btree (user_id, business_id);

-- Create indexes for foreign keys
CREATE INDEX idx_user_businesses_user_id ON public.user_businesses USING btree (user_id);
CREATE INDEX idx_user_businesses_business_id ON public.user_businesses USING btree (business_id);

-- RLS policies for user_businesses
ALTER TABLE public.user_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own business associations" ON public.user_businesses
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business associations" ON public.user_businesses
FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own business associations" ON public.user_businesses
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own business associations" ON public.user_businesses
FOR SELECT USING (auth.uid() = user_id);

-- Add is_business_owner column to profiles table
ALTER TABLE public.profiles
ADD COLUMN is_business_owner boolean DEFAULT false;

-- Add owner_user_id to businesses table
ALTER TABLE public.businesses
ADD COLUMN owner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for owner_user_id in businesses table
CREATE INDEX idx_businesses_owner_user_id ON public.businesses USING btree (owner_user_id);

-- Trigger function to update is_business_owner on user_businesses insert
CREATE OR REPLACE FUNCTION public.update_is_business_owner()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET is_business_owner = TRUE
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call update_is_business_owner function
CREATE TRIGGER set_is_business_owner
AFTER INSERT ON public.user_businesses
FOR EACH ROW EXECUTE FUNCTION public.update_is_business_owner();

-- Trigger function to check remaining businesses on user_businesses delete
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

-- Trigger to call check_remaining_businesses function
CREATE TRIGGER check_business_owner_status
AFTER DELETE ON public.user_businesses
FOR EACH ROW EXECUTE FUNCTION public.check_remaining_businesses();
