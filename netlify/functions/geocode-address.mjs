// Google Geocoding API integration for automatic coordinate generation
import axios from 'axios';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { address } = await req.json();

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Address is required',
        message: 'Please provide a valid address string'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if Google Geocoding API key is configured
    const GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;
    
    if (!GOOGLE_GEOCODING_API_KEY) {
      console.error('❌ Google Geocoding API key not configured');
      return new Response(JSON.stringify({ 
        error: 'Google Geocoding API key not configured',
        message: 'Please set GOOGLE_GEOCODING_API_KEY in your environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🗺️ Geocoding address:', address);

    // Call Google Geocoding API
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: address.trim(),
        key: GOOGLE_GEOCODING_API_KEY
      },
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      console.error('Google Geocoding API error:', response.data.status);
      
      let errorMessage = 'Geocoding failed';
      switch (response.data.status) {
        case 'ZERO_RESULTS':
          errorMessage = 'No results found for this address. Please check the address and try again.';
          break;
        case 'OVER_QUERY_LIMIT':
          errorMessage = 'Geocoding service temporarily unavailable. Please try again later.';
          break;
        case 'REQUEST_DENIED':
          errorMessage = 'Geocoding request denied. Please check API configuration.';
          break;
        case 'INVALID_REQUEST':
          errorMessage = 'Invalid address format. Please provide a complete address.';
          break;
        default:
          errorMessage = `Geocoding error: ${response.data.status}`;
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        status: response.data.status
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = response.data.results[0];
    if (!result || !result.geometry || !result.geometry.location) {
      return new Response(JSON.stringify({ 
        error: 'No valid coordinates found for this address'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { lat, lng } = result.geometry.location;
    const formattedAddress = result.formatted_address;

    console.log('✅ Geocoding successful:', { lat, lng, formattedAddress });

    return new Response(JSON.stringify({
      success: true,
      latitude: lat,
      longitude: lng,
      formattedAddress: formattedAddress,
      addressComponents: result.address_components,
      placeId: result.place_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Geocoding error:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to geocode address',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}