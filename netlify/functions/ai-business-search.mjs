// AI Business Search Function with Google Places API Integration
import OpenAI from 'openai';
import axios from 'axios';

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
    const { prompt, searchQuery, existingResultsCount = 0, numToGenerate = 3 } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 AI Business Search Request:', { prompt, searchQuery, existingResultsCount, numToGenerate });

    // Check if required API keys are configured
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
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

    // Enhanced system prompt for dynamic business suggestions
    const systemPrompt = `You are a local business discovery assistant. Generate exactly ${numToGenerate} business suggestions that match the user's query. Match tone and intent of search.

CRITICAL: Use the generateBusinessResults function. Do not return raw JSON or explanations.

Requirements:
• Realistic business names and addresses in major US cities
• Set image to null
• shortDescription: exactly 2 sentences, 40-60 words
• 1 review per business (40-60 words)
• Distance: 1-5 miles, Duration: 5-15 minutes
• Leave tags array empty
• Generate exactly ${numToGenerate} businesses
• Use real-sounding business names that could exist`;

    // Define function schema for OpenAI function calling
    const tools = [{
      type: "function",
      function: {
        name: "generateBusinessResults",
        description: "Generate business suggestions matching the search query",
        parameters: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Unique identifier" },
                  name: { type: "string", description: "Realistic business name" },
                  shortDescription: { type: "string", description: "2 sentences, 40-60 words" },
                  rating: { type: "number", minimum: 1, maximum: 5, description: "Placeholder rating (will be replaced by Google's real rating)" },
                  image: { type: "null" },
                  isOpen: { type: "boolean" },
                  hours: { type: "string", description: "Operating hours" },
                  address: { type: "string", description: "Full street address in major US city" },
                  distance: { type: "number", minimum: 1.0, maximum: 5.0 },
                  duration: { type: "integer", minimum: 5, maximum: 15 },
                  reviews: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        author: { type: "string" },
                        thumbsUp: { type: "boolean" }
                      },
                      required: ["text", "author", "thumbsUp"]
                    },
                    minItems: 1,
                    maxItems: 1
                  },
                  tags: { type: "array", items: {}, maxItems: 0 }
                },
                required: ["id", "name", "shortDescription", "address", "hours", "image", "isOpen", "distance", "duration", "reviews", "tags", "rating"]
              },
              minItems: numToGenerate,
              maxItems: numToGenerate
            }
          },
          required: ["results"]
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
      tool_choice: { type: "function", function: { name: "generateBusinessResults" } },
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 800
    });

    // Extract the function call result
    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'generateBusinessResults') {
      throw new Error('No valid function call returned from OpenAI');
    }

    const functionArgs = toolCall.function.arguments;
    console.log('📝 OpenAI function arguments:', functionArgs?.substring(0, 200) + '...');
    
    // Parse the JSON response
    let aiSuggestedBusinesses;
    try {
      const parsed = JSON.parse(functionArgs);
      
      if (parsed.results && Array.isArray(parsed.results)) {
        aiSuggestedBusinesses = parsed.results;
      } else if (Array.isArray(parsed)) {
        aiSuggestedBusinesses = parsed;
      } else {
        throw new Error('Invalid response format');
      }
      
      console.log('✅ Parsed AI suggestions:', aiSuggestedBusinesses.length, 'businesses');
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
    if (!Array.isArray(aiSuggestedBusinesses)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid response format',
        message: 'AI response is not an array'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 Verifying businesses with Google Places API...');
    const verifiedBusinesses = [];

    // Verify each AI-suggested business with Google Places API
    for (let i = 0; i < aiSuggestedBusinesses.length; i++) {
      const aiBusiness = aiSuggestedBusinesses[i];
      
      // Ensure name and address exist for Google Places search
      if (!aiBusiness.name || !aiBusiness.address) {
        console.warn(`⚠️ AI Business ${i} missing name or address, skipping Google Places verification.`);
        continue;
      }
      
      try {
        // Construct Google Places API search query
        const placesSearchQuery = `${aiBusiness.name}, ${aiBusiness.address}`;
        const placesUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json`;
        
        console.log(`🔍 Searching Google Places for: ${placesSearchQuery}`);
        
        const placesResponse = await axios.get(placesUrl, {
          params: {
            input: placesSearchQuery,
            inputtype: 'textquery',
            fields: 'name,formatted_address,rating,opening_hours,place_id',
            key: GOOGLE_PLACES_API_KEY
          },
          timeout: 10000 // 10 second timeout
        });
        
        if (placesResponse.data.status === 'OK' && 
            placesResponse.data.candidates && 
            placesResponse.data.candidates.length > 0) {
          
          const candidate = placesResponse.data.candidates[0];
          
          // CRITICAL: Only include businesses that have a rating
          if (candidate.rating) {
            console.log(`✅ Found verified business: ${candidate.name} (${candidate.rating} stars)`);
            
            // Parse opening hours from Google
            let businessHours = aiBusiness.hours; // Fallback to AI's generated hours
            let isOpen = aiBusiness.isOpen; // Fallback to AI's generated status
            
            if (candidate.opening_hours && candidate.opening_hours.weekday_text) {
              // Use today's hours or first available
              businessHours = candidate.opening_hours.weekday_text[0] || businessHours;
              // You could also check opening_hours.open_now if available
              isOpen = candidate.opening_hours.open_now !== undefined ? candidate.opening_hours.open_now : isOpen;
            }
            
            const verifiedBusiness = {
              id: aiBusiness.id,
              name: candidate.name, // Use Google's verified name
              shortDescription: aiBusiness.shortDescription, // Keep AI's description
              address: candidate.formatted_address, // Use Google's formatted address
              rating: candidate.rating, // Use Google's real rating
              image: null,
              isOpen: isOpen,
              hours: businessHours,
              distance: aiBusiness.distance,
              duration: aiBusiness.duration,
              reviews: aiBusiness.reviews, // Keep AI's generated reviews
              isPlatformBusiness: false,
              tags: aiBusiness.tags,
              isGoogleVerified: true // Flag to indicate Google verification
            };
            
            verifiedBusinesses.push(verifiedBusiness);
          } else {
            console.warn(`⚠️ Business found on Google but no rating available: ${candidate.name || aiBusiness.name}, discarding.`);
          }
        } else {
          console.warn(`⚠️ No Google Places match found for: ${placesSearchQuery}, discarding.`);
        }
      } catch (placesError) {
        console.error(`❌ Google Places API error for ${aiBusiness.name}:`, placesError.message);
        // Discard business if Google Places API call fails
      }
    }

    console.log('🎯 Final verified results:', verifiedBusinesses.length, 'businesses');

    return new Response(JSON.stringify({
      success: true,
      results: verifiedBusinesses, // Return only Google-verified results
      query: searchQuery,
      usedAI: true,
      googleVerified: true,
      aiSuggested: aiSuggestedBusinesses.length,
      googleVerifiedCount: verifiedBusinesses.length,
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