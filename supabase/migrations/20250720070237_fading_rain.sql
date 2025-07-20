/*
  # Add Vector Search Support for Semantic Business Search

  1. Extensions
    - Enable pgvector extension for vector similarity search
  
  2. Table Modifications
    - Add embedding column to businesses table for storing OpenAI embeddings
    - Add index for fast vector similarity searches
  
  3. RPC Functions
    - search_businesses_by_vibe: Semantic search function using cosine similarity
    - generate_business_embeddings: Helper function to populate embeddings
  
  4. Security
    - Grant appropriate permissions for vector operations
*/

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for fast vector similarity searches
CREATE INDEX IF NOT EXISTS businesses_embedding_idx 
ON businesses USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create RPC function for semantic business search
CREATE OR REPLACE FUNCTION search_businesses_by_vibe(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  location text,
  address text,
  category text,
  tags text[],
  image_url text,
  hours text,
  is_verified boolean,
  thumbs_up integer,
  thumbs_down integer,
  sentiment_score integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.description,
    b.location,
    b.address,
    b.category,
    b.tags,
    b.image_url,
    b.hours,
    b.is_verified,
    b.thumbs_up,
    b.thumbs_down,
    b.sentiment_score,
    1 - (b.embedding <#> query_embedding) AS similarity
  FROM
    businesses b
  WHERE
    b.embedding IS NOT NULL
    AND b.is_visible_on_platform = true
    AND 1 - (b.embedding <#> query_embedding) > match_threshold
  ORDER BY
    b.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;

-- Create helper function to generate embeddings for existing businesses
CREATE OR REPLACE FUNCTION generate_business_search_text(business_row businesses)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CONCAT_WS(' ',
    business_row.name,
    business_row.description,
    business_row.short_description,
    business_row.category,
    business_row.location,
    array_to_string(business_row.tags, ' ')
  );
END;
$$;

-- Grant permissions for vector operations
GRANT EXECUTE ON FUNCTION search_businesses_by_vibe TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_business_search_text TO authenticated, anon;