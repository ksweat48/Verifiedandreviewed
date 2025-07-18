```javascript
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
    const systemPrompt = \`You are a local business discovery assistant. Generate exactly ${numToGenerate} business suggestions that match the user's query. Match tone and intent of search.

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
                  // The AI will generate a placeholder rating, which will be overwritten by Google's real rating
                  rating: { type: "number", minimum: 1, maximum: 5, description: "Placeholder rating (will be replaced by Google's real rating)" },
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
      model: 'gpt-4o-mini', // Reverted to mini for cost-efficiency
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
    let aiSuggestedBusinesses;
    try {
      // Quick validation before parsing
      if (!functionArgs.trim().startsWith('{')) {
        throw new Error('Invalid JSON: No opening brace');
      }
      
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
    if (!Array.isArray(aiSuggestedBusinesses)) {
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
    const finalResults = [];

    for (let i = 0; i < aiSuggestedBusinesses.length; i++) {
      const aiBusiness = aiSuggestedBusinesses[i];
      
      // Crucial Check: Ensure name and address exist for Google Places search
      if (!aiBusiness.name || !aiBusiness.address) {
        console.warn(\`⚠️ AI Business ${i} missing name or address, skipping Google Places verification.`);
        continue;
      }
      
      try {
        // Construct Google Places API search query
        const placesSearchQuery = \`${aiBusiness.name}, ${aiBusiness.address}`;
        const placesUrl = \`https://maps.googleapis.com/maps/api/place/findplacefromtext/json`;
        
        console.log(\`🔍 Searching Google Places for: ${placesSearchQuery}`);
        
        const placesResponse = await axios.get(placesUrl, {
          params: {
            input: placesSearchQuery,
            inputtype: 'textquery',
            fields: 'name,formatted_address,rating,opening_hours,place_id', // Requesting only necessary fields
            key: GOOGLE_PLACES_API_KEY
          },
          timeout: 10000 // 10 second timeout
        });
        
        if (placesResponse.data.status === 'OK' && placesResponse.data.candidates && placesResponse.data.candidates.length > 0) {
          const candidate = placesResponse.data.candidates[0];
          
          // CRITICAL: Only include businesses that have a rating
          if (candidate.rating) {
            console.log(\`✅ Found verified business: ${candidate.name} (${candidate.rating} stars)`);
            
            // Attempt to get opening hours from Google, fallback to AI if not available
            let businessHours = aiBusiness.hours; // Start with AI's generated hours
            if (candidate.opening_hours && candidate.opening_hours.weekday_text) {
              // Simplify the hours display - just show today's hours or first available
              businessHours = candidate.opening_hours.weekday_text[0] || businessHours;
            }
            
            const verifiedBusiness = {
              id: aiBusiness.id, // Keep AI's generated ID
              name: candidate.name, // Use Google's verified name
              shortDescription: aiBusiness.shortDescription,
              address: candidate.formatted_address, // Use Google's formatted address
              rating: candidate.rating, // Use Google's real rating
              image: null, // No images for AI businesses
              isOpen: aiBusiness.isOpen,
              hours: businessHours,
              distance: aiBusiness.distance,
              duration: aiBusiness.duration,
              reviews: aiBusiness.reviews,
              isPlatformBusiness: false, // These are AI-generated, not from our platform DB
              tags: aiBusiness.tags,
              isGoogleVerified: true // Flag to indicate Google verification
            };
            
            finalResults.push(verifiedBusiness);
          } else {
            console.warn(\`⚠️ Business found on Google but no rating available: ${candidate.name || aiBusiness.name}, discarding.`);
          }
        } else {
          console.warn(\`⚠️ No Google Places match found for: ${placesSearchQuery}, discarding.`);
        }
      } catch (placesError) {
        console.error(\`❌ Google Places API error for ${aiBusiness.name}:`, placesError.message);
        // Discard business if Google Places API call fails
      }
    }

    console.log('🎯 Final verified results:', finalResults.length, 'businesses');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        results: finalResults, // Return only the Google-verified results
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
```