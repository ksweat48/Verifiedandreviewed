/*
  # Create search_offerings_by_vibe RPC function

  1. New Functions
    - `search_offerings_by_vibe` - Semantic search function for offerings
      - Takes query embedding, match threshold, and match count as parameters
      - Returns offerings with similarity scores based on vector embeddings
      - Joins with offerings table to return full offering details
      - Only returns active offerings
      - Orders by similarity (best matches first)

  2. Security
    - Function is accessible to public for search functionality
    - Respects existing RLS policies on offerings table
    - Only returns active offerings to maintain data integrity

  3. Performance
    - Uses vector cosine distance operator for efficient similarity search
    - Includes proper LIMIT to prevent excessive results
    - Leverages existing indexes on offerings table
*/

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