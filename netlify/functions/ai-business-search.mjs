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
    console.log('🔧 Initializing OpenAI client...');
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: 25000 // 25 second timeout
    });

    // Enhanced system prompt for better business suggestions
    const systemPrompt = `You are a local business discovery assistant. Generate exactly 3 business suggestions that match the user's query.
    
Return ONLY valid JSON with this structure:
{"results": [business_array]}

Each business:
{
  "id": "unique-id-string",
  "name": "Business Name",
  "rating": {
    "thumbsUp": 15,
    "thumbsDown": 2,
    "sentimentScore": 85
  },
  "image": null,
  "isOpen": true,
  "hours": "Mon-Fri: 9AM-5PM",
  "address": "123 Main St, City, State",
  "distance": 2.5,
  "duration": 8,
  "reviews": [
    {
      "text": "Brief realistic review (50-80 words max)",
      "author": "Reviewer Name",
      "authorImage": "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100",
      "images": [],
      "thumbsUp": true or false
    }
  ],
  "isPlatformBusiness": false,
  "isPlatformBusiness": false
}

Rules:
- Use realistic business names and addresses
- Set image field to null (no images needed)
- 1 brief review per business (50-80 words)
- Include realistic distance (1-5 miles) and duration (5-15 minutes)
- Generate exactly 3 businesses, no more, no less
- Return ONLY JSON, no explanations`;

    // Call OpenAI API
    console.log('🤖 Calling OpenAI with prompt:', prompt);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 600, // Reduced for 3 businesses without images
      response_format: { type: "json_object" }
    });

    // Extract the response content
    const responseContent = completion.choices[0].message.content;
    console.log('📝 OpenAI raw response:', responseContent?.substring(0, 200) + '...');
    
    // Try to parse the JSON response
    let parsedResults;
    try {
      const parsed = JSON.parse(responseContent);
      
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
      
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Failed to parse AI response',
          message: 'Invalid JSON format from AI'
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

    // Ensure each business has required fields
    const validatedResults = parsedResults.slice(0, 3).map((business, index) => {
      // Quick validation - ensure required fields exist
      if (!business.name || !business.address) {
        console.warn(`⚠️ Business ${index} missing required fields, skipping`);
        return null;
      }
      
      return {
        id: business.id || `ai-${Date.now()}-${index}`,
        name: business.name,
        rating: business.rating || { thumbsUp: 15, thumbsDown: 2, sentimentScore: 85 },
        image: null, // No images for AI businesses
        isOpen: business.isOpen !== undefined ? business.isOpen : true,
        hours: business.hours || 'Mon-Fri: 9AM-5PM',
        address: business.address,
        distance: business.distance || Math.round((Math.random() * 4 + 1) * 10) / 10, // 1.0-5.0 miles
        duration: business.duration || Math.floor(Math.random() * 10 + 5), // 5-15 minutes
        reviews: business.reviews || [],
        isPlatformBusiness: false,
        isPlatformBusiness: false
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