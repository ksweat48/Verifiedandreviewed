// Semantic Search for Offerings (Dishes, Items, Services)
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to calculate distance between two coordinates in miles
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to determine if business is currently open
function isBusinessOpen(hours, daysClosed) {
  // Simplified logic - in production you'd parse actual hours
  // For now, assume businesses are open unless explicitly closed
  if (!hours) return true;
  
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Check if today is in the closed days
  if (daysClosed && daysClosed.toLowerCase().includes(currentDay.toLowerCase())) {
    return false;
  }
  
  // Default to open if we can't parse hours
  return true;
}

// Helper function to get CTA label based on offering type
function getCTALabel(offeringTitle, businessCategory) {
  const title = (offeringTitle || '').toLowerCase();
  const category = (businessCategory || '').toLowerCase();
  
  // Food & Beverage
  if (title.includes('dish') || title.includes('meal') || title.includes('entree') || 
      title.includes('appetizer') || title.includes('dessert') || title.includes('soup') ||
      category.includes('restaurant') || category.includes('cafe') || category.includes('food')) {
    return 'View Dish';
  }
  
  // Beverages
  if (title.includes('drink') || title.includes('beverage') || title.includes('smoothie') ||
      title.includes('coffee') || title.includes('tea') || title.includes('juice')) {
    return 'View Drink';
  }
  
  // Services
  if (title.includes('service') || title.includes('treatment') || title.includes('session') ||
      title.includes('consultation') || title.includes('therapy') || title.includes('massage') ||
      category.includes('wellness') || category.includes('spa') || category.includes('fitness')) {
    return 'View Service';
  }
  
  // Products/Items
  if (title.includes('product') || title.includes('item') || title.includes('gear') ||
      category.includes('retail') || category.includes('shop') || category.includes('store')) {
    return 'View Item';
  }
  
  // Default
  return 'View Offering';
}

// Helper function to select the best approved image for an offering
async function selectOfferingImage(supabase, offeringId) {
  try {
    // Get all approved images for this offering
    const { data: images, error } = await supabase
      .from('offering_images')
      .select('*')
      .eq('offering_id', offeringId)
      .eq('approved', true)
      .order('is_primary', { ascending: false }) // Primary images first
      .order('created_at', { ascending: false }); // Most recent first
    
    if (error) throw error;
    
    if (!images || images.length === 0) {
      return null; // No approved images
    }
    
    // Return the first image (will be primary if available, otherwise most recent)
    return images[0].url;
  } catch (error) {
    console.error('Error selecting offering image:', error);
    return null;
  }
}

