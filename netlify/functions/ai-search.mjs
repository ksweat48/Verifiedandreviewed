// AI Business Search using Google Places API
import axios from 'axios';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { 
      query, 
      latitude, 
      longitude, 
      matchCount = 5 
    } = JSON.parse(event.body);

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Query is required',
          message: 'Please provide a valid search query'
        })
      };
    }

    console.log('🤖 AI business search request:', { query, latitude, longitude, matchCount });

    // Check if Google Places API key is configured
    const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!GOOGLE_PLACES_API_KEY) {
      console.warn('⚠️ Google Places API key not configured, returning mock AI businesses');
      
      // Return mock AI businesses for development/demo
      const mockAIBusinesses = generateMockAIBusinesses(query, latitude, longitude, matchCount);
      
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          businesses: mockAIBusinesses,
          query: query,
          source: 'mock_ai',
          message: 'Mock AI businesses generated (Google Places API not configured)',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Use Google Places API to find businesses
    const placesResponse = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: `${query} restaurant food`,
        location: latitude && longitude ? `${latitude},${longitude}` : undefined,
        radius: 15000, // 15km radius
        type: 'restaurant',
        key: GOOGLE_PLACES_API_KEY
      },
      timeout: 10000
    });

    if (placesResponse.data.status !== 'OK') {
      console.error('Google Places API error:', placesResponse.data.status);
      
      // Fallback to mock data if API fails
      const mockAIBusinesses = generateMockAIBusinesses(query, latitude, longitude, matchCount);
      
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          businesses: mockAIBusinesses,
          query: query,
          source: 'mock_ai_fallback',
          message: 'Mock AI businesses generated (Google Places API error)',
          timestamp: new Date().toISOString()
        })
      };
    }

    const places = placesResponse.data.results || [];
    
    // Transform Google Places results to our business format
    const aiBusinesses = places.slice(0, matchCount).map((place, index) => {
      // Calculate distance if user location provided
      let distance = 999999;
      if (latitude && longitude && place.geometry?.location) {
        distance = calculateDistance(
          latitude, longitude,
          place.geometry.location.lat, place.geometry.location.lng
        );
      }

      return {
        id: `ai-${place.place_id}`,
        name: place.name,
        business_name: place.name,
        title: place.name,
        description: `AI-generated business found via Google Places. ${place.types?.join(', ') || ''}`,
        short_description: place.vicinity || place.formatted_address || 'AI-generated business',
        address: place.formatted_address || place.vicinity || 'Address not available',
        location: place.vicinity || place.formatted_address || 'Location not available',
        category: 'AI Generated',
        tags: place.types || [],
        image: place.photos?.[0] 
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_API_KEY}`
          : '/verified and reviewed logo-coral copy copy.png',
        image_url: place.photos?.[0] 
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_API_KEY}`
          : '/verified and reviewed logo-coral copy copy.png',
        rating: {
          thumbsUp: Math.floor(place.rating || 4),
          thumbsDown: 0,
          sentimentScore: Math.round((place.rating || 4) * 20)
        },
        isOpen: place.opening_hours?.open_now !== false,
        hours: place.opening_hours?.open_now ? 'Currently open' : 'Hours not available',
        reviews: [],
        isPlatformBusiness: false,
        isAIGenerated: true,
        isGoogleVerified: true,
        placeId: place.place_id,
        latitude: place.geometry?.location?.lat,
        longitude: place.geometry?.location?.lng,
        distance: distance,
        duration: Math.round(distance * 2), // Rough estimate: 2 minutes per mile
        similarity: Math.max(0.7, 1 - (index * 0.1)), // Decreasing similarity score
        phone_number: place.international_phone_number,
        website_url: place.website,
        price_range: place.price_level ? '$'.repeat(place.price_level) : undefined,
        source: 'google_places'
      };
    });

    console.log('✅ AI business search completed:', aiBusinesses.length, 'businesses found');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        businesses: aiBusinesses,
        query: query,
        source: 'google_places',
        matchCount: aiBusinesses.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ AI business search error:', error);
    
    // Fallback to mock data on any error
    const mockAIBusinesses = generateMockAIBusinesses(
      JSON.parse(event.body).query || 'food', 
      JSON.parse(event.body).latitude, 
      JSON.parse(event.body).longitude, 
      JSON.parse(event.body).matchCount || 5
    );
    
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        businesses: mockAIBusinesses,
        query: JSON.parse(event.body).query || 'food',
        source: 'mock_ai_error_fallback',
        message: 'Mock AI businesses generated due to error',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Generate mock AI businesses for development/fallback
