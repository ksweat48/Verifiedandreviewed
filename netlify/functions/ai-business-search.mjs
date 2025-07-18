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
    const { prompt } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    // Check if OpenAI API key is configured
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
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

    // Create the system prompt for business suggestions
    const systemPrompt = `You are a local business discovery assistant that helps users find businesses based on their mood, vibe, or specific needs. 
    
Return a JSON array of 6 business suggestions that match the user's query. Each business should have the following structure:

{
  "id": "unique-id-string",
  "name": "Business Name",
  "rating": {
    "thumbsUp": number between 5-50,
    "thumbsDown": number between 0-10,
    "sentimentScore": number between 65-95
  },
  "image": "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400",
  "isOpen": true or false,
  "hours": "e.g., Mon-Fri: 9AM-5PM",
  "address": "Full address with city and state",
  "reviews": [
    {
      "text": "Detailed review text about the experience",
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
1. Always use realistic business names and addresses
2. Use Pexels stock image URLs for all images
3. Provide 2-3 realistic reviews per business
4. Include relevant tags based on the business type
5. Make sure the sentiment score matches the overall review sentiment
6. Return ONLY the JSON array with no additional text
7. Make sure the JSON is valid and properly formatted`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2500
    });

    // Extract the response content
    const responseContent = completion.choices[0].message.content;
    
    // Try to parse the JSON response
    let parsedResults;
    try {
      // The response should be a JSON array, but sometimes it might include markdown code blocks
      // or other text, so we need to extract just the JSON part
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedResults = JSON.parse(jsonMatch[0]);
      } else {
        // If no array is found, try parsing the whole response
        parsedResults = JSON.parse(responseContent);
      }
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Failed to parse AI response',
          rawResponse: responseContent
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        results: parsedResults
      })
    };

  } catch (error) {
    console.error('AI Business Search Error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Failed to generate business suggestions',
        message: error.message
      })
    };
  }
};