// AI Content Generation using OpenAI
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const handler = async (event, context) => {
  // Handle CORS
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
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'OpenAI API key not configured',
          message: 'Please set OPENAI_API_KEY in your environment variables',
          instructions: {
            step1: 'Go to https://platform.openai.com/api-keys',
            step2: 'Create a new API key',
            step3: 'Add OPENAI_API_KEY to your Netlify environment variables',
            step4: 'Redeploy your site for changes to take effect'
          }
        })
      };
    }

    const { 
      businessName, 
      businessCategory, 
      reviewText, 
      reviewRating, 
      location, 
      imageUrls = [] 
    } = JSON.parse(event.body);

    if (!businessName || !reviewText) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required fields: businessName, reviewText' })
      };
    }

    // Create the AI prompt
    const systemPrompt = `You are an expert local SEO content writer. You write engaging, easy-to-read review-style blog posts for businesses based on customer feedback. Your goal is to generate professional, helpful blog content optimized for web readability and search engines.`;

    const userPrompt = `Write a 250–300 word blog post reviewing the following business based on this customer review and other available details.

Business Name: ${businessName}
Category: ${businessCategory || 'Business'}
Review Text: "${reviewText}"
Review Rating: ${reviewRating || 5} stars
Location: ${location || 'Location TBD'}
Image URLs (if any): ${imageUrls.join(', ') || 'None'}

### Requirements:
- Title the article: "${businessName} Review"
- Use a warm and professional tone.
- Start with a short, compelling intro paragraph to hook readers.
- Highlight key strengths mentioned in the review (e.g., cleanliness, service, product quality).
- Format the blog with short, scannable paragraphs.
- Add a closing paragraph that summarizes the experience and gives it a final "Verified & Reviewed Rating" out of 5 stars.
- Write in third person (not "I went to...")
- Suggest one or two external helpful links (e.g., to the business website or similar category guides).
- End with a clear call to action to visit or learn more.

### SEO Guidelines:
- Optimize for keywords like "${businessName} review," "${location} ${businessCategory}," and "${businessName} experience"
- Use natural language, and no keyword stuffing
- Write a custom meta description (max 160 characters) at the end

### Format your response as JSON:
{
  "title": "Article title",
  "slug": "article-slug",
  "content": "Full article content in HTML format",
  "excerpt": "Brief excerpt (150 chars max)",
  "metaDescription": "SEO meta description (160 chars max)",
  "rating": 4.5,
  "category": "Recent Reviews",
  "tags": ["tag1", "tag2"],
  "featuredImage": "first image URL or default",
  "gallery": ["array", "of", "image", "urls"]
}`;

    // Generate content with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    let generatedContent;
    try {
      generatedContent = JSON.parse(completion.choices[0].message.content);
    } catch (parseError) {
      // Fallback if AI doesn't return valid JSON
      const content = completion.choices[0].message.content;
      generatedContent = {
        title: `${businessName} Review`,
        slug: businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        content: content,
        excerpt: content.substring(0, 150) + '...',
        metaDescription: `Read our review of ${businessName} in ${location}. ${reviewRating} stars.`,
        rating: reviewRating || 5,
        category: 'Recent Reviews',
        tags: [businessCategory || 'Business', location || 'Review'],
        featuredImage: imageUrls[0] || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
        gallery: imageUrls
      };
    }

    // Add additional metadata
    generatedContent.businessName = businessName;
    generatedContent.location = location;
    generatedContent.originalReview = {
      text: reviewText,
      rating: reviewRating,
      date: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        content: generatedContent
      })
    };

  } catch (error) {
    console.error('Content Generation Error:', error);
    
    let errorMessage = error.message;
    let troubleshooting = [];
    let solution = '';

    if (error.message.includes('API key')) {
      errorMessage = 'OpenAI API Key Error';
      solution = 'Your OpenAI API key is invalid or missing.';
      troubleshooting = [
        '1. Go to https://platform.openai.com/api-keys',
        '2. Create a new API key or verify your existing one',
        '3. Add OPENAI_API_KEY to your Netlify environment variables',
        '4. Make sure you have sufficient OpenAI credits',
        '5. Redeploy your site for changes to take effect'
      ];
    } else if (error.message.includes('quota')) {
      errorMessage = 'OpenAI Quota Exceeded';
      solution = 'You have exceeded your OpenAI API quota.';
      troubleshooting = [
        'Check your OpenAI usage at https://platform.openai.com/usage',
        'Add billing information to your OpenAI account',
        'Upgrade your OpenAI plan if needed'
      ];
    }
    
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Failed to generate content',
        message: errorMessage,
        solution: solution,
        troubleshooting: troubleshooting,
        originalError: error.message
      })
    };
  }
};