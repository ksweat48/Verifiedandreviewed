// AI Business Search Function
import OpenAI from 'openai';

export const handler = async (event, context) => {
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
    const { prompt, searchQuery, existingResultsCount = 0 } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    console.log('🔍 AI Business Search Request:', { prompt, searchQuery, existingResultsCount });
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
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });

    // Enhanced system prompt for better business suggestions
    const systemPrompt = `You are an expert local business discovery assistant that helps users find businesses based on their mood, vibe, or specific needs. You understand nuanced search terms and can interpret what people really want.
    
IMPORTANT: Return ONLY a valid JSON array of ${6 - existingResultsCount} business suggestions that match the user's query. Each business should have this EXACT structure:

{
  "id": "unique-id-string",
  "name": "Business Name",
  "rating": {
    "thumbsUp": number between 8-45,
    "thumbsDown": number between 0-10,
    "sentimentScore": number between 70-95
  },
  "image": "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400",
  "isOpen": true or false,
  "hours": "realistic hours like Mon-Fri: 9AM-5PM, Sat-Sun: 10AM-6PM",
  "address": "Full address with city and state",
  "reviews": [
    {
      "text": "Detailed, realistic review text about the experience (100-150 words)",
      "author": "Reviewer Name",
      "authorImage": "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100",
      "images": [
        {"url": "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400"}
      ],
      "thumbsUp": true or false
    }
  ],
  "isPlatformBusiness": false,
  "tags": ["tag1", "tag2", "tag3"]
}

IMPORTANT GUIDELINES:
1. Use realistic business names and addresses that sound authentic
2. ONLY use Pexels image URLs (https://images.pexels.com/photos/...)
3. Provide 1-2 realistic, detailed reviews per business
4. Include 3-5 relevant tags based on the business type and search query
5. Make sentiment scores realistic (70-95 range)
6. Interpret search queries intelligently:
   - "peaceful brunch spot" = quiet, relaxing cafes with good breakfast
   - "vibe-y wine bar" = trendy, atmospheric wine bars
   - "cozy coffee for work" = cafes with wifi, quiet atmosphere
   - "romantic dinner place" = upscale restaurants with ambiance
7. Return ONLY valid JSON array, no markdown, no explanations
8. Ensure all required fields are present and properly formatted`;

    // Call OpenAI API
    console.log('🤖 Calling OpenAI with prompt:', prompt);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use faster, cheaper model for business suggestions
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8, // Slightly more creative
      max_tokens: 3000, // Increased for detailed reviews
      response_format: { type: "json_object" } // Ensure JSON response
    });

    // Extract the response content
    const responseContent = completion.choices[0].message.content;
    console.log('📝 OpenAI raw response:', responseContent?.substring(0, 200) + '...');
    
    // Try to parse the JSON response
    let parsedResults;
    try {
      // First try to parse as direct JSON
      const parsed = JSON.parse(responseContent);
      
      // Check if it's wrapped in an object with a results key
      if (parsed.results && Array.isArray(parsed.results)) {
        parsedResults = parsed.results;
      } else if (Array.isArray(parsed)) {
        parsedResults = parsed;
      } else {
        // Try to extract array from object
        const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
        if (arrayKey) {
          parsedResults = parsed[arrayKey];
        } else {
          throw new Error('No array found in response');
        }
      }
      
      console.log('✅ Parsed results:', parsedResults.length, 'businesses');
    } catch (parseError) {
      console.error('❌ Error parsing OpenAI response:', parseError);
      console.error('Raw response:', responseContent);
      
      // Try to extract JSON array with regex as fallback
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          parsedResults = JSON.parse(jsonMatch[0]);
          console.log('🔄 Fallback parsing successful');
        } catch (fallbackError) {
          console.error('❌ Fallback parsing also failed:', fallbackError);
          return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
              error: 'Failed to parse AI response',
              message: 'The AI returned invalid JSON format',
              rawResponse: responseContent?.substring(0, 500)
            })
          };
        }
      } else {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ 
            error: 'Failed to parse AI response',
            message: 'No valid JSON found in AI response',
            rawResponse: responseContent?.substring(0, 500)
          })
        };
      }
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

    // Ensure each business has required fields
    const validatedResults = parsedResults.map((business, index) => ({
      id: business.id || `ai-${Date.now()}-${index}`,
      name: business.name || `Business ${index + 1}`,
      rating: {
        thumbsUp: business.rating?.thumbsUp || Math.floor(Math.random() * 30) + 10,
        thumbsDown: business.rating?.thumbsDown || Math.floor(Math.random() * 5),
        sentimentScore: business.rating?.sentimentScore || Math.floor(Math.random() * 25) + 70
      },
      image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      isOpen: business.isOpen !== undefined ? business.isOpen : Math.random() > 0.3,
      hours: business.hours || 'Mon-Fri: 9AM-5PM',
      address: business.address || 'Address not available',
      reviews: business.reviews || [],
      isPlatformBusiness: false,
      tags: business.tags || ['business']
    }));

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