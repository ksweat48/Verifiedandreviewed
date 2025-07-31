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
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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
    console.log('🔍 Query Embedding for:', query, ':', JSON.stringify(queryEmbedding));

    // Initialize Supabase client
    console.log('🗄️ Initializing Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Perform semantic search using the RPC function
    console.log('🔍 Performing semantic search...');
    console.log('🎯 Match threshold:', matchThreshold);
    console.log('🎯 Match count:', matchCount);
    
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_businesses_by_vibe',
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: Math.min(matchCount, 20) // Cap at 20 for performance
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

    // Enrich search results with full business details
    let enrichedResults = [];
    if (searchResults && searchResults.length > 0) {
      console.log('🔄 Enriching search results with full business details...');
      
      // Extract business IDs from search results
      const businessIds = searchResults.map(result => result.id);
      
      // Fetch full business details for these IDs
      const { data: fullBusinessDetails, error: detailsError } = await supabase
        .from('businesses')
        .select('*')
        .in('id', businessIds);
      
      if (detailsError) {
        console.error('❌ Error fetching full business details:', detailsError);
        // Fall back to original search results if enrichment fails
        enrichedResults = searchResults;
      } else {
        console.log('✅ Fetched full details for', fullBusinessDetails?.length || 0, 'businesses');
        
        // Fetch reviews for all platform businesses in a single batch query
        let allBusinessReviews = [];
        if (fullBusinessDetails && fullBusinessDetails.length > 0) {
          console.log('📦 Batch fetching reviews for', fullBusinessDetails.length, 'platform businesses from semantic search');
          
          const { data: reviewsData, error: reviewsError } = await supabase
            .from('user_reviews')
            .select(`
              *,
              profiles!inner (
                id,
                name,
                avatar_url
              )
            `)
            .in('business_id', businessIds)
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
          
          if (reviewsError) {
            console.error('❌ Error fetching reviews for semantic search businesses:', reviewsError);
          } else {
            allBusinessReviews = reviewsData || [];
            console.log('✅ Fetched', allBusinessReviews.length, 'reviews for semantic search businesses');
          }
        }
        
        // Create a map of business ID to reviews for quick lookup
        const reviewsMap = new Map();
        allBusinessReviews.forEach(review => {
          if (!reviewsMap.has(review.business_id)) {
            reviewsMap.set(review.business_id, []);
          }
          reviewsMap.get(review.business_id).push(review);
        });
        
        // Create a map of business ID to full details for quick lookup
        const businessDetailsMap = new Map();
        if (fullBusinessDetails) {
          fullBusinessDetails.forEach(business => {
            businessDetailsMap.set(business.id, business);
          });
        }
        
        // Merge search results with full business details
        enrichedResults = searchResults.map(searchResult => {
          const fullDetails = businessDetailsMap.get(searchResult.id);
          if (fullDetails) {
            // Get reviews for this business
            const businessReviews = reviewsMap.get(searchResult.id) || [];
            
            // Transform reviews to match expected format
            const formattedReviews = businessReviews.map(review => ({
              text: review.review_text || 'No review text available',
              author: review.profiles?.name || 'Anonymous',
              authorImage: review.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100',
              images: (review.image_urls || []).map(url => ({ url })),
              thumbsUp: review.rating >= 4
            }));
            
            // Merge full details with search result, preserving similarity score
            return {
              ...fullDetails,
              similarity: searchResult.similarity,
              reviews: formattedReviews
            };
          } else {
            // Fall back to search result if full details not found
            console.warn(`⚠️ Full details not found for business ID: ${searchResult.id}`);
            return {
              ...searchResult,
              reviews: []
            };
          }
        });
        
        console.log('✅ Successfully enriched', enrichedResults.length, 'business results with full details and reviews');
      }
    } else {
      enrichedResults = searchResults || [];
    }
    // Transform results to match expected format
    const formattedResults = enrichedResults.map(business => ({
      // Spread all business properties to ensure complete data flow
      ...business,
      image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      latitude: business.latitude || null,
      longitude: business.longitude || null,
      address: business.address || null,
      name: business.name || null,
      rating: {
        thumbsUp: business.thumbs_up || 0,
        thumbsDown: business.thumbs_down || 0,
        sentimentScore: business.sentiment_score || 0
      },
      isPlatformBusiness: true,
      isOpen: true, // Default to open since we don't have real-time status
      distance: 999999, // Will be calculated accurately below
      duration: 999999, // Will be calculated accurately below
      reviews: business.reviews || [], // Reviews are now included from the enrichment process
      similarity: business.similarity || 0
    }));

    // Calculate accurate distances if we have user location and businesses with coordinates
    if (formattedResults.length > 0 && latitude && longitude) {
      try {
        console.log('📏 Calculating accurate distances for', formattedResults.length, 'platform businesses');
        
        // Prepare businesses with coordinates for distance calculation
        const businessesWithCoords = formattedResults.filter(business => 
          business.latitude && business.longitude
        );
        
        if (businessesWithCoords.length > 0) {
          // Prepare data for distance calculation API
          const origin = {
            latitude: latitude,
            longitude: longitude
          };
          
          const destinations = businessesWithCoords.map(business => ({
            latitude: business.latitude,
            longitude: business.longitude,
            businessId: business.id
          }));
          
          // Call distance calculation function
          const axios = (await import('axios')).default;
          const distanceResponse = await axios.post(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/get-business-distances`, {
            origin,
            destinations
          }, {
            timeout: 15000
          });
          
          if (distanceResponse.data.success) {
            // Create a map of business ID to distance data
            const distanceMap = new Map();
            distanceResponse.data.results.forEach(result => {
              distanceMap.set(result.businessId, {
                distance: result.distance,
                duration: result.duration
              });
            });
            
            // Update businesses with accurate distances
            const updatedResults = formattedResults.map(business => {
              const distanceData = distanceMap.get(business.id);
              if (distanceData) {
                return {
                  ...business,
                  distance: distanceData.distance,
                  duration: distanceData.duration
                };
              } else {
                // Business without coordinates - mark as very far
                return {
                  ...business,
                  distance: 999999,
                  duration: 999999
                };
              }
            });
            
            // Use the updated results for the final response
            const finalResults = updatedResults;
            
            console.log('✅ Updated platform businesses with accurate distances');
            
            return {
              statusCode: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: true,
                results: finalResults,
                query: query,
                matchCount: finalResults.length,
                usedSemanticSearch: true,
                matchThreshold: matchThreshold,
                timestamp: new Date().toISOString()
              })
            };
          } else {
            console.warn('⚠️ Distance calculation failed for platform businesses');
          }
        }
      } catch (distanceError) {
        console.error('❌ Distance calculation error for platform businesses:', distanceError.message);
      }
    } else {
      console.log('⚠️ No user location or platform businesses with coordinates for distance calculation');
    }

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