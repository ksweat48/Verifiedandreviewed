/*
  # Fix Embedding Column Type

  1. Database Setup
    - Enable pgvector extension if not already enabled
    - Drop and recreate the embedding column with proper vector(1536) type
    - Add index for vector similarity search

  2. Security
    - Maintain existing RLS policies on businesses table
*/

-- Enable pgvector extension (this is safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the existing embedding column if it exists
ALTER TABLE public.businesses DROP COLUMN IF EXISTS embedding;

-- Add the embedding column with the correct vector type
ALTER TABLE public.businesses ADD COLUMN embedding vector(1536);

-- Create an index for vector similarity search (using cosine distance)
CREATE INDEX IF NOT EXISTS businesses_embedding_idx 
ON public.businesses 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Verify the column was created correctly
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'businesses' AND column_name = 'embedding';