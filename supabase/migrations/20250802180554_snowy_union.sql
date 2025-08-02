/*
  # Add RLS policies for homepage user search display

  1. New Policies
    - Allow authenticated users to read search activity logs from all users
    - Allow authenticated users to read public profile information for activity feed

  2. Security
    - Search activity logs: Only 'search' event types are readable by all authenticated users
    - Profiles: All profile data becomes readable by authenticated users (consider using a view for production)

  3. Purpose
    - Enable the homepage to display recent searches from all users
    - Show user avatars and names in the search activity feed
*/

-- Allow authenticated users to read all search activity logs
CREATE POLICY "Allow authenticated users to read all search activity logs"
  ON public.user_activity_logs
  FOR SELECT
  TO authenticated
  USING (event_type = 'search');

-- Allow authenticated users to read all profiles for activity feed
-- WARNING: This allows access to ALL profile columns. Consider using a view for production.
CREATE POLICY "Allow authenticated users to read all profiles for activity feed"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);