/*
  # Create credit transactions table

  1. New Tables
    - `credit_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `amount` (integer)
      - `type` (text)
      - `description` (text)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `credit_transactions` table
    - Add policies for users to read their own transactions
    - Add policy for service role to create transactions
*/

-- Create credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own transactions"
  ON credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can create transactions"
  ON credit_transactions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create function to update user credits when a transaction is created
CREATE OR REPLACE FUNCTION public.update_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET 
    credits = credits + NEW.amount,
    updated_at = now()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update user credits
CREATE OR REPLACE TRIGGER on_credit_transaction_created
  AFTER INSERT ON credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_credits();