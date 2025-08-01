/*
  # Create nearby businesses function

  1. New Functions
    - `get_nearby_businesses` - Returns businesses within specified radius of user location
      - Uses PostGIS geography functions for accurate distance calculation
      - Supports search term filtering
      - Supports category filtering
      - Supports verified-only filtering
      - Default radius: 10 miles

  2. Features
    - Accurate geographic distance calculation using ST_DWithin
    - Converts miles to meters for PostGIS compatibility
    - Full-text search across multiple business fields
    - Maintains existing filtering capabilities
    - Only returns visible businesses
*/

CREATE OR REPLACE FUNCTION public.get_nearby_businesses(
    p_latitude double precision,
    p_longitude double precision,
    p_radius_miles integer DEFAULT 10,
    p_search_term text DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_verified_only boolean DEFAULT FALSE
)
RETURNS SETOF public.businesses
LANGUAGE plpgsql
AS $$
DECLARE
    v_radius_meters double precision;
BEGIN
    -- Convert miles to meters (1 mile = 1609.34 meters)
    v_radius_meters := p_radius_miles * 1609.34;

    RETURN QUERY
    SELECT b.*
    FROM public.businesses b
    WHERE
        b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND
        ST_DWithin(
            ST_MakePoint(b.longitude, b.latitude)::geography,
            ST_MakePoint(p_longitude, p_latitude)::geography,
            v_radius_meters
        )
        AND (p_search_term IS NULL OR
             b.name ILIKE '%' || p_search_term || '%' OR
             b.description ILIKE '%' || p_search_term || '%' OR
             b.location ILIKE '%' || p_search_term || '%' OR
             b.category ILIKE '%' || p_search_term || '%' OR
             b.short_description ILIKE '%' || p_search_term || '%' OR
             b.address ILIKE '%' || p_search_term || '%')
        AND (p_category IS NULL OR b.category = p_category)
        AND (NOT p_verified_only OR b.is_verified = TRUE)
        AND b.is_visible_on_platform = TRUE
    ORDER BY ST_Distance(
        ST_MakePoint(b.longitude, b.latitude)::geography,
        ST_MakePoint(p_longitude, p_latitude)::geography
    );
END;
$$;