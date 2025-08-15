// netlify/functions/log-activity.mjs
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userId, eventType, eventDetails } = JSON.parse(event.body);

    // Basic input validation
    if (!userId || !eventType) {
      console.error('Missing required fields: userId or eventType');
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: userId or eventType' })
      };
    }

    // Ensure Supabase environment variables are set
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase credentials not configured for Netlify Function.');
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Supabase credentials not configured',
          message: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Netlify environment variables.'
        })
      };
    }

    // Initialize Supabase client with the service role key
    // This allows the function to bypass Row Level Security (RLS) for inserts
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Logging activity for user ${userId}: ${eventType}`);

    // Handle view tracking for reviews
    if (eventType === 'business_view' && eventDetails?.post_id) {
      try {
        console.log('Incrementing view count for post:', eventDetails.post_id);
        
        // Find the review associated with this business view
        const { data: reviews, error: reviewError } = await supabase
          .from('user_reviews')
          .select('id, views')
          .eq('business_id', eventDetails.business_id || 'unknown')
          .limit(1);
        
        if (!reviewError && reviews && reviews.length > 0) {
          // Increment view count for the review
          const { error: updateError } = await supabase
            .from('user_reviews')
            .update({ 
              views: (reviews[0].views || 0) + 1 
            })
            .eq('id', reviews[0].id);
          
          if (updateError) {
            console.error('Error updating review view count:', updateError);
          } else {
            console.log('Successfully incremented view count for review:', reviews[0].id);
          }
        }
      } catch (viewError) {
        console.error('Error handling view tracking:', viewError);
        // Continue with normal activity logging even if view tracking fails
      }
    }

    // Insert the activity log into the database
    const { data, error } = await supabase
      .from('user_activity_logs')
      .insert({
        user_id: userId,
        event_type: eventType,
        event_details: eventDetails || null // Use null if eventDetails is not provided
      });

    if (error) {
      console.error('Error inserting activity log:', error);
      throw new Error(error.message);
    }

    console.log('Activity log successfully inserted.');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Activity logged successfully' })
    };

  } catch (error) {
    console.error('Error in log-activity function:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to log activity', message: error.message })
    };
  }
};