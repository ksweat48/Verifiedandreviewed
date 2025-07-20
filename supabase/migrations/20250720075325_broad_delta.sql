/*
  # Fix Semantic Search RPC Function

  1. Updates
    - Update `search_businesses_by_vibe` RPC function to return all business fields
    - Ensure only visible platform businesses are returned
    - Include proper similarity scoring

  2. Security
    - Maintains existing RLS policies
    - Only returns publicly visible businesses
*/

-- Drop the existing function first
DROP FUNCTION IF EXISTS search_businesses_by_vibe(vector(1536), float, int);

-- Create the updated function with all necessary fields
CREATE OR REPLACE FUNCTION search_businesses_by_vibe(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  location text,
  category text,
  tags text[],
  description text,
  short_description text,
  image_url text,
  gallery_urls text[],
  hours text,
  days_closed text,
  is_verified boolean,
  thumbs_up integer,
  thumbs_down integer,
  sentiment_score integer,
  phone_number text,
  website_url text,
  social_media text[],
  price_range text,
  service_area text,
  owner_user_id uuid,
  latitude double precision,
  longitude double precision,
  is_visible_on_platform boolean,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.address,
    b.location,
    b.category,
    b.tags,
    b.description,
    b.short_description,
    b.image_url,
    b.gallery_urls,
    b.hours,
    b.days_closed,
    b.is_verified,
    b.thumbs_up,
    b.thumbs_down,
    b.sentiment_score,
    b.phone_number,
    b.website_url,
    b.social_media,
    b.price_range,
    b.service_area,
    b.owner_user_id,
    b.latitude,
    b.longitude,
    b.is_visible_on_platform,
    b.created_at,
    b.updated_at,
    1 - (b.embedding <#> query_embedding) AS similarity
  FROM
    businesses b
  WHERE
    b.embedding IS NOT NULL
    AND b.is_visible_on_platform = true
    AND (1 - (b.embedding <#> query_embedding)) > match_threshold
  ORDER BY
    b.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;