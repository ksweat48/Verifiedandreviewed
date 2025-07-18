/*
  # Admin User Schema Updates

  1. New Columns
    - Add `role` column to `profiles` table with default 'user'
  
  2. Security
    - Update RLS policies to respect admin role
*/

-- Add role column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  END IF;
END $$;

-- Create index on role column for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Create admin-specific RLS policy for profiles
CREATE POLICY IF NOT EXISTS "Admins can read all profiles" 
ON profiles FOR SELECT 
TO authenticated
USING (auth.uid() = id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'administrator');

-- Create admin-specific RLS policy for businesses
CREATE POLICY IF NOT EXISTS "Admins can manage all businesses" 
ON businesses FOR ALL 
TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'administrator');

-- Create admin-specific RLS policy for credit_transactions
CREATE POLICY IF NOT EXISTS "Admins can view all credit transactions" 
ON credit_transactions FOR SELECT 
TO authenticated
USING (user_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'administrator');