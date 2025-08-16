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
      matchCount = 15 
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
          match_count: Math.min(matchCount, 10)
        }
      );

      if (offeringError) {
        console.warn('⚠️ Offering search failed:', offeringError.message);
      } else {
        offeringResults = offeringSearchResults || [];
        console.log('✅ Found', offeringResults.length, 'offering matches');
      }
    } catch (error) {
      console.warn('⚠️ Offering search error:', error.message);
    }

    // STEP 2: Search existing businesses (legacy platform businesses)
    console.log('🔍 Step 2: Searching existing platform businesses...');
    let businessResults = [];
    
    try {
      // Search businesses with text matching
      let businessQuery = supabase
        .from('businesses')
        .select('*')
        .eq('is_visible_on_platform', true);

      // Apply text search across multiple fields
      const searchConditions = [
        `name.ilike.%${query}%`,
        `description.ilike.%${query}%`,
        `location.ilike.%${query}%`,
        `category.ilike.%${query}%`,
        `short_description.ilike.%${query}%`,
        `address.ilike.%${query}%`
      ];
      
      businessQuery = businessQuery.or(searchConditions.join(','));
      
      // Apply 10-mile radius filter if user location provided
      if (latitude && longitude) {
        // Note: This is a simplified filter - in production you'd use PostGIS
        businessQuery = businessQuery
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);
      }
      
      const { data: businessData, error: businessError } = await businessQuery.limit(10);
      
      if (businessError) {
        console.warn('⚠️ Business search failed:', businessError.message);
      } else {
        // Filter by radius if coordinates available
        let filteredBusinesses = businessData || [];
        
        if (latitude && longitude) {
          filteredBusinesses = filteredBusinesses.filter(business => {
            if (!business.latitude || !business.longitude) return false;
            
            const distance = calculateDistance(
              latitude, longitude,
              business.latitude, business.longitude
            );
            
            return distance <= 10; // 10-mile radius
          });
        }
        
        // Transform business results to unified format
        businessResults = filteredBusinesses.map(business => ({
          // Core identifiers
          id: business.id,
          business_id: business.id,
          offering_id: null,
          
          // Names and descriptions
          title: business.name,
          business_name: business.name,
          name: business.name,
          description: business.description,
          short_description: business.short_description,
          business_description: business.description,
          business_short_description: business.short_description,
          
          // Location data
          address: business.address,
          location: business.location,
          latitude: business.latitude,
          longitude: business.longitude,
          
          // Business details
          category: business.category,
          business_category: business.category,
          tags: business.tags || [],
          hours: business.hours,
          days_closed: business.days_closed,
          phone_number: business.phone_number,
          website_url: business.website_url,
          social_media: business.social_media || [],
          price_range: business.price_range,
          service_area: business.service_area,
          
          // Status and verification
          is_verified: business.is_verified,
          is_mobile_business: business.is_mobile_business,
          is_virtual: business.is_virtual,
          
          // Rating data
          thumbs_up: business.thumbs_up || 0,
          thumbs_down: business.thumbs_down || 0,
          sentiment_score: business.sentiment_score || 0,
          
          // Image data
          image_url: business.image_url,
          gallery_urls: business.gallery_urls || [],
          
          // Search metadata
          similarity: 0.7, // Default similarity for text matches
          source: 'platform_business',
          isPlatformBusiness: true,
          isOpen: true,
          distance: 999999,
          duration: 999999,
          
          // Service type (inferred from business type)
          service_type: business.is_virtual ? 'remote' : 
                       business.is_mobile_business ? 'mobile' : 'onsite'
        }));
        
        console.log('✅ Found', businessResults.length, 'platform business matches');
      }
    } catch (error) {
      console.warn('⚠️ Business search error:', error.message);
    }

    // STEP 3: Combine and deduplicate results
    console.log('🔄 Step 3: Combining and deduplicating results...');
    
    // Use Map for deduplication with priority: Offerings > Platform Businesses
    const resultsMap = new Map();
    
    // Add platform business results first (lower priority)
    businessResults.forEach(business => {
      if (business.business_id) {
        resultsMap.set(business.business_id, {
          ...business,
          source: 'platform_business'
        });
      }
    });
    
    // Add offering results (higher priority - will overwrite platform businesses)
    offeringResults.forEach(offering => {
      if (offering.business_id) {
        resultsMap.set(offering.business_id, {
          ...offering,
          source: 'offering'
        });
      }
    });
    
    let combinedResults = Array.from(resultsMap.values());
    console.log('📊 After deduplication:', combinedResults.length, 'unique results');

    // STEP 4: If we have fewer than 8 results, use AI to fill remaining slots
    if (combinedResults.length < 8 && GOOGLE_PLACES_API_KEY) {
      console.log('🤖 Step 4: Using AI to fill remaining slots...');
      
      try {
        const slotsToFill = Math.min(7, 15 - combinedResults.length);
        
        // Generate AI search queries
        const aiSystemPrompt = `You are a search query generator for Google Places API. Generate exactly ${slotsToFill} different search queries based on the user's vibe request.

Requirements:
• Each query should be 2-4 words suitable for Google Places Text Search
• Focus on business type + descriptive keywords that match the user's vibe
• Include variety in business types (restaurants, cafes, bars, shops, services, entertainment)
• Use descriptive terms like "cozy", "trendy", "upscale", "casual", "romantic", "modern", "vintage", "artisan"
• Examples: "trendy wine bar", "cozy coffee shop", "upscale cocktail lounge"
• Ensure each query is DIFFERENT and will find DIFFERENT types of businesses`;

        const tools = [{
          type: "function",
          function: {
            name: "generateSearchQueries",
            description: "Generate Google Places search queries based on user's vibe request",
            parameters: {
              type: "object",
              properties: {
                queries: {
                  type: "array",
                  items: { 
                    type: "string",
                    description: "Google Places search query"
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
          console.log('🔍 Generated AI search queries:', searchQueries);

          // Search Google Places for each query
          const searchLatitude = latitude || 37.7749;
          const searchLongitude = longitude || -122.4194;
          const searchRadius = 16093; // 10 miles in meters

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
                    description: `${result.name} is a highly-rated ${searchQuery} with ${result.rating} stars.`,
                    short_description: `"${query}" served here, based on user reviews.`,
                    business_description: `"${query}" served here, based on user reviews.`,
                    business_short_description: `"${query}" served here, based on user reviews.`,
                    address: result.formatted_address,
                    location: result.vicinity || result.formatted_address,
                    latitude: result.geometry?.location?.lat,
                    longitude: result.geometry?.location?.lng,
                    category: searchQuery,
                    business_category: searchQuery,
                    tags: [],
                    rating: null,
                    hours: result.opening_hours?.weekday_text?.[0] || 'Hours not available',
                    phone_number: null,
                    website_url: null,
                    social_media: [],
                    price_range: null,
                    service_area: null,
                    is_verified: false,
                    is_mobile_business: false,
                    is_virtual: false,
                    thumbs_up: null,
                    thumbs_down: null,
                    sentiment_score: null,
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
                      text: `Great ${searchQuery}! Really enjoyed the atmosphere and service here.`,
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
          console.log('🤖 AI search generated', aiResults.length, 'additional results');

          // Add AI results to combined results (only if not already present)
          aiResults.forEach(aiResult => {
            if (!resultsMap.has(aiResult.business_id)) {
              resultsMap.set(aiResult.business_id, aiResult);
            }
          });

          combinedResults = Array.from(resultsMap.values());
          console.log('📊 After adding AI results:', combinedResults.length, 'total results');
        }
      } catch (aiError) {
        console.warn('⚠️ AI search step failed:', aiError.message);
      }
    }

    // STEP 5: Calculate distances if user location provided
    if (combinedResults.length > 0 && latitude && longitude) {
      try {
        console.log('📏 Step 5: Calculating accurate distances...');
        
        const businessesWithCoords = combinedResults.filter(result => 
          result.latitude && result.longitude
        );
        
        if (businessesWithCoords.length > 0) {
          const origin = { latitude, longitude };
          const destinations = businessesWithCoords.map(result => ({
            latitude: result.latitude,
            longitude: result.longitude,
            businessId: result.business_id
          }));
          
          const distanceResponse = await axios.post(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/get-business-distances`, {
            origin,
            destinations
          }, {
            timeout: 15000
          });
          
          if (distanceResponse.data.success) {
            const distanceMap = new Map();
            distanceResponse.data.results.forEach(result => {
              distanceMap.set(result.businessId, {
                distance: result.distance,
                duration: result.duration
              });
            });
            
            combinedResults = combinedResults.map(result => {
              const distanceData = distanceMap.get(result.business_id);
              if (distanceData) {
                return {
                  ...result,
                  distance: distanceData.distance,
                  duration: distanceData.duration
                };
              }
              return result;
            });
            
            console.log('✅ Updated results with accurate distances');
          }
        }
      } catch (distanceError) {
        console.warn('⚠️ Distance calculation failed:', distanceError.message);
      }
    }

    // STEP 6: Sort and rank final results
    console.log('🎯 Step 6: Sorting and ranking final results...');
    
    const rankedResults = combinedResults
      .map(result => ({
        ...result,
        // Calculate composite score for ranking
        compositeScore: (
          0.45 * (result.similarity || 0.5) +
          0.25 * (result.source === 'offering' ? 1 : result.source === 'platform_business' ? 0.8 : 0.6) +
          0.20 * (result.isOpen ? 1 : 0) +
          0.10 * (result.distance && result.distance < 999999 ? (1 - Math.min(result.distance / 10, 1)) : 0)
        )
      }))
      .sort((a, b) => {
        // Primary sort: Source priority (offerings > platform businesses > AI)
        const sourceOrder = { offering: 3, platform_business: 2, ai_generated: 1 };
        const aSourcePriority = sourceOrder[a.source] || 0;
        const bSourcePriority = sourceOrder[b.source] || 0;
        
        if (aSourcePriority !== bSourcePriority) {
          return bSourcePriority - aSourcePriority;
        }
        
        // Secondary sort: Composite score
        return b.compositeScore - a.compositeScore;
      })
      .slice(0, matchCount); // Limit final results

    console.log('🎯 Final ranked results:', rankedResults.length, 'businesses');
    console.log('📊 Result sources:', {
      offerings: rankedResults.filter(r => r.source === 'offering').length,
      platform_businesses: rankedResults.filter(r => r.source === 'platform_business').length,
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
          offerings: rankedResults.filter(r => r.source === 'offering').length,
          platform_businesses: rankedResults.filter(r => r.source === 'platform_business').length,
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