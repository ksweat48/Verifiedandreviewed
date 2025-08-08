/*
  # Create app settings table for global configuration

  1. New Tables
    - `app_settings`
      - `id` (uuid, primary key)
      - `setting_name` (text, unique, not null)
      - `setting_value` (jsonb, not null)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `app_settings` table
    - Add policy for public to read settings
    - Add policy for administrators to manage settings

  3. Initial Data
    - Insert default setting for Google Vision moderation (disabled)

  4. Triggers
    - Add trigger to update `updated_at` column on changes
*/

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_name text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public to read settings (for frontend to check feature flags)
CREATE POLICY "Public can read app settings"
  ON app_settings
  FOR SELECT
  TO public
  USING (true);

-- Allow administrators to manage settings
CREATE POLICY "Administrators can manage app settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at();

-- Insert default settings
INSERT INTO app_settings (setting_name, setting_value) VALUES
  ('enable_vision_moderation', '{"enabled": false, "description": "Enable Google Cloud Vision SafeSearch for image moderation"}')
ON CONFLICT (setting_name) DO NOTHING;