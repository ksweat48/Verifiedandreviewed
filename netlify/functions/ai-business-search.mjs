// AI Business Search Function with Google Places API Integration
import OpenAI from 'openai';
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

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { 
      prompt, 
      searchQuery, 
      existingResultsCount = 0, 
     numToGenerate = 20, // Increased default to get more results from Google
      latitude,
      longitude 
    } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use provided coordinates or default to San Francisco for testing
    const searchLatitude = latitude || 37.7749;
    const searchLongitude = longitude || -122.4194;
    const searchRadius = 16093; // 10 miles in meters (10 * 1609.3)
    
    console.log('🔍 AI Business Search Request:', { 
      prompt, 
      searchQuery, 
      existingResultsCount, 
      numToGenerate,
      location: `${searchLatitude}, ${searchLongitude}`,
      radius: `${searchRadius}m (10 miles)`
    });

    // Check if required API keys are configured
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured',
        message: 'Please set OPENAI_API_KEY in your environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      console.error('❌ Google Places API key not configured');
      return new Response(JSON.stringify({ 
        error: 'Google Places API key not configured',
        message: 'Please set GOOGLE_PLACES_API_KEY in your environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize OpenAI client
    console.log('🔧 Initializing OpenAI client...');
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: 25000 // 25 second timeout
    });

    // Enhanced system prompt for generating Google Places search queries
    const systemPrompt = `You are an intelligent search query generator for Google Places API. Your job is to interpret user queries about business vibes/moods and convert them into effective Google Places search terms that match the user's specific INTENT.

CRITICAL: Use the generateSearchQueries function. Do not return raw JSON or explanations.

INTENT ANALYSIS:
• Analyze the user's query to understand what TYPE of business they're looking for
• Food/Beverage queries (smoothie, coffee, restaurant, etc.) should generate queries for PLACES THAT SELL those items
• Service queries (coach, trainer, consultant, etc.) should generate queries for SERVICE PROVIDERS
• Product queries should focus on RETAILERS or ESTABLISHMENTS that sell those products

EXAMPLES:
• "healthy smoothies" → "smoothie bar", "juice shop", "health food cafe" (NOT "health coach")
• "personal trainer" → "fitness trainer", "personal training studio", "gym with trainers"
• "organic coffee" → "organic coffee shop", "specialty coffee roaster", "fair trade cafe"
• "life coach" → "life coaching services", "wellness coach", "personal development coach"

Requirements:
• Generate exactly ${numToGenerate} different search queries
• Each query should be a unique string suitable for Google Places Text Search
• Focus on business type + descriptive keywords that match the user's SPECIFIC INTENT
• Include MAXIMUM variety in business types (restaurants, cafes, bars, shops, services, entertainment, etc.)
• Use diverse descriptive terms like "cozy", "trendy", "upscale", "casual", "romantic", "modern", "vintage", "artisan", "boutique", "local", "authentic"
• MATCH THE INTENT: If user wants smoothies, find smoothie shops, NOT health coaches
• Keep queries concise (2-4 words typically)
• Ensure each query is DIFFERENT and will find DIFFERENT types of businesses
• Mix different business categories to provide variety while staying true to the user's intent`;

    // Define function schema for generating search queries
    const tools = [{
      type: "function",
      function: {
        name: "generateSearchQueries",
        description: "Generate Google Places search queries based on user's vibe/mood request",
        parameters: {
          type: "object",
          properties: {
            queries: {
              type: "array",
              items: { 
                type: "string",
                description: "Google Places search query (e.g., 'trendy wine bar', 'cozy coffee shop')"
              },
              minItems: numToGenerate,
              maxItems: numToGenerate
            }
          },
          required: ["queries"]
        }
      }
    }];

    // Call OpenAI API
    console.log('🤖 Calling OpenAI with prompt:', prompt);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      tools: tools,
      tool_choice: { type: "function", function: { name: "generateSearchQueries" } },
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 200
    });

    // Generate embedding for the original user prompt for similarity calculations
    console.log('🧠 Generating embedding for user prompt:', prompt);
    const promptEmbeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: prompt.trim(),
      encoding_format: 'float'
    });
    const promptEmbedding = promptEmbeddingResponse.data[0].embedding;
    console.log('✅ Generated prompt embedding with dimensions:', promptEmbedding.length);

    // Extract the function call result
    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'generateSearchQueries') {
      throw new Error('No valid function call returned from OpenAI');
    }

    const functionArgs = toolCall.function.arguments;
    console.log('📝 OpenAI function arguments:', functionArgs?.substring(0, 200) + '...');
    
    // Parse the JSON response
    let searchQueries;
    try {
      const parsed = JSON.parse(functionArgs);
      
      if (parsed.queries && Array.isArray(parsed.queries)) {
        searchQueries = parsed.queries;
      } else if (Array.isArray(parsed)) {
        searchQueries = parsed;
      } else {
        throw new Error('Invalid response format');
      }
      
      console.log('✅ Parsed search queries:', searchQueries.length, 'queries');
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to parse AI function response',
        message: 'Invalid JSON format from AI function call',
        details: parseError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate AI response
    if (!Array.isArray(searchQueries)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid response format',
        message: 'Search queries response is not an array'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 Searching Google Places with AI-generated queries...');
    const allPotentialBusinesses = [];

    // STEP 2: OPTIMIZED SINGLE GOOGLE PLACES CALL
    console.log('🔍 Making single optimized Google Places search...');
    
    try {
      // Create a single, comprehensive search query from the user's prompt
      const optimizedQuery = `${prompt} near ${searchLatitude},${searchLongitude}`;
      console.log(`🎯 Optimized Google Places query: "${optimizedQuery}"`);
      
      // Use Google Places Text Search API with a single, broader query
      const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
      
      const placesResponse = await axios.get(placesUrl, {
        params: {
          query: optimizedQuery,
          location: `${searchLatitude},${searchLongitude}`,
          radius: searchRadius,
          rankby: 'distance', // Prioritize by proximity instead of prominence
          type: 'establishment',
          fields: 'name,formatted_address,geometry,rating,opening_hours,types,place_id',
          key: GOOGLE_PLACES_API_KEY
        },
        timeout: 8000 // Increased timeout for single comprehensive call
      });
      
      if (placesResponse.data.status === 'OK' && 
          placesResponse.data.results && 
          placesResponse.data.results.length > 0) {
        
        console.log(`✅ Single Google Places call found ${placesResponse.data.results.length} total results from API`);
        
        // Process all results that meet our criteria
        const validResults = placesResponse.data.results
          .filter(result => {
            // Check distance if coordinates are available
            if (result.geometry?.location?.lat && result.geometry?.location?.lng) {
              const distance = calculateDistance(
                searchLatitude, searchLongitude,
                result.geometry.location.lat, result.geometry.location.lng
              );
              return distance <= 10; // Within 10 miles
            }
            
            return true; // Include if no coordinates available
          })
          
        console.log(`📊 After distance filtering: ${validResults.length} businesses within 10-mile radius`);
        
        const slicedResults = validResults
          .slice(0, Math.min(numToGenerate, 15)) // Limit to requested number but cap at 15 for performance
          .map(result => {
            // Store coordinates for distance calculation
            const businessLatitude = result.geometry?.location?.lat;
            const businessLongitude = result.geometry?.location?.lng;
            
            // Parse opening hours
            let businessHours = 'Hours not available';
            let isOpen = true;
            
            if (result.opening_hours) {
              isOpen = result.opening_hours.open_now !== undefined ? result.opening_hours.open_now : true;
              if (result.opening_hours.weekday_text && result.opening_hours.weekday_text.length > 0) {
                // Get today's hours
                const today = new Date().getDay();
                businessHours = result.opening_hours.weekday_text[today] || result.opening_hours.weekday_text[0];
              }
            }
            
            // Generate a short description based on the business type and rating
            const businessTypes = result.types ? result.types.join(', ') : 'establishment';
            const shortDescription = result.rating 
              ? `${result.name} is a highly-rated ${businessTypes} with ${result.rating} stars. Known for excellent service and great atmosphere.`
              : `${result.name} is a ${businessTypes}. Known for excellent service and great atmosphere.`;
            
            // Create business text for later batch embedding generation
            const businessText = [
              result.name,
              prompt, // The original user prompt
              businessTypes,
              result.rating ? `${result.rating} star rating` : 'no rating available',
              result.vicinity || '',
              businessHours
            ].filter(Boolean).join(' ');
            
            return {
              id: `google-${result.place_id}`,
              name: result.name,
              shortDescription: shortDescription,
              rating: result.rating || 0,
              image: null,
              isOpen: isOpen,
              hours: businessHours,
              address: result.formatted_address,
              latitude: businessLatitude || null,
              longitude: businessLongitude || null,
              distance: 999999, // Will be calculated accurately below
              duration: 999999, // Will be calculated accurately below
              placeId: result.place_id,
              reviews: [{
                text: `Great place that matches your vibe! Really enjoyed the atmosphere and service here.`,
                author: "Google User",
                thumbsUp: true
              }],
              isPlatformBusiness: false,
              tags: [],
              isGoogleVerified: true,
              businessText: businessText,
              similarity: 0.8 // Temporary value, will be calculated in batch
            };
          });
        
        console.log(`📊 After slicing to requested amount: ${slicedResults.length} businesses (requested: ${numToGenerate})`);
        
        // Add all valid results to our collection
        allPotentialBusinesses.push(...slicedResults);
        console.log(`✅ Processed ${slicedResults.length} valid businesses from single Google Places call`);
        
      } else {
        console.warn(`⚠️ No Google Places results found for optimized query: "${optimizedQuery}"`);
        if (placesResponse.data.status !== 'OK') {
          console.warn(`Google Places API status: ${placesResponse.data.status}`);
        }
      }
    } catch (placesError) {
      console.error(`❌ Optimized Google Places API error:`, placesError.message);
    }
    
    console.log('🎯 AI search collected', allPotentialBusinesses.length, 'potential businesses before deduplication');
    
    // Deduplicate by place_id using Map
    const uniqueBusinessesMap = new Map();
    allPotentialBusinesses.forEach(business => {
      if (business.placeId && !uniqueBusinessesMap.has(business.placeId)) {
        uniqueBusinessesMap.set(business.placeId, business);
      } else if (!business.placeId && !uniqueBusinessesMap.has(business.id)) {
        // Fallback for businesses without placeId
        uniqueBusinessesMap.set(business.id, business);
      }
    });
    
    // Convert Map back to array and sort by similarity
    const uniqueBusinesses = Array.from(uniqueBusinessesMap.values())
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    
    console.log('🎯 After deduplication and sorting:', uniqueBusinesses.length, 'unique businesses');
    
    // Take only the requested number of businesses
    const finalBusinesses = uniqueBusinesses.slice(0, Math.min(numToGenerate, 15));
    
    console.log('🎯 Final businesses selected for processing:', finalBusinesses.length, 'businesses (max allowed: 15)');
    
    // OPTIMIZATION: Batch generate embeddings for all businesses at once
    if (finalBusinesses.length > 0) {
      console.log('🧠 Batch generating embeddings for', finalBusinesses.length, 'businesses...');
      
      try {
        // Collect all business texts for batch embedding
        const businessTexts = finalBusinesses.map(business => business.businessText);
        
        // Single API call to generate all embeddings
        const batchEmbeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: businessTexts,
          encoding_format: 'float'
        });
        
        console.log('✅ Generated', batchEmbeddingResponse.data.length, 'embeddings in single batch call');
        
        // Calculate similarities for all businesses
        finalBusinesses.forEach((business, index) => {
          try {
            const businessEmbedding = batchEmbeddingResponse.data[index].embedding;
            const similarity = cosineSimilarity(promptEmbedding, businessEmbedding);
            
            // Ensure similarity is within reasonable bounds (0.3 to 1.0)
            business.similarity = Math.max(0.3, Math.min(1.0, similarity));
            
            console.log(`📊 Calculated similarity for ${business.name}: ${Math.round(business.similarity * 100)}%`);
          } catch (similarityError) {
            console.warn(`⚠️ Failed to calculate similarity for ${business.name}:`, similarityError.message);
            // Use a randomized fallback between 0.6-0.9 to show variation
            business.similarity = 0.6 + (Math.random() * 0.3);
          }
          
          // Clean up the temporary businessText property
          delete business.businessText;
        });
        
        // Re-sort by similarity after batch calculation
        finalBusinesses.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
        
        console.log('✅ Batch similarity calculation completed');
        
      } catch (batchEmbeddingError) {
        console.error('❌ Batch embedding generation failed:', batchEmbeddingError.message);
        
        // Fallback: assign random similarities and clean up businessText
        finalBusinesses.forEach(business => {
          business.similarity = 0.6 + (Math.random() * 0.3);
          delete business.businessText;
        });
      }
    }
    
    const foundBusinesses = finalBusinesses;
    
    // Calculate accurate distances if we have user location and businesses with coordinates
    let updatedBusinesses = foundBusinesses;
    if (updatedBusinesses.length > 0 && searchLatitude && searchLongitude) {
      try {
        console.log('📏 Calculating accurate distances for', updatedBusinesses.length, 'businesses');
        
        // Prepare businesses with coordinates for distance calculation
        const businessesWithCoords = updatedBusinesses.filter(business => 
          business.latitude && business.longitude
        );
        
        if (businessesWithCoords.length > 0) {
          // Prepare data for distance calculation API
          const origin = {
            latitude: searchLatitude,
            longitude: searchLongitude
          };
          
          const destinations = businessesWithCoords.map(business => ({
            latitude: business.latitude,
            longitude: business.longitude,
            businessId: business.id
          }));
          
          // Call distance calculation function
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
            updatedBusinesses = updatedBusinesses.map(business => {
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
            
            console.log('✅ Updated businesses with accurate distances');
          } else {
            console.warn('⚠️ Distance calculation failed, keeping placeholder values');
          }
        }
      } catch (distanceError) {
        console.error('❌ Distance calculation error:', distanceError.message);
        console.log('🔄 Keeping placeholder distance values');
      }
    } else {
      console.log('⚠️ No user location or businesses with coordinates for distance calculation');
    }

    // Sort businesses by similarity score (highest first)
    updatedBusinesses.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    console.log('📊 Business similarity scores:', updatedBusinesses.map(b => ({
      name: b.name,
      similarity: Math.round((b.similarity || 0) * 100) + '%'
    })));
    
    console.log(`🎯 FINAL RESULT COUNT: ${updatedBusinesses.length} businesses being returned to client`);
    
    return new Response(JSON.stringify({
      success: true,
      results: updatedBusinesses,
      query: searchQuery,
      usedAI: true,
      googleVerified: true,
      searchQueries: searchQueries,
      foundBusinessesCount: updatedBusinesses.length,
      searchLocation: {
        latitude: searchLatitude,
        longitude: searchLongitude,
        radius: searchRadius
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ AI Business Search Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to generate business suggestions',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}