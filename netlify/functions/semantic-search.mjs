// Semantic Vector Search Function for Vibe-Based Business Discovery
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { query, latitude, longitude, matchThreshold = 0.5, matchCount = 10 } = JSON.parse(event.body);

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Query is required',
          message: 'Please provide a valid search query'
        })
      };
    }

    console.log('🔍 Semantic search request:', { query, latitude, longitude });

    // Check required environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'OpenAI API key not configured',
          message: 'Please set OPENAI_API_KEY in your environment variables'
        })
      };
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Supabase credentials not configured',
          message: 'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables'
        })
      };
    }

    // Initialize OpenAI client
    console.log('🤖 Initializing OpenAI client...');
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: 15000
    });

    // Generate embedding for the search query
    console.log('🧠 Generating embedding for query:', query);
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Fast and cost-effective
      input: query.trim(),
      encoding_format: 'float'
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('✅ Generated embedding with dimensions:', queryEmbedding.length);

    // Initialize Supabase client
    console.log('🗄️ Initializing Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Perform semantic search using the RPC function
    console.log('🔍 Performing semantic search...');
    console.log('🎯 Match threshold:', matchThreshold);
    console.log('🎯 Match count:', matchCount);
    
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_businesses_by_vibe',
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount
      }
    );

    if (searchError) {
      console.error('❌ Supabase search error:', searchError);
      throw new Error(`Supabase search failed: ${searchError.message}`);
    }

    console.log('✅ Found', searchResults?.length || 0, 'semantic matches');
    if (searchResults && searchResults.length > 0) {
      console.log('📊 Sample result:', {
        name: searchResults[0].name,
        category: searchResults[0].category,
        similarity: searchResults[0].similarity,
        hasEmbedding: !!searchResults[0].embedding
      });
    }

    // Transform results to match expected format
    const formattedResults = (searchResults || []).map(business => ({
      id: business.id,
      name: business.name,
      description: business.description || business.short_description || '',
      location: business.location,
      address: business.address,
      category: business.category,
      tags: business.tags || [],
      image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      hours: business.hours || 'Hours not available',
      isVerified: business.is_verified || false,
      rating: {
        thumbsUp: business.thumbs_up || 0,
        thumbsDown: business.thumbs_down || 0,
        sentimentScore: business.sentiment_score || 0
      },
      similarity: business.similarity || 0,
      isPlatformBusiness: true,
      isOpen: true, // Default to open since we don't have real-time status
      distance: latitude && longitude ? 
        Math.round((Math.random() * 4 + 1) * 10) / 10 : // Placeholder until distance calculation
        undefined,
      duration: latitude && longitude ? 
        Math.floor(Math.random() * 10 + 5) : // Placeholder until distance calculation
        undefined,
      reviews: [] // Reviews would be fetched separately if needed
    }));

    // If no semantic matches found, provide helpful response
    if (formattedResults.length === 0) {
      console.log('⚠️ No semantic matches found for:', query);
      
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          results: [],
          query: query,
          message: 'No businesses found matching that vibe. Try a different search term.',
          suggestions: [
            'cozy coffee shop',
            'romantic dinner',
            'energetic workout',
            'peaceful brunch',
            'trendy bar'
          ],
          usedSemanticSearch: true,
          matchThreshold: matchThreshold,
          timestamp: new Date().toISOString()
        })
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        results: formattedResults,
        query: query,
        matchCount: formattedResults.length,
        usedSemanticSearch: true,
        matchThreshold: matchThreshold,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Semantic search error:', error);
    
    let errorMessage = error.message;
    let troubleshooting = [];

    if (error.message.includes('OpenAI')) {
      errorMessage = 'OpenAI API Error';
      troubleshooting = [
        'Check your OpenAI API key is valid',
        'Ensure you have sufficient OpenAI credits',
        'Verify the embedding model is accessible'
      ];
    } else if (error.message.includes('Supabase') || error.message.includes('pgvector')) {
      errorMessage = 'Database Error';
      troubleshooting = [
        'Ensure pgvector extension is enabled in Supabase',
        'Check that the businesses table has the embedding column',
        'Verify the search_businesses_by_vibe RPC function exists',
        'Ensure businesses have embeddings generated'
      ];
    }

    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Semantic search failed',
        message: errorMessage,
        troubleshooting: troubleshooting,
        originalError: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};