// Daily Content Generation Scheduler
import axios from 'axios';

export const handler = async (event, context) => {
  // This function should be triggered by a cron job or webhook
  // For Netlify, you can use Netlify Functions with scheduled triggers
  
  try {
    console.log('Starting daily content generation...');
    
    // Mock business data - in production, this would come from a database
    const businesses = [
      {
        name: 'Green Garden Cafe',
        category: 'Healthy Restaurant',
        location: 'Downtown Seattle',
        accountId: 'account123',
        locationId: 'location456'
      },
      {
        name: 'Ocean View Restaurant',
        category: 'Restaurant',
        location: 'Miami Beach',
        accountId: 'account789',
        locationId: 'location012'
      },
      {
        name: 'Fresh Market Co-op',
        category: 'Retail & Grocery',
        location: 'Portland, OR',
        accountId: 'account345',
        locationId: 'location678'
      },
      {
        name: 'Zen Wellness Center',
        category: 'Wellness',
        location: 'Austin, TX',
        accountId: 'account901',
        locationId: 'location234'
      },
      {
        name: 'Sunrise Hotel & Spa',
        category: 'Hotel',
        location: 'Miami Beach',
        accountId: 'account567',
        locationId: 'location890'
      }
    ];

    const results = [];
    const targetPosts = 10;
    let postsGenerated = 0;

    // Generate content for each business until we reach 10 posts
    for (const business of businesses) {
      if (postsGenerated >= targetPosts) break;

      try {
        // 1. Fetch Google Reviews
        const reviewsResponse = await axios.get(`${process.env.URL}/.netlify/functions/google-reviews`, {
          params: {
            accountId: business.accountId,
            locationId: business.locationId
          }
        });

        const reviews = reviewsResponse.data.reviews || [];
        
        // Process each review (limit to 2 per business to spread content)
        const reviewsToProcess = reviews.slice(0, 2);
        
        for (const review of reviewsToProcess) {
          if (postsGenerated >= targetPosts) break;

          // 2. Generate AI Content
          const contentResponse = await axios.post(`${process.env.URL}/.netlify/functions/generate-content`, {
            businessName: business.name,
            businessCategory: business.category,
            reviewText: review.comment,
            reviewRating: review.starRating,
            location: business.location,
            imageUrls: []
          });

          const generatedContent = contentResponse.data.content;

          // 3. Publish to WordPress
          const publishResponse = await axios.post(`${process.env.URL}/.netlify/functions/publish-to-wordpress`, generatedContent);

          results.push({
            business: business.name,
            postId: publishResponse.data.postId,
            postUrl: publishResponse.data.postUrl,
            success: true
          });

          postsGenerated++;
          
          // Add delay between posts to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`Error processing ${business.name}:`, error);
        results.push({
          business: business.name,
          success: false,
          error: error.message
        });
      }
    }

    // Log results
    console.log(`Daily content generation completed. Generated ${postsGenerated} posts.`);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        postsGenerated,
        targetPosts,
        results,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Daily content generation failed:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};