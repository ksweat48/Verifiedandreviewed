/*
  # Drop and Re-create search_offerings_by_vibe Function

  1. Function Management
    - Drop existing `search_offerings_by_vibe` function to resolve type conflicts
    - Re-create with correct return type signature
    - Enable semantic search for dishes, menu items, products, and services

  2. Function Features
    - Vector similarity search using cosine distance
    - Returns offerings with similarity scores above threshold
    - Joins with offerings table for complete details
    - Only returns active offerings
    - Orders by similarity (best matches first)

  3. Parameters
    - `query_embedding` (vector): User search query as vector
    - `match_threshold` (float): Minimum similarity score required
    - `match_count` (int): Maximum number of results to return

  4. Returns
    - Full offering details (title, description, tags, pricing)
    - Associated business_id for linking
    - Similarity score for ranking
*/

-- Drop the existing function with its exact signature
DROP FUNCTION IF EXISTS public.search_offerings_by_vibe(vector, double precision, integer);

-- Also drop any other potential variations
DROP FUNCTION IF EXISTS public.search_offerings_by_vibe(vector, float, int);
DROP FUNCTION IF EXISTS public.search_offerings_by_vibe(vector(1536), double precision, integer);
DROP FUNCTION IF EXISTS public.search_offerings_by_vibe(vector(1536), float, int);

-- Create the search_offerings_by_vibe function with correct signature
CREATE OR REPLACE FUNCTION public.search_offerings_by_vibe(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE(
  offering_id uuid,
  title text,
  description text,
  tags text[],
  price_cents int,
  currency text,
  status text,
  business_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oe.offering_id,
    o.title,
    o.description,
    o.tags,
    o.price_cents,
    o.currency,
    o.status,
    o.business_id,
    1 - (oe.embedding <=> query_embedding) AS similarity
  FROM
    public.offerings_embeddings oe
  JOIN
    public.offerings o ON oe.offering_id = o.id
  WHERE
    1 - (oe.embedding <=> query_embedding) > match_threshold
    AND o.status = 'active' -- Only return active offerings
  ORDER BY
    oe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;