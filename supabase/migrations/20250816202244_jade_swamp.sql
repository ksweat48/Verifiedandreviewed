@@ .. @@
 /*
   # Add Search Offerings Function
 
   1. Database Functions
     - `search_offerings_by_vibe` - Semantic search function for offerings
   2. Security
     - Function accessible to authenticated users and service role
 */
 
+-- Drop existing function if it exists to avoid return type conflicts
+DROP FUNCTION IF EXISTS search_offerings_by_vibe(vector, double precision, integer);
+
 -- Create the search function for offerings
 CREATE OR REPLACE FUNCTION search_offerings_by_vibe(
   query_embedding vector(1536),
   match_threshold double precision,
   match_count integer
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
   business_description text,
   business_short_description text,
   business_location text,
   business_address text,
   business_latitude double precision,
   business_longitude double precision,
   business_phone_number text,
   business_website_url text,
   business_social_media text[],
   business_hours text,
   business_days_closed text,
   business_price_range text,
   business_service_area text,
   business_is_verified boolean,
   business_is_mobile boolean,
   business_is_virtual boolean,
   business_thumbs_up integer,
   business_thumbs_down integer,
   business_sentiment_score integer,
   business_image_url text,
   business_gallery_urls text[],
   similarity double precision
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
     b.id as business_id,
     b.name as business_name,
     b.category as business_category,
     b.description as business_description,
     b.short_description as business_short_description,
     b.location as business_location,
     b.address as business_address,
     b.latitude as business_latitude,
     b.longitude as business_longitude,
     b.phone_number as business_phone_number,
     b.website_url as business_website_url,
     b.social_media as business_social_media,
     b.hours as business_hours,
     b.days_closed as business_days_closed,
     b.price_range as business_price_range,
     b.service_area as business_service_area,
     b.is_verified as business_is_verified,
     b.is_mobile_business as business_is_mobile,
     b.is_virtual as business_is_virtual,
     b.thumbs_up as business_thumbs_up,
     b.thumbs_down as business_thumbs_down,
     b.sentiment_score as business_sentiment_score,
     b.image_url as business_image_url,
     b.gallery_urls as business_gallery_urls,
     (oe.embedding <=> query_embedding) * -1 as similarity
   FROM offerings o
   JOIN businesses b ON o.business_id = b.id
   JOIN offerings_embeddings oe ON o.id = oe.offering_id
   WHERE 
     o.status = 'active'
     AND b.is_visible_on_platform = true
     AND (oe.embedding <=> query_embedding) < (1 - match_threshold)
   ORDER BY oe.embedding <=> query_embedding
   LIMIT match_count;
 END;
 $$;