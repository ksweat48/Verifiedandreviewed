/*
  # Add Monthly Credit Tracking

  1. Schema Changes
    - Add `last_monthly_credit_given_at` column to `profiles` table
    - This tracks when a user last received their monthly 100 credits

  2. Purpose
    - Enable automatic distribution of 100 free credits once per month
    - Only when user has less than 10 credits
    - Prevents multiple distributions in the same month
*/

-- Add column to track when user last received monthly credits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_monthly_credit_given_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_monthly_credit_given_at timestamptz;
  END IF;
END $$;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_profiles_monthly_credits 
ON profiles (last_monthly_credit_given_at, credits);