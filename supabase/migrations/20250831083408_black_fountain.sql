/*
  # Add DELETE policy for business recommendations

  1. Security
    - Add DELETE policy for business_recommendations table
    - Allow users to delete only their own recommendations

  2. Changes
    - Enable RLS on business_recommendations table (if not already enabled)
    - Add policy for authenticated users to delete their own recommendations
*/

-- Ensure RLS is enabled on business_recommendations table
ALTER TABLE public.business_recommendations ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists (for clean migrations)
DROP POLICY IF EXISTS "Users can delete their own recommendations" ON public.business_recommendations;

-- Add DELETE policy for users to delete their own recommendations
CREATE POLICY "Users can delete their own recommendations"
  ON public.business_recommendations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = recommended_by);

-- Add index for better performance on delete operations
CREATE INDEX IF NOT EXISTS idx_business_recommendations_user_delete 
  ON public.business_recommendations (recommended_by, id);