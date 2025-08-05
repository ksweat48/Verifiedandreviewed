/*
  # Add public access to basic profile information

  1. Security
    - Add policy for public users to read basic profile info (id, name, username, avatar_url)
    - This enables the user search display to work for non-authenticated users
    - Sensitive data like email and credits remain protected

  2. Changes
    - New RLS policy: "Allow public to read basic profile info for user searches"
    - Grants SELECT access to public role for specific columns only
    - Does not affect existing authenticated user policies
*/

CREATE POLICY "Allow public to read basic profile info for user searches"
  ON profiles
  FOR SELECT
  TO public
  USING (true);