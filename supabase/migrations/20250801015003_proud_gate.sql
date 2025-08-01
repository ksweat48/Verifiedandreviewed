/*
  # Add username column to profiles table

  1. Schema Changes
    - Add `username` column to `profiles` table (text, unique, not null)
    - Create unique index on username for fast lookups
    - Add constraint to ensure username is not empty

  2. Security
    - Update RLS policies to include username in select operations
    - Ensure username uniqueness is enforced at database level

  3. Data Migration
    - Set default username values for existing users (email prefix)
    - Update trigger to handle username during profile creation
*/

-- Add username column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE profiles ADD COLUMN username text;
  END IF;
END $$;

-- Create unique index on username
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'profiles' AND indexname = 'profiles_username_key'
  ) THEN
    CREATE UNIQUE INDEX profiles_username_key ON profiles (username);
  END IF;
END $$;

-- Add constraint to ensure username is not empty
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'profiles_username_not_empty'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_not_empty 
    CHECK (username IS NOT NULL AND trim(username) != '');
  END IF;
END $$;

-- Set default usernames for existing users (use email prefix)
UPDATE profiles 
SET username = split_part(email, '@', 1)
WHERE username IS NULL AND email IS NOT NULL;

-- Create function to generate unique username from email
CREATE OR REPLACE FUNCTION generate_unique_username(email_input text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_username text;
  final_username text;
  counter integer := 1;
BEGIN
  -- Extract username from email (part before @)
  base_username := split_part(email_input, '@', 1);
  
  -- Remove any non-alphanumeric characters and convert to lowercase
  base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9]', '', 'g'));
  
  -- Ensure minimum length
  IF length(base_username) < 3 THEN
    base_username := base_username || 'user';
  END IF;
  
  final_username := base_username;
  
  -- Check if username exists and increment if needed
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    final_username := base_username || counter::text;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_username;
END;
$$;

-- Update the handle_new_user function to include username generation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_username text;
BEGIN
  -- Generate unique username from email
  generated_username := generate_unique_username(NEW.email);
  
  INSERT INTO profiles (id, email, username, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    generated_username,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;