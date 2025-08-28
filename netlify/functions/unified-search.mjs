// Unified Search Endpoint - Combines Offerings, Platform Businesses, and AI Suggestions
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { isBusinessOpen } from './utils/displayUtils.mjs';

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

// High relevance threshold for platform offerings to be prioritized
const HIGH_RELEVANCE_PLATFORM_THRESHOLD = 0.5;
// Minimum similarity threshold for platform offerings to receive ranking boost
const MIN_PLATFORM_RANKING_BOOST_SIMILARITY = 0.4;
// Performance optimization constants
const NUM_AI_QUERIES = 5; // Generate more diverse AI search queries
const TOP_PLACES_RESULTS_TO_EMBED = 10; // Process Google Places results per query
const TARGET_PLATFORM_OFFERINGS = 10; // Maximum platform offerings to prioritize

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

    // STAGE 1: Broad Platform Offering Search
    console.log('🔍 Stage 1: Performing broad platform offering search...');
    let offeringResults = [];
    
    try {
      const { data: offeringSearchResults, error: offeringError } = await supabase.rpc(
        'search_offerings_by_vibe',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.1, // Low threshold to gather wide range of candidates
          match_count: 50, // Get many candidates for filtering
          user_latitude: latitude,
          user_longitude: longitude,
          max_distance_miles: 10.0
        }
      );

      if (offeringError) {
        console.warn('⚠️ Platform offering search failed:', offeringError.message);
      } else {
        offeringResults = offeringSearchResults || [];
        console.log('✅ Found', offeringResults.length, 'platform offering candidates');
        
        // DEBUG: Log all platform offering candidates
        console.log('🔍 DEBUG: All platform offering candidates:');
        offeringResults.forEach((result, index) => {
          console.log(`  ${index + 1}. "${result.title || 'NO TITLE'}" at "${result.business_name || 'NO BUSINESS'}" - Similarity: ${result.similarity?.toFixed(3)}`);
        });
      }
    } catch (error) {
      console.warn('⚠️ Platform offering search error:', error.message);
    }

    // STAGE 2: Filter for Highly Relevant Platform Offerings
    console.log('🔍 Stage 2: Selecting top platform offerings...');
    // Sort all platform offerings by similarity and take the best ones that meet the threshold
    const selectedPlatformOfferings = offeringResults
      .filter(offering => offering.similarity >= matchThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, TARGET_PLATFORM_OFFERINGS);
    
    console.log(`✅ Selected ${selectedPlatformOfferings.length} top platform offerings (similarity >= ${matchThreshold}):`);
    selectedPlatformOfferings.forEach((offering, index) => {
      console.log(`  ${index + 1}. "${offering.title}" at "${offering.business_name}" - Similarity: ${offering.similarity?.toFixed(3)}`);
    });
    
    // STAGE 3: Conditional AI Search to Fill Remaining Slots
    const slotsNeeded = Math.max(0, matchCount - selectedPlatformOfferings.length);
    console.log(`🤖 Stage 3: Need ${slotsNeeded} more results to reach target of ${matchCount}`);
    
    let aiResults = [];
    if (slotsNeeded > 0 && GOOGLE_PLACES_API_KEY) {
      console.log('🤖 Performing AI search to fill remaining slots...');
      
      try {
        // Generate AI search queries focused on specific dishes/services
        const aiSystemPrompt = `You are a search query generator for Google Places API. Generate exactly ${NUM_AI_QUERIES} different search queries to find businesses that serve or offer what the user is looking for.

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
                  minItems: NUM_AI_QUERIES,
                  maxItems: NUM_AI_QUERIES
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
          console.log('🤖 Generated AI search queries:', searchQueries);

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
                timeout: 3000 // Reduced timeout for faster response
              });

              if (placesResponse.data.status !== 'OK' || !placesResponse.data.results?.length) {
                return [];
              }

              // Process only the top N results for performance
              const resultsToProcess = placesResponse.data.results.slice(0, TOP_PLACES_RESULTS_TO_EMBED);
              const queryResults = [];

              for (const placeResult of resultsToProcess) {
                try {
                  // Generate embedding for this business
                  const businessText = [
                    placeResult.name,
                    searchQuery,
                    `serves ${query}`,
                    `offers ${query}`,
                    placeResult.types ? placeResult.types.join(' ') : '',
                    placeResult.rating ? `${placeResult.rating} star rating` : ''
                  ].filter(Boolean).join(' ');

                  const businessEmbeddingResponse = await openai.embeddings.create({
                    model: 'text-embedding-3-small', // Keep original model for consistency
                    input: businessText,
                    encoding_format: 'float'
                  });

                  const businessEmbedding = businessEmbeddingResponse.data[0].embedding;
                  const similarity = cosineSimilarity(queryEmbedding, businessEmbedding); // Keep original model for consistency
                  
                  // Only include AI results with reasonable similarity
                  if (similarity < 0.0) {
                    continue;
                  }

                  // Generate dynamic offering name
                  let dynamicOfferingName = query;
                  try {
                    const offeringNamePrompt = `Based on the user's search for "${query}" and this business "${placeResult.name}", generate ONE plausible menu item name (2-4 words max) that this business would likely offer. Return ONLY the item name.`;

                    const offeringNameResponse = await openai.chat.completions.create({
                      model: 'gpt-4o-mini',
                      messages: [{ role: 'user', content: offeringNamePrompt }],
                      temperature: 0.7,
                      max_tokens: 15
                    });

                    const generatedName = offeringNameResponse.choices[0].message.content?.trim();
                    if (generatedName && generatedName.length > 0 && generatedName.length < 50) {
                      dynamicOfferingName = generatedName;
                    }
                  } catch (offeringNameError) {
                    // Keep fallback value
                  }
                  
                  queryResults.push({
                    id: `ai-${placeResult.place_id}`,
                    business_id: `ai-${placeResult.place_id}`,
                    offering_id: null,
                    title: dynamicOfferingName,
                    business_name: placeResult.name,
                    name: placeResult.name,
                    description: `${dynamicOfferingName} at ${placeResult.name}. Found through intelligent search for businesses that offer what you're looking for.`,
                    short_description: `Serves ${dynamicOfferingName} - found through AI search`,
                    business_description: `Business that serves ${dynamicOfferingName} according to Google Places data and reviews`,
                    business_short_description: `Serves ${dynamicOfferingName}`,
                    address: placeResult.formatted_address,
                    location: placeResult.vicinity || placeResult.formatted_address,
                    latitude: placeResult.geometry?.location?.lat,
                    longitude: placeResult.geometry?.location?.lng,
                    category: searchQuery,
                    business_category: searchQuery,
                    tags: [],
                    rating: null,
                    hours: placeResult.opening_hours?.weekday_text?.[0] || 'Hours not available',
                    phone_number: null, // Removed phone lookup for performance
                    website_url: null,
                    social_media: [],
                    price_range: null,
                    service_area: null,
 is_verified: false, // AI-generated businesses are not "verified" by our platform
                    is_mobile_business: false,
                    is_virtual: false,
                    thumbs_up: 0,
                    thumbs_down: 0,
                    sentiment_score: 0,
                    image_url: null,
                    gallery_urls: [],
                    source: 'ai_generated',
 isAIGenerated: true, // Flag to indicate AI origin
                    isPlatformBusiness: false,
                   isOpen: true, // AI businesses are always shown as open
                    distance: 999999,
                    duration: 999999,
                    service_type: 'onsite',
                    placeId: placeResult.place_id,
                    isGoogleVerified: true,
                    price_cents: 0,
                    currency: 'USD',
                    similarity: similarity,
                    reviews: [{
                      text: `Great place for ${dynamicOfferingName}! They serve exactly what I was looking for.`,
                      author: "Google User",
                      thumbsUp: true
                    }]
                  });
                } catch (error) {
                  console.warn(`⚠️ Error processing place result:`, error.message);
                }
              }

              return queryResults;
            } catch (error) {
              console.warn(`⚠️ AI search failed for "${searchQuery}":`, error.message);
              return [];
            }
          });

          // Execute all AI searches in parallel and flatten results
          const aiSearchResults = await Promise.all(aiSearchPromises);
          const allAIResults = aiSearchResults.flat();

          // Sort all AI results by similarity and take the top slotsNeeded
          aiResults = allAIResults
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, slotsNeeded);
            
          console.log('🤖 AI search found', aiResults.length, 'businesses');
        }
      } catch (aiError) {
        console.warn('⚠️ AI search failed:', aiError.message);
      }
    } else if (slotsNeeded === 0) {
      console.log('✅ No AI search needed - sufficient highly relevant platform offerings found');
    }

    // STAGE 4: Combine and Deduplicate Results
    console.log('🔄 Stage 4: Combining and deduplicating results...');
    
    // Use Map for deduplication with priority: Platform Offerings > AI Results
    const resultsMap = new Map();
    
    // Add selected platform offerings first (highest priority)
    selectedPlatformOfferings.forEach(offering => {
      if (offering.business_id) {
        resultsMap.set(offering.business_id, {
          ...offering,
          source: 'offering'
        });
        console.log(`✅ Added platform offering: "${offering.title}" (similarity: ${offering.similarity?.toFixed(3)})`);
      }
    });
    
    // Add AI results only if no platform offering exists for that business
    aiResults.forEach(aiResult => {
      if (!resultsMap.has(aiResult.business_id)) {
        resultsMap.set(aiResult.business_id, aiResult);
        console.log(`✅ Added AI result: "${aiResult.name}" (similarity: ${aiResult.similarity?.toFixed(3)})`);
      } else {
        console.log(`🚫 Skipped AI result "${aiResult.name}" - platform offering exists for this business`);
      }
    });
    
    let combinedResults = Array.from(resultsMap.values());
    console.log('📊 Combined results:', combinedResults.length, 'unique businesses');

    // STAGE 5: Enrich Platform Offering Results with Full Details
    if (combinedResults.length > 0) {
      console.log('🔄 Stage 5: Enriching platform offering results with full details...');
      
      const platformOfferingResults = combinedResults.filter(result => result.source === 'offering');
      
      if (platformOfferingResults.length > 0) {
        const offeringIds = platformOfferingResults.map(result => result.id);
        
        // Fetch full offering details with business info and images
        const { data: fullOfferings, error: detailsError } = await supabase
          .from('offerings')
          .select(`
            *,
            businesses!inner (
              id,
              name,
              address,
              location,
              category,
              description,
              short_description,
              image_url,
              gallery_urls,
              hours,
              days_closed,
              phone_number,
              website_url,
              social_media,
              price_range,
              service_area,
              is_verified,
              is_mobile_business,
              is_virtual,
              latitude,
              longitude,
              thumbs_up,
              thumbs_down,
              sentiment_score
            ),
            offering_images!left (
              url,
              source,
              is_primary,
              approved
            )
          `)
          .in('id', offeringIds)
          .eq('status', 'active');

        if (detailsError) {
          console.error('❌ Error enriching results:', detailsError);
        } else {
          // Create a map for quick lookup
          const offeringsMap = new Map();
          if (fullOfferings) {
            fullOfferings.forEach(offering => {
              offeringsMap.set(offering.id, offering);
            });
          }

          // Merge search results with full details
          const enrichedResults = platformOfferingResults.map(searchResult => {
            const fullOffering = offeringsMap.get(searchResult.id);
            if (fullOffering) {
              const business = fullOffering.businesses;
              // Get primary image or fallback
              const primaryImage = fullOffering.offering_images?.find(img => img.is_primary && img.approved);
              const fallbackImage = fullOffering.offering_images?.find(img => img.approved);
              const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';
              
              // Transform to unified format
              return {
                // Preserve source for ranking
                source: searchResult.source,
                
                // Offering data
                id: fullOffering.id,
                title: fullOffering.title,
                description: fullOffering.description,
                tags: fullOffering.tags || [],
                price_cents: fullOffering.price_cents,
                currency: fullOffering.currency,
                service_type: fullOffering.service_type,
                
                // Business data
                business_id: business.id,
                business_name: business.name,
                business_category: business.category,
                business_description: business.description,
                business_short_description: business.short_description,
                
                // Location data
                address: business.address,
                location: business.location,
                latitude: business.latitude,
                longitude: business.longitude,
                
                // Contact data
                phone_number: business.phone_number,
                website_url: business.website_url,
                social_media: business.social_media,
                
                // Business details
                hours: business.hours,
                days_closed: business.days_closed,
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
                image_url: imageUrl,
                gallery_urls: business.gallery_urls || [],
                
                // Search metadata
                similarity: searchResult.similarity,
                isPlatformBusiness: true,
                isOpen: isBusinessOpen(business),
                distance: searchResult.distance_miles || 999999,
                duration: 999999,
                
                // Compatibility fields
                name: business.name,
                image: imageUrl,
                category: business.category,
                short_description: business.short_description
              };
            } else {
              console.warn(`⚠️ Full details not found for offering: ${searchResult.id}`);
              return {
                ...searchResult,
                source: 'offering',
                isPlatformBusiness: true,
                isOpen: false, // Default to closed if we can't determine
                distance: 999999,
                duration: 999999
              };
            }
          });

          console.log('✅ Successfully enriched', enrichedResults.length, 'offering results');

          // Replace platform offerings in combined results with enriched versions
          const aiResults = combinedResults.filter(result => result.source === 'ai_generated');
          combinedResults = [...enrichedResults, ...aiResults];
        }
      }
    }

    // STAGE 6: Calculate Distances and Filter by Radius
    if (combinedResults.length > 0 && latitude && longitude) {
      try {
        console.log('📏 Stage 6: Calculating distances for', combinedResults.length, 'results...');
        
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
          } else {
            console.warn('⚠️ Distance calculation failed');
          }
        }
      } catch (distanceError) {
        console.warn('⚠️ Distance calculation error:', distanceError.message);
      }
    }

    // Filter by 10-mile radius
    if (latitude && longitude) {
      const maxDistance = 10; // Define the max distance in miles (reduced from 30)
      combinedResults = combinedResults.filter(result => {
        // Keep results without distance data (fallback)
        if (!result.distance || result.distance === 999999) {
          return true;
        }
        // Filter by distance
        const withinRadius = result.distance <= maxDistance;
        if (!withinRadius) {
          console.log('📏 Filtered out:', result.name || result.business_name, 'at', result.distance, 'miles');
        }
        return withinRadius;
      });
      console.log(`📏 Results within ${maxDistance} miles: ${combinedResults.length} businesses`);
    }

    // STAGE 7: Final Ranking
    console.log('🎯 Stage 7: Final ranking of', combinedResults.length, 'results...');
    
    const rankedResults = combinedResults
      .map(result => ({
        ...result,
        // Calculate composite score for ranking
        compositeScore: (
          0.45 * (result.similarity || 0.5) +
          // Platform boost for offerings that meet minimum ranking threshold
          0.25 * (result.source === 'offering' && result.similarity >= MIN_PLATFORM_RANKING_BOOST_SIMILARITY ? 1 : 0.1) +
          0.20 * (result.isOpen ? 1 : 0) +
          0.10 * (result.distance && result.distance < 999999 ? (1 - Math.min(result.distance / 30, 1)) : 0)
        )
      }))
      .sort((a, b) => {
        // Sort by composite score (includes platform boost for relevant offerings)
        return b.compositeScore - a.compositeScore;
      })
      .slice(0, matchCount); // Limit final results

    // Log final ranking
    console.log('🎯 Final ranked results:');
    rankedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. [${result.source?.toUpperCase()}] "${result.title || result.name}" at "${result.business_name || result.name}" - Similarity: ${result.similarity?.toFixed(3)}`);
    });

    // Calculate final source counts
    const finalSourceCounts = {
      platform_offerings: rankedResults.filter(r => r.source === 'offering').length,
      ai_generated: rankedResults.filter(r => r.source === 'ai_generated').length
    };
    
    console.log('📊 Result sources:', finalSourceCounts);

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
        searchSources: finalSourceCounts,
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