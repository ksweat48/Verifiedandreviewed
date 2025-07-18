// AI Business Search Function
import OpenAI from 'openai';

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
                      properties: {
                        text: { type: "string", description: "Review text, 40-60 words" },
                        author: { type: "string", description: "Reviewer name" },
                        authorImage: { type: "string", format: "uri" },
                        images: { type: "array", items: {} },
                        thumbsUp: { type: "boolean" }
                      },
                      required: ["text", "author", "authorImage", "images", "thumbsUp"]
                    },
                    minItems: 1,
                    maxItems: 1
                  },
                  isPlatformBusiness: { type: "boolean", enum: [false] },
                  tags: { type: "array", items: {}, maxItems: 0 }
                },
                required: ["id", "name", "shortDescription", "rating", "image", "isOpen", "hours", "address", "distance", "duration", "reviews", "isPlatformBusiness", "tags"]
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
      model: 'gpt-4o',
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

    // Validate the results
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

    // Ensure each business has required fields and slice to requested number
    const validatedResults = parsedResults.slice(0, numToGenerate).map((business, index) => {
      // Quick validation - ensure required fields exist
      if (!business.name || !business.address) {
        console.warn(`⚠️ Business ${index} missing required fields, skipping`);
        return null;
      }
      
      return {
        id: business.id || `ai-${Date.now()}-${index}`,
        name: business.name,
        shortDescription: business.shortDescription || 'A great local business worth visiting.',
        rating: business.rating || { thumbsUp: 15, thumbsDown: 2, sentimentScore: 85 },
        image: null, // No images for AI businesses
        isOpen: business.isOpen !== undefined ? business.isOpen : true,
        hours: business.hours || 'Mon-Fri: 9AM-5PM',
        address: business.address,
        distance: business.distance || Math.round((Math.random() * 4 + 1) * 10) / 10, // 1.0-5.0 miles
        duration: business.duration || Math.floor(Math.random() * 10 + 5), // 5-15 minutes
        reviews: business.reviews || [],
        isPlatformBusiness: false,
        tags: [] // Empty tags for AI businesses
      };
    }).filter(Boolean); // Remove null entries

    console.log('🎯 Final validated results:', validatedResults.length, 'businesses');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        results: validatedResults,
        query: searchQuery,
        usedAI: true,
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