function generateMockAIBusinesses(query, latitude, longitude, count = 5) {
  const mockBusinesses = [
    {
      name: "Green Garden Bistro",
      category: "Healthy Restaurant",
      description: "Farm-to-table restaurant specializing in organic, locally-sourced ingredients",
      address: "123 Organic Way, Health Valley, CA 90210",
      image: "/verified and reviewed logo-coral copy copy.png",
      rating: 4.5,
      isOpen: true,
      tags: ["organic", "farm-to-table", "healthy", "vegetarian"]
    },
    {
      name: "Zen Wellness Cafe",
      category: "Wellness Cafe",
      description: "Mindful eating experience with meditation garden and superfood menu",
      address: "456 Mindful Street, Wellness City, CA 90211",
      image: "/verified and reviewed logo-coral copy copy.png",
      rating: 4.7,
      isOpen: true,
      tags: ["wellness", "meditation", "superfood", "mindful"]
    },
    {
      name: "Urban Harvest Kitchen",
      category: "Modern American",
      description: "Contemporary cuisine featuring seasonal ingredients and innovative techniques",
      address: "789 Innovation Ave, Culinary District, CA 90212",
      image: "/verified and reviewed logo-coral copy copy.png",
      rating: 4.3,
      isOpen: false,
      tags: ["modern", "seasonal", "innovative", "contemporary"]
    },
    {
      name: "Coastal Breeze Eatery",
      category: "Seafood",
      description: "Fresh seafood with ocean views and sustainable fishing practices",
      address: "321 Ocean Drive, Seaside, CA 90213",
      image: "/verified and reviewed logo-coral copy copy.png",
      rating: 4.6,
      isOpen: true,
      tags: ["seafood", "ocean-view", "sustainable", "fresh"]
    },
    {
      name: "Mountain Peak Grill",
      category: "BBQ & Grill",
      description: "Rustic mountain dining with wood-fired grills and local game",
      address: "654 Summit Trail, Mountain View, CA 90214",
      image: "/verified and reviewed logo-coral copy copy.png",
      rating: 4.4,
      isOpen: true,
      tags: ["bbq", "wood-fired", "rustic", "mountain"]
    }
  ];

  // Filter and score businesses based on query relevance
  const queryWords = query.toLowerCase().split(/\s+/);
  const scoredBusinesses = mockBusinesses.map((business, index) => {
    const searchText = `${business.name} ${business.description} ${business.tags.join(' ')}`.toLowerCase();
    
    // Calculate relevance score
    let score = 0;
    queryWords.forEach(word => {
      if (searchText.includes(word)) {
        score += 1;
      }
    });
    
    // Add some randomness and base score
    score += Math.random() * 0.5 + 0.5;
    
    // Calculate mock distance
    let distance = 999999;
    if (latitude && longitude) {
      // Generate realistic distances between 0.5 and 12 miles
      distance = Math.random() * 11.5 + 0.5;
    }

    return {
      ...business,
      id: `ai-mock-${index}`,
      business_name: business.name,
      title: business.name,
      business_category: business.category,
      business_description: business.description,
      business_short_description: business.description,
      location: business.address,
      image_url: business.image,
      rating: {
        thumbsUp: Math.floor(business.rating),
        thumbsDown: 0,
        sentimentScore: Math.round(business.rating * 20)
      },
      reviews: [],
      isPlatformBusiness: false,
      isAIGenerated: true,
      isGoogleVerified: true,
      placeId: `mock-place-${index}`,
      latitude: latitude ? latitude + (Math.random() - 0.5) * 0.1 : 34.0527 + (Math.random() - 0.5) * 0.1,
      longitude: longitude ? longitude + (Math.random() - 0.5) * 0.1 : -84.5947 + (Math.random() - 0.5) * 0.1,
      distance: distance,
      duration: Math.round(distance * 2),
      similarity: Math.max(0.6, 1 - (index * 0.1)),
      phone_number: `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      website_url: `https://${business.name.toLowerCase().replace(/\s+/g, '')}.com`,
      price_range: ['$', '$$', '$$$'][Math.floor(Math.random() * 3)],
      source: 'mock_ai',
      relevanceScore: score
    };
  });

  // Sort by relevance score and return top results
  return scoredBusinesses
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, count);
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}