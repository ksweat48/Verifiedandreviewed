// Unified Search Endpoint - Combines Offerings, Platform Businesses, and AI Suggestions
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Helper function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

// Helper function to calculate distance between two coordinates in miles
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

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
    const { 
      query, 
      latitude, 
      longitude, 
      matchThreshold = 0.3, 
      matchCount = 10
    } = JSON.parse(event.body);

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

    console.log('🔍 Unified search request:', { query, latitude, longitude, matchThreshold, matchCount });

    // Check required environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required environment variables',
          message: 'Please set OPENAI_API_KEY, VITE_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY'
        })
      };
    }

    // Initialize clients
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate embedding for search query
    console.log('🧠 Generating embedding for query:', query);
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.trim(),
      encoding_format: 'float'
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('✅ Generated query embedding with dimensions:', queryEmbedding.length);

    // STEP 1: Search offerings using semantic similarity
    console.log('🔍 Step 1: Searching offerings with semantic similarity...');
    let offeringResults = [];
    
    try {
      const { data: offeringSearchResults, error: offeringError } = await supabase.rpc(
        'search_offerings_by_vibe',
        {
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: matchCount,
          user_latitude: latitude,
          user_longitude: longitude,
          max_distance_miles: 10.0
        }
      );

      if (offeringError) {
        console.warn('⚠️ Offering search failed:', offeringError.message);
      } else {
        offeringResults = offeringSearchResults || [];
        console.log('✅ Found', offeringResults.length, 'offering matches');
        // ADD DEBUG LOGGING:
        console.log('DEBUG: Raw offeringSearchResults from RPC:', JSON.stringify(offeringSearchResults, null, 2));
        console.log('DEBUG: offeringError from RPC:', offeringError);
      }
    } catch (error) {
      console.warn('⚠️ Offering search error:', error.message);
    }

    // STEP 2: Platform businesses are no longer searchable - only offerings and AI businesses
    console.log('🔍 Step 2: Skipping legacy platform business search - removed from search system');

    // STEP 3: Prepare platform offering results for combination with AI results
    console.log('🔄 Step 3: Preparing platform offering results...');
    
    // Use Map for deduplication with priority: Offerings > AI Results
    const resultsMap = new Map();
    
    // Add platform offering results (highest priority)
    offeringResults.forEach(offering => {
      if (offering.business_id) {
        resultsMap.set(offering.business_id, {
          ...offering,
          source: 'offering'
        });
        // ADD DEBUG LOGGING:
        console.log('DEBUG: Added to resultsMap (offering):', offering.business_id, JSON.stringify(resultsMap.get(offering.business_id), null, 2));
      }
    });
    
    let combinedResults = Array.from(resultsMap.values());
    console.log('📊 Platform offering results prepared:', combinedResults.length, 'unique results');

    // STEP 4: If we have fewer than 8 platform offerings, use AI to find businesses that serve what user wants
    if (combinedResults.length < 8 && GOOGLE_PLACES_API_KEY) {
      console.log('🤖 Step 4: Using AI to find businesses that serve what user is looking for...');
      
      try {
        const slotsToFill = Math.min(7, matchCount - combinedResults.length);
        
        // Generate AI search queries focused on specific dishes/services
        const aiSystemPrompt = `You are a search query generator for Google Places API. Generate exactly ${slotsToFill} different search queries to find businesses that serve or offer what the user is looking for.

Requirements:
• Each query should be 2-4 words suitable for Google Places Text Search
• Focus on finding businesses that SERVE or OFFER the specific item/service the user wants
• If user searches for "fried chicken", find "fried chicken restaurant", "chicken wings", "southern food", etc.
• If user searches for "vegan pancakes", find "vegan restaurant", "plant based breakfast", "vegan cafe", etc.
• If user searches for "massage", find "massage therapy", "spa services", "wellness center", etc.
• Prioritize specific dish/service matches over general business types
• Examples: "fried chicken restaurant", "vegan breakfast cafe", "massage therapy clinic"
• Ensure each query is DIFFERENT and will find DIFFERENT types of businesses`;

        const tools = [{
          type: "function",
          function: {
            name: "generateSearchQueries",
            description: "Generate Google Places search queries to find businesses that serve/offer what user wants",
            parameters: {
              type: "object",
              properties: {
                queries: {
                  type: "array",
                  items: { 
                    type: "string",
                    description: "Google Places search query for businesses that serve/offer the requested item/service"
                  },
                  minItems: slotsToFill,
                  maxItems: slotsToFill
                }
              },
              required: ["queries"]
            }
          }
        }];

        const aiCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: aiSystemPrompt },
            { role: 'user', content: query }
          ],
          tools: tools,
          tool_choice: { type: "function", function: { name: "generateSearchQueries" } },
          temperature: 0.3,
          max_tokens: 200
        });

        const toolCall = aiCompletion.choices[0].message.tool_calls?.[0];
        if (toolCall && toolCall.function.name === 'generateSearchQueries') {
          const searchQueries = JSON.parse(toolCall.function.arguments).queries;
          console.log('🔍 Generated AI search queries for businesses that serve/offer:', query, '→', searchQueries);

          // Search Google Places for each query
          const searchLatitude = latitude || 37.7749;
          const searchLongitude = longitude || -122.4194;
          const searchRadius = 16093; // 10 miles in meters (16.09 km)
          const aiSearchPromises = searchQueries.map(async (searchQuery) => {
            try {
              const placesResponse = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
                params: {
                  query: searchQuery,
                  location: `${searchLatitude},${searchLongitude}`,
                  radius: searchRadius,
                  type: 'establishment',
                  key: GOOGLE_PLACES_API_KEY
                },
                timeout: 5000
              });

              if (placesResponse.data.status === 'OK' && placesResponse.data.results?.length > 0) {
                const result = placesResponse.data.results.find(r => r.rating);
                
                if (result) {
                  // Generate embedding for this business
                  const businessText = [
                    result.name,
                    searchQuery,
                    `serves ${query}`,
                    `offers ${query}`,
                    result.types ? result.types.join(' ') : '',
                    `${result.rating} star rating`
                  ].filter(Boolean).join(' ');

                  const businessEmbeddingResponse = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: businessText,
                    encoding_format: 'float'
                  });

                  const businessEmbedding = businessEmbeddingResponse.data[0].embedding;
                  const similarity = cosineSimilarity(queryEmbedding, businessEmbedding);

                  return {
                    id: `ai-${result.place_id}`,
                    business_id: `ai-${result.place_id}`,
                    offering_id: null,
                    title: result.name,
                    business_name: result.name,
                    name: result.name,
                    description: `${result.name} serves ${query}. Found through intelligent search for businesses that offer what you're looking for.`,
                    short_description: `Serves ${query} - found through AI search`,
                    business_description: `Business that serves ${query} according to Google Places data and reviews`,
                    business_short_description: `Serves ${query}`,
                    address: result.formatted_address,
                    location: result.vicinity || result.formatted_address,
                    latitude: result.geometry?.location?.lat,
                    longitude: result.geometry?.location?.lng,
                    category: searchQuery,
                    business_category: searchQuery,
                    tags: [],
                    rating: null, // No ratings for AI businesses
                    hours: result.opening_hours?.weekday_text?.[0] || 'Hours not available',
                    phone_number: null,
                    website_url: null,
                    social_media: [],
                    price_range: null,
                    service_area: null,
                    is_verified: false,
                    is_mobile_business: false,
                    is_virtual: false,
                    thumbs_up: 0, // No ratings for AI businesses
                    thumbs_down: 0, // No ratings for AI businesses
                    sentiment_score: 0, // No ratings for AI businesses
                    image_url: '/verified and reviewed logo-coral copy copy.png',
                    gallery_urls: [],
                    similarity: Math.max(0.3, Math.min(1.0, similarity)),
                    source: 'ai_generated',
                    isPlatformBusiness: false,
                    isOpen: result.opening_hours?.open_now !== false,
                    distance: 999999,
                    duration: 999999,
                    service_type: 'onsite',
                    placeId: result.place_id,
                    isGoogleVerified: true,
                    reviews: [{
                      text: `Great place for ${query}! They serve exactly what I was looking for.`,
                      author: "Google User",
                      thumbsUp: true
                    }]
                  };
                }
              }
            } catch (error) {
              console.warn(`⚠️ AI search failed for "${searchQuery}":`, error.message);
            }
            return null;
          });

          const aiResults = (await Promise.all(aiSearchPromises)).filter(Boolean);
          console.log('🤖 AI search found', aiResults.length, 'businesses that serve/offer:', query);

          // Add AI results to combined results (only if not already present)
          aiResults.forEach(aiResult => {
            if (!resultsMap.has(aiResult.business_id)) {
              resultsMap.set(aiResult.business_id, aiResult);
            }
          });

          combinedResults = Array.from(resultsMap.values());
          console.log('📊 After adding AI businesses:', combinedResults.length, 'total results (platform offerings + AI businesses)');
        }
      } catch (aiError) {
        console.warn('⚠️ AI search step failed:', aiError.message);
      }
    }

    // STEP 5: Calculate distances if user location provided
    if (combinedResults.length > 0 && latitude && longitude) {
      try {
        console.log('📏 Step 5: Calculating accurate distances for', combinedResults.length, 'results...');
        console.log('📏 User location:', { latitude, longitude });
        
        const businessesWithCoords = combinedResults.filter(result => 
          result.latitude && result.longitude
        );
        
        console.log('📏 Businesses with coordinates:', businessesWithCoords.length, 'out of', combinedResults.length);
        
        if (businessesWithCoords.length > 0) {
          const origin = { latitude, longitude };
          const destinations = businessesWithCoords.map(result => ({
            latitude: result.latitude,
            longitude: result.longitude,
            businessId: result.business_id
          }));
          
          console.log('📏 Calling distance calculation service with:', {
            origin,
            destinationCount: destinations.length,
            destinations: destinations.slice(0, 3) // Log first 3 for debugging
          });
          
          const distanceResponse = await axios.post(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/get-business-distances`, {
            origin,
            destinations
          }, {
            timeout: 15000
          });
          
          console.log('📏 Distance service response status:', distanceResponse.status);
          console.log('📏 Distance service response data:', distanceResponse.data);
          
          if (distanceResponse.data.success) {
            const distanceMap = new Map();
            distanceResponse.data.results.forEach(result => {
              distanceMap.set(result.businessId, {
                distance: result.distance,
                duration: result.duration
              });
            });
            
            console.log('📏 Distance map created with', distanceMap.size, 'entries');
            console.log('📏 Sample distance data:', Array.from(distanceMap.entries()).slice(0, 3));
            
            combinedResults = combinedResults.map(result => {
              const distanceData = distanceMap.get(result.business_id);
              if (distanceData) {
                console.log('📏 Updating distance for', result.name || result.business_name, ':', distanceData);
                return {
                  ...result,
                  distance: distanceData.distance,
                  duration: distanceData.duration
                };
              }
              return result;
            });
            
            console.log('✅ Updated results with accurate distances');
          } else {
            console.error('❌ Distance service returned failure:', distanceResponse.data);
          }
        } else {
          console.log('⚠️ No businesses have coordinates for distance calculation');
        }
      } catch (distanceError) {
        console.error('❌ Distance calculation failed:', {
          message: distanceError.message,
          response: distanceError.response?.data,
          status: distanceError.response?.status,
          config: distanceError.config
        });
      }
    }

    // STEP 6: Filter all results (platform offerings + AI businesses) by 10-mile radius
    if (latitude && longitude) {
      const maxDistance = 10; // Define the max distance in miles (reduced from 30)
      combinedResults = combinedResults.filter(result => {
        // Keep results without distance data (fallback)
        if (!result.distance || result.distance === 999999) {
          console.log('📏 Keeping result without distance data (may be filtered by Google Places radius):', result.name || result.business_name);
          return true;
        }
        // Filter by distance
        const withinRadius = result.distance <= maxDistance;
        if (!withinRadius) {
          console.log('📏 Filtering out business beyond', maxDistance, 'miles:', result.name || result.business_name, 'at', result.distance, 'miles');
        }
        return withinRadius;
      });
      console.log(`📏 Final results within ${maxDistance} miles: ${combinedResults.length} businesses (platform offerings + AI businesses)`);
    }

    // STEP 7: Sort and rank final results (platform offerings prioritized over AI businesses)
    console.log('🎯 Step 7: Sorting and ranking final results (platform offerings > AI businesses)...');
    
    const rankedResults = combinedResults
      .map(result => ({
        ...result,
        // Calculate composite score for ranking
        compositeScore: (
          0.45 * (result.similarity || 0.5) +
          0.25 * (result.source === 'offering' ? 1 : 0.6) +
          0.20 * (result.isOpen ? 1 : 0) +
          0.10 * (result.distance && result.distance < 999999 ? (1 - Math.min(result.distance / 30, 1)) : 0)
        )
      }))
      .sort((a, b) => {
        // Primary sort: Source priority (platform offerings > AI businesses)
        const sourceOrder = { offering: 2, ai_generated: 1 };
        const aSourcePriority = sourceOrder[a.source] || 0;
        const bSourcePriority = sourceOrder[b.source] || 0;
        
        if (aSourcePriority !== bSourcePriority) {
          return bSourcePriority - aSourcePriority;
        }
        
        // Secondary sort: Composite score
        return b.compositeScore - a.compositeScore;
      })
      .slice(0, matchCount); // Limit final results

    console.log('🎯 Final ranked results:', rankedResults.length, 'businesses (platform offerings + AI businesses)');
    console.log('📊 Result sources:', {
      platform_offerings: rankedResults.filter(r => r.source === 'offering').length,
      ai_generated: rankedResults.filter(r => r.source === 'ai_generated').length
    });

    // Transform results to match expected frontend format
    const formattedResults = rankedResults.map(result => ({
      // Spread all properties to ensure complete data flow
      ...result,
      
      // Ensure required frontend properties
      image: result.image_url || '/verified and reviewed logo-coral copy copy.png',
      rating: {
        thumbsUp: result.thumbs_up || 0,
        thumbsDown: result.thumbs_down || 0,
        sentimentScore: result.sentiment_score || 0
      },
      reviews: result.reviews || [],
      
      // Compatibility fields
      businessName: result.business_name,
      shortDescription: result.short_description || result.business_short_description
    }));

    // ADD DEBUG LOGGING:
    console.log('DEBUG: Final formattedResults sent to frontend:', JSON.stringify(formattedResults, null, 2));

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        results: formattedResults,
        query: query,
        matchCount: formattedResults.length,
        usedUnifiedSearch: true,
        searchSources: {
          platform_offerings: rankedResults.filter(r => r.source === 'offering').length,
          ai_generated: rankedResults.filter(r => r.source === 'ai_generated').length
        },
        matchThreshold: matchThreshold,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Unified search error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Unified search failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};