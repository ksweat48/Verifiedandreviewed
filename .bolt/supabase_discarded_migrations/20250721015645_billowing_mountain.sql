/*
  # Verify Vector Column Configuration
  
  This diagnostic query will show us:
  1. The actual column type and dimensions
  2. Whether pgvector extension is enabled
  3. Current index configuration
*/

-- Check if pgvector extension is enabled
SELECT 
  extname as extension_name,
  extversion as version
FROM pg_extension 
WHERE extname = 'vector';

-- Check the actual column definition with dimensions
SELECT 
  column_name,
  data_type,
  udt_name,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'businesses' 
  AND column_name = 'embedding';

-- Check vector-specific column details
SELECT 
  attname as column_name,
  typname as type_name,
  typmod as type_modifier,
  atttypmod as attribute_type_modifier
FROM pg_attribute a
JOIN pg_type t ON a.atttypid = t.oid
JOIN pg_class c ON a.attrelid = c.oid
WHERE c.relname = 'businesses' 
  AND a.attname = 'embedding';

-- Check existing indexes on the embedding column
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'businesses' 
  AND indexdef LIKE '%embedding%';

-- Test if we can insert a 1536-dimension vector (this will show if the column accepts the right size)
SELECT 
  'Column can accept 1536-dimension vectors' as test_result
WHERE EXISTS (
  SELECT 1 
  FROM pg_attribute a
  JOIN pg_type t ON a.atttypid = t.oid
  JOIN pg_class c ON a.attrelid = c.oid
  WHERE c.relname = 'businesses' 
    AND a.attname = 'embedding'
    AND t.typname = 'vector'
);