export const handler = async (event, context) => {
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
    const { q, lat, lng, limit = 7 } = event.queryStringParameters || {};

    // Parse query - if empty, return empty state
    if (!q || q.trim().length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          results: [],
          query: '',
          message: 'Please enter a search query to find dishes, items, or services',
          totalResults: 0,
          timestamp: new Date().toISOString()
        })
      };
    }

    console.log('🍽️ Searching offerings for query:', q);

    // Check required environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required Supabase environment variables');
    }

    // Safe no-op if OpenAI key not configured
    if (!OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key not configured - returning empty results');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          results: [],
          query: q,
          message: 'OpenAI API key not configured - offering search unavailable',
          totalResults: 0,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Initialize clients
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate embedding for the search query
    console.log('🧠 Generating embedding for query:', q);
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: q.trim(),
      encoding_format: 'float'
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('✅ Generated embedding with dimensions:', queryEmbedding.length);

    // Perform semantic search using the RPC function
    console.log('🔍 Performing semantic search for offerings...');
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_offerings_by_vibe',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3, // Lower threshold for offerings to get more results
        match_count: 50 // Get more candidates for filtering
      }
    );

    if (searchError) {
      console.error('❌ Supabase search error:', searchError);
      throw new Error(`Offering search failed: ${searchError.message}`);
    }

    console.log('✅ Found', searchResults?.length || 0, 'offering candidates');

    if (!searchResults || searchResults.length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          results: [],
          query: q,
          message: 'No offerings found matching your search',
          totalResults: 0,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Enrich results with business details and images
    console.log('🔄 Enriching offering results with business details and images...');
    
    const businessIds = [...new Set(searchResults.map(result => result.business_id))];
    
    // Fetch business details
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .in('id', businessIds);
    
    if (businessError) throw businessError;
    
    // Create business lookup map
    const businessMap = new Map();
    (businesses || []).forEach(business => {
      businessMap.set(business.id, business);
    });

    // Process each offering candidate
    const enrichedResults = [];
    
    for (const offering of searchResults) {
      const business = businessMap.get(offering.business_id);
      if (!business) continue;
      
      // Check if business is open
      const isOpen = isBusinessOpen(business.hours, business.days_closed);
      
      // Select the best approved image for this offering
      const imageUrl = await selectOfferingImage(supabase, offering.offering_id);
      
      // Skip offerings without approved images
      if (!imageUrl) {
        console.log(`⚠️ Skipping offering ${offering.title} - no approved images`);
        continue;
      }
      
      // Calculate distance if user location provided
      let distanceKm = null;
      let proximityScore = 0.5; // Default neutral score
      
      if (lat && lng && business.latitude && business.longitude) {
        const distanceMiles = calculateDistance(
          parseFloat(lat), parseFloat(lng),
          business.latitude, business.longitude
        );
        distanceKm = distanceMiles * 1.60934; // Convert to kilometers
        
        // Proximity score: closer = higher score (0-1)
        // Assume 10 miles = 0 score, 0 miles = 1 score
        proximityScore = Math.max(0, Math.min(1, 1 - (distanceMiles / 10)));
      }
      
      // Rating score: convert sentiment_score (0-100) to 0-1
      const ratingScore = (business.sentiment_score || 0) / 100;
      
      // Calculate composite score
      const semanticScore = offering.similarity || 0;
      const compositeScore = (
        0.65 * semanticScore +
        0.20 * proximityScore +
        0.15 * ratingScore
      );
      
      enrichedResults.push({
        offeringId: offering.offering_id,
        businessId: offering.business_id,
        businessName: business.name,
        offeringTitle: offering.title,
        offeringDescription: offering.description,
        tags: offering.tags || [],
        priceCents: offering.price_cents,
        currency: offering.currency || 'USD',
        imageUrl: imageUrl,
        businessAddress: business.address,
        businessCategory: business.category,
        isOpen: isOpen,
        distanceKm: distanceKm,
        semanticScore: semanticScore,
        proximityScore: proximityScore,
        ratingScore: ratingScore,
        compositeScore: compositeScore,
        ctaLabel: getCTALabel(offering.title, business.category),
        businessLatitude: business.latitude,
        businessLongitude: business.longitude,
        businessHours: business.hours,
        businessPhone: business.phone_number,
        businessWebsite: business.website_url
      });
    }

    console.log('✅ Enriched', enrichedResults.length, 'offerings with business details and images');

    // De-duplicate by business_id (keep best offering per business)
    const businessOfferingMap = new Map();
    
    enrichedResults.forEach(offering => {
      const existingOffering = businessOfferingMap.get(offering.businessId);
      
      if (!existingOffering || offering.semanticScore > existingOffering.semanticScore) {
        businessOfferingMap.set(offering.businessId, offering);
      }
    });
    
    const deduplicatedResults = Array.from(businessOfferingMap.values());
    console.log('✅ After de-duplication:', deduplicatedResults.length, 'unique businesses');

    // Sort by composite score (highest first) and limit results
    const finalResults = deduplicatedResults
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, parseInt(limit) || 7);

    console.log('🎯 Final results:', finalResults.length, 'offerings');
    console.log('📊 Top results:', finalResults.slice(0, 3).map(r => ({
      title: r.offeringTitle,
      business: r.businessName,
      semanticScore: Math.round(r.semanticScore * 100) + '%',
      compositeScore: Math.round(r.compositeScore * 100) + '%'
    })));

    // Format response payload
    const responsePayload = {
      success: true,
      results: finalResults.map(offering => ({
        offeringId: offering.offeringId,
        businessId: offering.businessId,
        businessName: offering.businessName,
        offeringTitle: offering.offeringTitle,
        offeringDescription: offering.offeringDescription,
        imageUrl: offering.imageUrl,
        ctaLabel: offering.ctaLabel,
        distanceKm: offering.distanceKm,
        isOpen: offering.isOpen,
        priceCents: offering.priceCents,
        currency: offering.currency,
        tags: offering.tags,
        businessAddress: offering.businessAddress,
        businessCategory: offering.businessCategory,
        semanticScore: offering.semanticScore,
        compositeScore: offering.compositeScore,
        businessLatitude: offering.businessLatitude,
        businessLongitude: offering.businessLongitude,
        businessHours: offering.businessHours,
        businessPhone: offering.businessPhone,
        businessWebsite: offering.businessWebsite
      })),
      query: q,
      totalResults: finalResults.length,
      searchLocation: lat && lng ? {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng)
      } : null,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(responsePayload)
    };

  } catch (error) {
    console.error('❌ Offering search error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to search offerings',
        message: error.message,
        query: event.queryStringParameters?.q || '',
        timestamp: new Date().toISOString()
      })
    };
  }
};