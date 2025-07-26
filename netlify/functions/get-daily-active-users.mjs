// Get Daily Active Users from activity logs
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get date parameter (defaults to today)
    const { date } = event.queryStringParameters || {};
    const targetDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Check required environment variables
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Supabase credentials not configured',
          message: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables'
        })
      };
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Calculating DAU for date: ${targetDate}`);

    // Query to get unique active users for the specified date
    const { data, error } = await supabase
      .from('user_activity_logs')
      .select('user_id')
      .gte('created_at', `${targetDate}T00:00:00.000Z`)
      .lt('created_at', `${targetDate}T23:59:59.999Z`);

    if (error) {
      console.error('Error querying activity logs:', error);
      throw new Error(error.message);
    }

    // Count unique users
    const uniqueUsers = new Set(data.map(log => log.user_id));
    const dailyActiveUsers = uniqueUsers.size;

    console.log(`DAU for ${targetDate}: ${dailyActiveUsers} unique users`);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        date: targetDate,
        dailyActiveUsers: dailyActiveUsers,
        totalActivities: data.length
      })
    };

  } catch (error) {
    console.error('Error calculating DAU:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to calculate daily active users',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};