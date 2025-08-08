/*
  # Rate Limiting System

  1. New Tables
    - `rate_limits`
      - `id` (uuid, primary key)
      - `identifier` (text, user_id or ip_address)
      - `type` (text, 'user_id' or 'ip_address')
      - `function_name` (text, name of the Netlify function)
      - `request_at` (timestamp, when the request was made)
      - `user_agent` (text, optional user agent string)
      - `metadata` (jsonb, optional additional data)

  2. Security
    - Enable RLS on `rate_limits` table
    - Add policy for service role to manage rate limit records
    - Add index for efficient querying by identifier and function

  3. Cleanup
    - Add function to automatically clean old rate limit records
*/

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  type text NOT NULL CHECK (type IN ('user_id', 'ip_address')),
  function_name text NOT NULL,
  request_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_function 
  ON rate_limits (identifier, function_name, request_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup 
  ON rate_limits (request_at);

-- Policy for service role to manage rate limit records
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE request_at < (now() - INTERVAL '1 hour');
END;
$$;

-- Create a scheduled job to clean up old records (if pg_cron is available)
-- This is optional and depends on your Supabase plan
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT cleanup_old_rate_limits();');