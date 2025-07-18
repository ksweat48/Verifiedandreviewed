/*
  # Business Account Schema

  1. New Tables
    - `user_businesses` - Links users to businesses they manage
  
  2. Changes
    - Add `is_business_owner` to `profiles` table
    - Add `owner_user_id` to `businesses` table
  
  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Add is_business_owner column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_business_owner BOOLEAN DEFAULT FALSE;

-- Add owner_user_id column to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create user_businesses table for many-to-many relationship
CREATE TABLE IF NOT EXISTS user_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, business_id)
);

-- Enable Row Level Security
ALTER TABLE user_businesses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_businesses table
CREATE POLICY "Users can view their own business associations"
  ON user_businesses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own business associations"
  ON user_businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business associations"
  ON user_businesses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business associations"
  ON user_businesses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update businesses table policies to allow management by associated users
CREATE POLICY "Users can update businesses they own or manage"
  ON businesses
  FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_businesses
      WHERE user_businesses.business_id = businesses.id
      AND user_businesses.user_id = auth.uid()
      AND user_businesses.role IN ('owner', 'manager')
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_businesses_user_id ON user_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_businesses_business_id ON user_businesses(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_user_id ON businesses(owner_user_id);

-- Create function to automatically set is_business_owner flag
CREATE OR REPLACE FUNCTION update_is_business_owner()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET is_business_owner = TRUE
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update is_business_owner when a user is associated with a business
CREATE TRIGGER set_is_business_owner
AFTER INSERT ON user_businesses
FOR EACH ROW
EXECUTE FUNCTION update_is_business_owner();

-- Create function to check if user still has businesses after deletion
CREATE OR REPLACE FUNCTION check_remaining_businesses()
RETURNS TRIGGER AS $$
BEGIN
  -- If user has no more businesses, set is_business_owner to FALSE
  IF NOT EXISTS (
    SELECT 1 FROM user_businesses
    WHERE user_id = OLD.user_id
  ) THEN
    UPDATE profiles
    SET is_business_owner = FALSE
    WHERE id = OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update is_business_owner when a user-business association is deleted
CREATE TRIGGER check_business_owner_status
AFTER DELETE ON user_businesses
FOR EACH ROW
EXECUTE FUNCTION check_remaining_businesses();