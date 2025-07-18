// AI Business Search Function
import OpenAI from 'openai';
import axios from 'axios';

export const handler = async (event, context) => {
  // Set function timeout context
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { prompt, searchQuery, existingResultsCount = 0, numToGenerate = 3 } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    console.log('🔍 AI Business Search Request:', { prompt, searchQuery, existingResultsCount, numToGenerate });
    // Check if OpenAI API key is configured
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'OpenAI API key not configured',
          message: 'Please set OPENAI_API_KEY in your environment variables'
        })
      };
    }

    if (!GOOGLE_PLACES_API_KEY) {
      console.error('❌ Google Places API key not configured');
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Google Places API key not configured',
          message: 'Please set GOOGLE_PLACES_API_KEY in your environment variables'
        })
      };
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
• Realistic business names and addresses
• Set image to null
• shortDescription: exactly 2 sentences, 40-60 words
• 1 review per business (40-60 words)
• Distance: 1-5 miles, Duration: 5-15 minutes
• Leave tags array empty
• Generate exactly ${numToGenerate} businesses`;

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
                  name: { type: "string", description: "Business name" },
                  shortDescription: { type: "string", description: "2 sentences, 40-60 words" },
                  rating: {
                    type: "object",
                    properties: {
                      thumbsUp: { type: "integer", minimum: 5, maximum: 50 },
                      thumbsDown: { type: "integer", minimum: 0, maximum: 10 },
                      sentimentScore: { type: "integer", minimum: 60, maximum: 95 }
                    },
                    required: ["thumbsUp", "thumbsDown", "sentimentScore"]
                  },
                  image: { type: "null" },
                  isOpen: { type: "boolean" },
                  hours: { type: "string", description: "Operating hours" },
                  address: { type: "string", description: "Full street address" },
                  distance: { type: "number", minimum: 1.0, maximum: 5.0 },
                  duration: { type: "integer", minimum: 5, maximum: 15 },
                  reviews: {
                    type: "array",
                    items: {
                      type: "object",
                    }
                    address: { type: "string", description: "Full street address with city and state" },
                    hours: { type: "string", description: "Operating hours" },
                    minItems: 1,
                    maxItems: 1
                  }
                  tags: { type: "array", items: {}, maxItems: 0 }
                },
                required: ["id", "name", "shortDescription", "address", "hours", "image", "isOpen", "distance", "duration", "reviews", "isPlatformBusiness", "tags"]
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
    
    // Try to parse the JSON response
    let parsedResults;
    try {
      // Quick validation before parsing
      if (!functionArgs.trim().startsWith('{')) {
        throw new Error('Invalid JSON: No opening brace');
      }
      
      const parsed = JSON.parse(functionArgs);
      
      if (parsed.results && Array.isArray(parsed.results)) {
        parsedResults = parsed.results;
      } else if (Array.isArray(parsed)) {
        parsedResults = parsed;
      } else {
        throw new Error('Invalid response format');
      }
      
      console.log('✅ Parsed results:', parsedResults.length, 'businesses');
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError);
      console.error('Raw function arguments:', functionArgs);
      
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Failed to parse AI function response',
          message: 'Invalid JSON format from AI function call',
          details: parseError.message
        })
      };
    }

    // Validate and verify businesses with Google Places API
    if (!Array.isArray(parsedResults)) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Invalid response format',
          message: 'AI response is not an array'
        })
      };
    }

    console.log('🔍 Verifying businesses with Google Places API...');
    const verifiedBusinesses = [];

    for (let i = 0; i < Math.min(parsedResults.length, numToGenerate); i++) {
      const aiSuggestedBusiness = parsedResults[i];
      
      // Quick validation - ensure required fields exist
      if (!aiSuggestedBusiness.name || !aiSuggestedBusiness.address) {
        console.warn(`⚠️ AI Business ${i} missing required fields, skipping`);
        continue;
      }
      
      try {
        // Construct Google Places API search query
        const searchQuery = `${aiSuggestedBusiness.name} ${aiSuggestedBusiness.address}`;
        const placesUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json`;
        
        console.log(`🔍 Searching Google Places for: ${searchQuery}`);
        
        const placesResponse = await axios.get(placesUrl, {
          params: {
            input: searchQuery,
            inputtype: 'textquery',
            fields: 'name,formatted_address,rating,opening_hours,place_id',
            key: GOOGLE_PLACES_API_KEY
          },
          timeout: 10000 // 10 second timeout
        });
        
        if (placesResponse.data.status === 'OK' && placesResponse.data.candidates && placesResponse.data.candidates.length > 0) {
          const candidate = placesResponse.data.candidates[0];
          
          // Only include businesses that have a rating
          if (candidate.rating) {
            console.log(`✅ Found verified business: ${candidate.name} (${candidate.rating} stars)`);
            
            // Parse opening hours if available
            let businessHours = aiSuggestedBusiness.hours || 'Hours available on Google';
            if (candidate.opening_hours && candidate.opening_hours.weekday_text) {
              // Simplify the hours display - just show today's hours or first available
              businessHours = candidate.opening_hours.weekday_text[0] || businessHours;
            }
            
            const verifiedBusiness = {
              id: aiSuggestedBusiness.id || `verified-${Date.now()}-${i}`,
              name: candidate.name, // Use Google's verified name
              shortDescription: aiSuggestedBusiness.shortDescription || 'A great local business worth visiting.',
              address: candidate.formatted_address, // Use Google's formatted address
              rating: candidate.rating, // Real Google rating (e.g., 4.5)
              image: null, // No images for AI businesses
              isOpen: aiSuggestedBusiness.isOpen !== undefined ? aiSuggestedBusiness.isOpen : true,
              hours: businessHours,
              distance: aiSuggestedBusiness.distance || Math.round((Math.random() * 4 + 1) * 10) / 10,
              duration: aiSuggestedBusiness.duration || Math.floor(Math.random() * 10 + 5),
              reviews: aiSuggestedBusiness.reviews || [],
              isPlatformBusiness: false,
              tags: [],
              placeId: candidate.place_id, // Store for potential future use
              isGoogleVerified: true
            };
            
            verifiedBusinesses.push(verifiedBusiness);
          } else {
            console.warn(`⚠️ Business found but no rating available: ${candidate.name || aiSuggestedBusiness.name}`);
          }
        } else {
          console.warn(`⚠️ No Google Places match found for: ${searchQuery}`);
        }
      } catch (placesError) {
        console.error(`❌ Google Places API error for ${aiSuggestedBusiness.name}:`, placesError.message);
      }
    }

    console.log('🎯 Final verified results:', verifiedBusinesses.length, 'businesses');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        results: verifiedBusinesses,
        query: searchQuery,
        usedAI: true,
        googleVerified: true,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ AI Business Search Error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Failed to generate business suggestions',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};