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
          match_threshold: 0.1, // Lower threshold to include more platform offerings
          match_count: 30, // Get more candidates from database
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
        
        // DEBUG: Log raw RPC results with similarity scores
        console.log('🔍 DEBUG: Raw offering search results from RPC:');
        offeringResults.forEach((result, index) => {
          console.log(`  ${index + 1}. Offering ID: ${result.id}, Similarity: ${result.similarity?.toFixed(3)}, Title: "${result.title || 'NO TITLE'}", Business: "${result.business_name || 'NO BUSINESS'}"`);
        });
        
        // Keep ALL platform offerings - no similarity filtering
        console.log('✅ Keeping ALL platform offerings without similarity filtering:', offeringResults.length, 'offerings');
      }
    } catch (error) {
      console.warn('⚠️ Offering search error:', error.message);
    }

    // STEP 2: Prepare platform offering results for combination with AI results
    console.log('🔄 Step 2: Preparing platform offering results...');
    
    // Use Map for deduplication with priority: Offerings > AI Results
    const resultsMap = new Map();
    
    // Add platform offering results (highest priority)
    offeringResults.forEach(offering => {
      if (offering.business_id) {
        resultsMap.set(offering.business_id, {
          ...offering,
          source: 'offering'
        });
        console.log(`🔍 DEBUG: Added platform offering to results map: "${offering.title}" (ID: ${offering.id}, Business: ${offering.business_id}, Similarity: ${offering.similarity?.toFixed(3)}) - SOURCE: offering`);
      }
    });
    
    let combinedResults = Array.from(resultsMap.values());
    console.log('📊 Platform offering results prepared:', combinedResults.length, 'unique results');

    // STEP 3: If we have fewer than 8 platform offerings, use AI to find businesses that serve what user wants
    if (combinedResults.length < 8 && GOOGLE_PLACES_API_KEY) {
      console.log('🤖 Step 3: Using AI to find businesses that serve what user is looking for...');
      
      try {
        const slotsToFill = matchCount - combinedResults.length; // Fill remaining slots up to matchCount
        console.log('🤖 DEBUG: Slots to fill with AI results:', slotsToFill, '(out of', matchCount, 'total desired)');
        
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
          console.log('🤖 DEBUG: AI-generated queries:', searchQueries);

          // Search Google Places for each query
          const searchLatitude = latitude || 37.7749;
          const searchLongitude = longitude || -122.4194;
          const searchRadius = 16093; // 10 miles in meters (16.09 km)
          console.log('🗺️ DEBUG: Using search location:', { searchLatitude, searchLongitude, searchRadius });
          
          const aiSearchPromises = searchQueries.map(async (searchQuery) => {
            try {
              console.log('🔍 DEBUG: Searching Google Places for:', searchQuery);
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

              console.log('🔍 DEBUG: Google Places response for', searchQuery, ':', {
                status: placesResponse.data.status,
                resultCount: placesResponse.data.results?.length || 0,
                firstResult: placesResponse.data.results?.[0]?.name || 'None'
              });
              if (placesResponse.data.status === 'OK' && placesResponse.data.results?.length > 0) {
                const result = placesResponse.data.results.find(r => r.rating);
                
                if (result) {
                  // Fetch additional details including phone number
                  let phoneNumber = null;
                  try {
                    console.log('📞 Fetching phone number for AI business:', result.name);
                    const detailsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
                      params: {
                        place_id: result.place_id,
                        fields: 'formatted_phone_number,international_phone_number',
                        key: GOOGLE_PLACES_API_KEY
                      },
                      timeout: 3000
                    });
                    
                    if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
                      phoneNumber = detailsResponse.data.result.formatted_phone_number || 
                                   detailsResponse.data.result.international_phone_number;
                      console.log('✅ Found phone number for', result.name, ':', phoneNumber);
                    }
                  } catch (phoneError) {
                    console.warn('⚠️ Failed to fetch phone number for', result.name, ':', phoneError.message);
                  }
                  
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
                  
                  console.log('🤖 DEBUG: AI result similarity for', result.name, ':', similarity.toFixed(3));

                  // Only include AI results with reasonable similarity (0.3 threshold for AI results)
                  if (similarity < 0.3) {
                    console.log('🚫 DEBUG: Filtering out AI result with low similarity:', result.name, similarity.toFixed(3));
                    return null;
                  }

                  // Generate dynamic offering name based on what this business likely offers
                  console.log('🎯 Generating dynamic offering name for:', result.name);
                  let dynamicOfferingName = query; // Fallback to original query
                  
                  try {
                    const offeringNamePrompt = `Based on the user's search for "${query}" and this business "${result.name}" (types: ${result.types?.join(', ') || 'restaurant'}), generate ONE plausible menu item name that this business would likely offer related to the search.

Rules:
• Return ONLY the menu item name, nothing else
• Make it specific and appetizing (e.g., "Grilled Salmon Burger", "Atlantic Salmon Sandwich", "Blackened Salmon Patty")
• Consider the business type and name when crafting the item
• Keep it under 4 words
• Make it sound like something that would actually be on their menu

Examples:
- Search: "salmon burger" + Business: "Ocean Grill" → "Grilled Salmon Burger"
- Search: "vegan pizza" + Business: "Green Garden Cafe" → "Garden Veggie Pizza"
- Search: "chocolate cake" + Business: "Sweet Dreams Bakery" → "Triple Chocolate Cake"`;

                    const offeringNameResponse = await openai.chat.completions.create({
                      model: 'gpt-4o-mini',
                      messages: [
                        { role: 'user', content: offeringNamePrompt }
                      ],
                      temperature: 0.7,
                      max_tokens: 20
                    });

                    const generatedName = offeringNameResponse.choices[0].message.content?.trim();
                    if (generatedName && generatedName.length > 0 && generatedName.length < 50) {
                      dynamicOfferingName = generatedName;
                      console.log('✅ Generated dynamic offering name:', dynamicOfferingName);
                    } else {
                      console.warn('⚠️ Invalid generated offering name, using fallback');
                    }
                  } catch (offeringNameError) {
                    console.warn('⚠️ Failed to generate dynamic offering name:', offeringNameError.message);
                    // Keep fallback value
                  }
                  
                  return {
                    id: `ai-${result.place_id}`,
                    business_id: `ai-${result.place_id}`,
                    offering_id: null,
                    title: dynamicOfferingName, // Use the dynamically generated offering name
                    business_name: result.name,
                    name: result.name,
                    description: `${dynamicOfferingName} at ${result.name}. Found through intelligent search for businesses that offer what you're looking for.`,
                    short_description: `Serves ${dynamicOfferingName} - found through AI search`,
                    business_description: `Business that serves ${dynamicOfferingName} according to Google Places data and reviews`,
                    business_short_description: `Serves ${dynamicOfferingName}`,
                    address: result.formatted_address,
                    location: result.vicinity || result.formatted_address,
                    latitude: result.geometry?.location?.lat,
                    longitude: result.geometry?.location?.lng,
                    category: searchQuery,
                    business_category: searchQuery,
                    tags: [],
                    rating: null,
                    hours: result.opening_hours?.weekday_text?.[0] || 'Hours not available',
                    phone_number: phoneNumber,
                    website_url: null,
                    social_media: [],
                    price_range: null,
                    service_area: null,
                    is_verified: false,
                    is_mobile_business: false,
                    is_virtual: false,
                    thumbs_up: 0,
                    thumbs_down: 0,
                    sentiment_score: 0,
                    image_url: null, // No image for AI-generated businesses
                    gallery_urls: [],
                    source: 'ai_generated',
                    isAIGenerated: true, // Flag to identify AI-generated businesses
                    isPlatformBusiness: false,
                    isOpen: result.opening_hours?.open_now !== false,
                    distance: 999999,
                    duration: 999999,
                    service_type: 'onsite',
                    placeId: result.place_id,
                    isGoogleVerified: true,
                    price_cents: 0, // No price for AI-generated businesses
                    currency: 'USD',
                    similarity: similarity,
                    reviews: [{
                      text: `Great place for ${dynamicOfferingName}! They serve exactly what I was looking for.`,
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
          console.log('🤖 DEBUG: AI results details:', aiResults.map(r => ({ name: r.name, similarity: r.similarity?.toFixed(3) })));

          // Add AI results to combined results (only if not already present)
          aiResults.forEach(aiResult => {
            const existingEntry = resultsMap.get(aiResult.business_id);
            if (!existingEntry) {
              // No existing entry - safe to add AI result
              resultsMap.set(aiResult.business_id, aiResult);
              console.log('🤖 DEBUG: Added AI result to map:', aiResult.name, 'with similarity:', aiResult.similarity?.toFixed(3), '- SOURCE: ai_generated');
            } else if (existingEntry.source !== 'offering') {
              // Existing entry is not a platform offering - safe to replace
              resultsMap.set(aiResult.business_id, aiResult);
              console.log('🤖 DEBUG: Replaced non-platform entry with AI result:', aiResult.name, 'with similarity:', aiResult.similarity?.toFixed(3), '- SOURCE: ai_generated');
            } else {
              // Existing entry is a platform offering - DO NOT overwrite
              console.log('🚫 DEBUG: Skipping AI result to preserve platform offering:', existingEntry.title || existingEntry.name, 'for business:', aiResult.name);
            }
          });

          combinedResults = Array.from(resultsMap.values());
          console.log('📊 After adding AI businesses:', combinedResults.length, 'total results (platform offerings + AI businesses)');
        }
      } catch (aiError) {
        console.warn('⚠️ AI search step failed:', aiError.message);
      }
    }

    // STEP 4: Enrich platform offering results with full details
    if (combinedResults.length > 0) {
      console.log('🔄 Step 4: Enriching platform offering results with full details...');
      
      const platformOfferingResults = combinedResults.filter(result => result.source === 'offering');
      console.log('🔍 DEBUG: Platform offerings to enrich:', platformOfferingResults.length);
      
      if (platformOfferingResults.length > 0) {
        const offeringIds = platformOfferingResults.map(result => result.id);
        console.log('🔍 DEBUG: Offering IDs to enrich:', offeringIds);
        
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
          console.log('🔍 DEBUG: Full offerings fetched from database:', fullOfferings?.length || 0);
          fullOfferings?.forEach((offering, index) => {
            console.log(`  ${index + 1}. "${offering.title}" at "${offering.businesses?.name}" - Has image: ${!!offering.businesses?.image_url}, Has offering images: ${offering.offering_images?.length || 0}`);
          });
          
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
              
              console.log(`🔍 DEBUG: Enriching offering ${searchResult.id}:`);
              console.log(`  - Found full data: ${!!fullOffering}`);
              console.log(`  - Title: "${fullOffering?.title || 'MISSING'}"`);
              console.log(`  - Business name: "${fullOffering?.businesses?.name || 'MISSING'}"`);
              console.log(`  - Description: "${fullOffering?.description || 'MISSING'}"`);
              
              // Get primary image or fallback
              const primaryImage = fullOffering.offering_images?.find(img => img.is_primary && img.approved);
              const fallbackImage = fullOffering.offering_images?.find(img => img.approved);
              const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';
              
              console.log(`  - Final image URL: "${imageUrl}"`);
              console.log(`  - Price: ${fullOffering.price_cents || 0} cents`);

              // Transform to unified format
              return {
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
                isOpen: true,
                distance: searchResult.distance_miles || 999999,
                duration: 999999,
                
                // Compatibility fields
                name: business.name,
                image: imageUrl,
                category: business.category,
                short_description: business.short_description
              };
            } else {
              console.error(`❌ DEBUG: Full details not found for offering: ${searchResult.id} - This should not happen!`);
              console.error(`❌ DEBUG: Available offering IDs in map:`, Array.from(offeringsMap.keys()));
              return {
                ...searchResult,
                isPlatformBusiness: true,
                isOpen: true,
                distance: 999999,
                duration: 999999
              };
            }
          });

          console.log('✅ Successfully enriched', enrichedResults.length, 'offering results');
          enrichedResults.forEach((result, index) => {
            console.log(`  ${index + 1}. Final enriched result: "${result.title || 'NO TITLE'}" at "${result.business_name || 'NO BUSINESS'}" - Image: ${!!result.image}`);
          });

          // Replace platform offerings in combined results with enriched versions
          const aiResults = combinedResults.filter(result => result.source === 'ai_generated');
          combinedResults = [...enrichedResults, ...aiResults];
        }
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
            console.warn('⚠️ Distance calculation service failed:', distanceResponse.data);
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
    
    // DEBUG: Log all results before sorting with their source and key properties
    console.log('🔍 DEBUG: ALL RESULTS BEFORE SORTING (' + combinedResults.length + ' total):');
    combinedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ID: "${result.id || 'NO_ID'}", Source: "${result.source || 'NO_SOURCE'}", Name/Title: "${result.title || result.name || 'NO_NAME'}", Business: "${result.business_name || result.name || 'NO_BUSINESS'}", Similarity: ${result.similarity?.toFixed(3) || 'N/A'}, isPlatformBusiness: ${result.isPlatformBusiness || false}`);
    });
    
    // DEBUG: Log sources before ranking
    console.log('🔍 DEBUG: Sources before ranking:');
    combinedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. Source: "${result.source}", Name: "${result.title || result.name}", Similarity: ${result.similarity?.toFixed(3) || 'N/A'}`);
    });
    
    const rankedResults = combinedResults
      .map(result => ({
        ...result,
        // Calculate composite score for ranking
        compositeScore: (
          0.45 * (result.similarity || 0.5) +
          0.25 * (result.source === 'offering' ? 1 : 0.1) +
          0.20 * (result.isOpen ? 1 : 0) +
          0.10 * (result.distance && result.distance < 999999 ? (1 - Math.min(result.distance / 30, 1)) : 0)
        )
      }))
      .sort((a, b) => {
        // PRIMARY SORT: Source priority - platform offerings ALWAYS first
        const sourceOrder = { offering: 10000, ai_generated: 1 }; // Massive priority difference
        const aSourcePriority = sourceOrder[a.source] || 0;
        const bSourcePriority = sourceOrder[b.source] || 0;
        
        if (aSourcePriority !== bSourcePriority) {
          console.log(`🔍 DEBUG: PRIORITY SORT - A: "${a.title || a.name}" [${a.source}] (${aSourcePriority}) vs B: "${b.title || b.name}" [${b.source}] (${bSourcePriority}) - Winner: ${aSourcePriority > bSourcePriority ? 'A' : 'B'}`);
          return bSourcePriority - aSourcePriority;
        }
        
        // SECONDARY SORT: Within same source type, sort by composite score
        console.log(`🔍 DEBUG: COMPOSITE SORT (same source) - A: "${a.title || a.name}" (${a.compositeScore?.toFixed(3)}) vs B: "${b.title || b.name}" (${b.compositeScore?.toFixed(3)})`);
        return b.compositeScore - a.compositeScore;
      })
      .slice(0, matchCount); // Limit final results

    // DEBUG: Log final ranking results
    console.log('🔍 DEBUG: FINAL RANKED RESULTS (should show platform offerings first):');
    rankedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. [${result.source?.toUpperCase()}] "${result.title || result.name}" - Similarity: ${result.similarity?.toFixed(3) || 'N/A'}, Composite: ${result.compositeScore?.toFixed(3) || 'N/A'}, Business: "${result.business_name || result.name}"`);
    });

    // Calculate accurate source counts
    const finalSourceCounts = {
      platform_offerings: rankedResults.filter(r => r.source === 'offering').length,
      ai_generated: rankedResults.filter(r => r.source === 'ai_generated').length
    };
    
    console.log('🎯 Final ranked results:', rankedResults.length, 'businesses (platform offerings + AI businesses)');
    console.log('📊 Accurate result sources:', finalSourceCounts);
    
    // DEBUG: Log each final result with its source and key data
    console.log('🔍 DEBUG: Final results breakdown:');
    rankedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. [${result.source?.toUpperCase()}] "${result.title || result.name}" - Similarity: ${result.similarity?.toFixed(3) || 'N/A'}, Business: "${result.business_name || result.name}"`);
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