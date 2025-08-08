/*
  # Create offerings table for dish/product/service search

  1. New Tables
    - `offerings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `title` (text, not null) - e.g., "Brown Stew Fish", "Shoe Repair"
      - `description` (text, optional) - detailed description
      - `tags` (text array, optional) - e.g., ["fish", "jamaican", "stew", "dinner"]
      - `image_url` (text, not null) - URL to approved image of the offering
      - `price` (numeric, optional)
      - `type` (text, not null) - 'dish', 'menu_item', 'product', 'service'
      - `is_available` (boolean, default true)
      - `embedding` (vector(1536), nullable) - for semantic search
      - `created_at` (timestamp with time zone, default now())
      - `updated_at` (timestamp with time zone, default now())

  2. Security
    - Enable RLS on `offerings` table
    - Add policy for public to read available offerings
    - Add policies for authenticated users to manage their own offerings

  3. Indexing
    - GIN index on tags column for array queries
    - IVFFlat index on embedding column for vector search

  4. Functions
    - `search_offerings_by_vibe` RPC function for semantic search
*/

-- Create the offerings table
CREATE TABLE IF NOT EXISTS public.offerings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    tags text[],
    image_url text NOT NULL,
    price numeric,
    type text NOT NULL CHECK (type IN ('dish', 'menu_item', 'product', 'service')),
    is_available boolean DEFAULT TRUE,
    embedding vector(1536),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add comments for clarity
COMMENT ON TABLE public.offerings IS 'Stores individual dishes, menu items, products, or services offered by businesses.';
COMMENT ON COLUMN public.offerings.embedding IS 'Vector embedding of the offering for semantic search.';

-- Enable RLS on the offerings table
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to available offerings
CREATE POLICY "Public can read available offerings"
ON public.offerings
FOR SELECT
TO public
USING (is_available = TRUE);

-- Policy: Allow authenticated users to insert their own offerings
CREATE POLICY "Authenticated users can create offerings"
ON public.offerings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_businesses WHERE business_id = public.offerings.business_id));

-- Policy: Allow authenticated users to update their own offerings
CREATE POLICY "Authenticated users can update their own offerings"
ON public.offerings
FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT user_id FROM public.user_businesses WHERE business_id = public.offerings.business_id));

-- Policy: Allow authenticated users to delete their own offerings
CREATE POLICY "Authenticated users can delete their own offerings"
ON public.offerings
FOR DELETE
TO authenticated
USING (auth.uid() IN (SELECT user_id FROM public.user_businesses WHERE business_id = public.offerings.business_id));

-- Add a GIN index on the tags column for efficient array querying
CREATE INDEX IF NOT EXISTS idx_offerings_tags ON public.offerings USING GIN (tags);

-- Add an IVFFlat index on the embedding column for vector similarity search
CREATE INDEX IF NOT EXISTS idx_offerings_embedding ON public.offerings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create the search_offerings_by_vibe RPC function
CREATE OR REPLACE FUNCTION public.search_offerings_by_vibe(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    offering_id uuid,
    business_id uuid,
    title text,
    description text,
    image_url text,
    type text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id AS offering_id,
        o.business_id,
        o.title,
        o.description,
        o.image_url,
        o.type,
        (o.embedding <#> query_embedding) * -1 AS similarity
    FROM
        public.offerings o
    WHERE
        o.is_available = TRUE
        AND o.embedding IS NOT NULL
        AND (o.embedding <#> query_embedding) * -1 > match_threshold
    ORDER BY
        o.embedding <#> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execution permissions to authenticated and public users
GRANT EXECUTE ON FUNCTION public.search_offerings_by_vibe(vector, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_offerings_by_vibe(vector, float, int) TO public;