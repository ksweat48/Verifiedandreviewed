// Netlify Function to check deployment status
import axios from 'axios';

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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { id } = JSON.parse(event.body);

    if (!id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Deploy ID is required' 
        })
      };
    }

    // Get Netlify auth token from environment variable
    const netlifyToken = process.env.NETLIFY_AUTH_TOKEN;
    
    if (!netlifyToken) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Netlify authentication token not configured' 
        })
      };
    }

    // Call Netlify API to get deployment status
    const response = await axios.get(`https://api.netlify.com/api/v1/deploys/${id}`, {
      headers: {
        'Authorization': `Bearer ${netlifyToken}`
      }
    });

    const deployData = response.data;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        state: deployData.state,
        deploy_url: deployData.deploy_ssl_url || deployData.deploy_url,
        claim_url: deployData.admin_url,
        claimed: deployData.claimed_at ? true : false,
        created_at: deployData.created_at,
        updated_at: deployData.updated_at
      })
    };
  } catch (error) {
    console.error('Error checking deployment status:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to check deployment status' 
      })
    };
  }
};