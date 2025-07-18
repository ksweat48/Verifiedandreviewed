// WordPress Publishing Function
import axios from 'axios';

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
    const {
      title,
      slug,
      content,
      excerpt,
      metaDescription,
      rating,
      category,
      tags,
      featuredImage,
      gallery,
      businessName,
      location,
      originalReview
    } = JSON.parse(event.body);

    const WORDPRESS_API_URL = process.env.VITE_WORDPRESS_API_URL || 'https://cms.verifiedandreviewed.com/wp-json/wp/v2';
    const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
    const WORDPRESS_APP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;

    if (!WORDPRESS_USERNAME || !WORDPRESS_APP_PASSWORD) {
      throw new Error('WordPress credentials not configured');
    }

    // Create WordPress post data
    const postData = {
      title: title,
      slug: slug,
      content: content,
      excerpt: excerpt,
      status: 'publish',
      categories: [1], // Default category ID - adjust as needed
      tags: tags || [],
      meta: {
        _yoast_wpseo_metadesc: metaDescription,
        _yoast_wpseo_title: title
      },
      acf: {
        business_name: businessName,
        location: location,
        rating: rating,
        health_score: Math.floor(Math.random() * 20) + 80, // Random score 80-100
        category: category,
        review_text: content,
        business_image: featuredImage,
        is_verified: false, // Auto-generated content is not verified
        verified_date: new Date().toISOString().split('T')[0],
        clean_bathrooms: Math.random() > 0.5,
        drive_thru: Math.random() > 0.7,
        vegan_options: Math.random() > 0.6,
        original_review: originalReview,
        gallery_images: gallery || []
      }
    };

    // Create Basic Auth header
    const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64');

    // Post to WordPress
    const response = await axios.post(`${WORDPRESS_API_URL}/posts`, postData, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        postId: response.data.id,
        postUrl: response.data.link,
        message: 'Post published successfully'
      })
    };

  } catch (error) {
    console.error('WordPress Publishing Error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Failed to publish to WordPress',
        message: error.message
      })
    };
  }
};