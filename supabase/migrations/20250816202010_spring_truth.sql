/*
  # Add Search Offerings RPC Function

  1. New Functions
    - `search_offerings_by_vibe` - Semantic search function for offerings using vector similarity
    
  2. Features
    - Uses pgvector for efficient KNN search
    - Returns offerings with similarity scores
    - Includes business context and images
    - Optimized for performance with proper indexing
*/

-- Create the search function for offerings
CREATE OR REPLACE FUNCTION search_offerings_by_vibe(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  tags text[],
  price_cents integer,
  currency text,
  service_type text,
  business_id uuid,
  business_name text,
  business_category text,
  business_location text,
  business_address text,
  business_description text,
  business_short_description text,
  business_image_url text,
  business_latitude double precision,
  business_longitude double precision,
  business_phone_number text,
  business_website_url text,
  business_hours text,
  business_is_verified boolean,
  business_is_mobile boolean,
  business_is_virtual boolean,
  business_thumbs_up integer,
  business_thumbs_down integer,
  business_sentiment_score integer,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.title,
    o.description,
    o.tags,
    o.price_cents,
    o.currency,
    o.service_type,
    o.business_id,
    b.name as business_name,
    b.category as business_category,
    b.location as business_location,
    b.address as business_address,
    b.description as business_description,
    b.short_description as business_short_description,
    b.image_url as business_image_url,
    b.latitude as business_latitude,
    b.longitude as business_longitude,
    b.phone_number as business_phone_number,
    b.website_url as business_website_url,
    b.hours as business_hours,
    b.is_verified as business_is_verified,
    b.is_mobile_business as business_is_mobile,
    b.is_virtual as business_is_virtual,
    b.thumbs_up as business_thumbs_up,
    b.thumbs_down as business_thumbs_down,
    b.sentiment_score as business_sentiment_score,
    (oe.embedding <=> query_embedding) * -1 + 1 as similarity,
    o.created_at,
    o.updated_at
  FROM offerings o
  INNER JOIN businesses b ON o.business_id = b.id
  INNER JOIN offerings_embeddings oe ON o.id = oe.offering_id
  WHERE 
    o.status = 'active'
    AND b.is_visible_on_platform = true
    AND (oe.embedding <=> query_embedding) < (1 - match_threshold)
  ORDER BY oe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;