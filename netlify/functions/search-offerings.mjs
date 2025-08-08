// Offering Search Function - Searches for specific dishes, menu items, products, or services
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

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
    const { query, latitude, longitude, matchThreshold = 0.3, matchCount = 20 } = JSON.parse(event.body);

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Query is required',
          message: 'Please provide a valid search query for dishes, items, or services'
        })
      };
    }

    console.log('🔍 Offering search request:', { query, latitude, longitude });

    // Check required environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'OpenAI API key not configured',
          message: 'Please set OPENAI_API_KEY in your environment variables'
        })
      };
    }

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

    // Initialize OpenAI client
    console.log('🤖 Initializing OpenAI client...');
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      timeout: 15000
    });

    // Generate embedding for the search query
    console.log('🧠 Generating embedding for query:', query);
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.trim(),
      encoding_format: 'float'
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('✅ Generated embedding with dimensions:', queryEmbedding.length);

    // Initialize Supabase client
    console.log('🗄️ Initializing Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Perform semantic search using the RPC function
    console.log('🔍 Performing semantic search on offerings...');
    const { data: offeringResults, error: searchError } = await supabase.rpc(
      'search_offerings_by_vibe',
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount
      }
    );

    if (searchError) {
      console.error('❌ Supabase offering search error:', searchError);
      throw new Error(`Offering search failed: ${searchError.message}`);
    }

    console.log('✅ Found', offeringResults?.length || 0, 'offering matches');

    if (!offeringResults || offeringResults.length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          results: [],
          query: query,
          message: 'No matching dishes, items, or services found.',
          usedOfferingSearch: true,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Get unique business IDs for fetching business details
    const businessIds = [...new Set(offeringResults.map(result => result.business_id))];
    
    console.log('🏢 Fetching business details for', businessIds.length, 'unique businesses');

    // Fetch business details for all unique businesses
    const { data: businessDetails, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .in('id', businessIds)
      .eq('is_visible_on_platform', true);

    if (businessError) {
      console.error('❌ Error fetching business details:', businessError);
      throw new Error(`Failed to fetch business details: ${businessError.message}`);
    }

    console.log('✅ Fetched details for', businessDetails?.length || 0, 'businesses');

    // Create a map of business ID to business details for quick lookup
    const businessMap = new Map();
    if (businessDetails) {
      businessDetails.forEach(business => {
        businessMap.set(business.id, business);
      });
    }

    // Filter and process results
    let processedResults = [];
    const businessOfferingMap = new Map(); // Track best offering per business

    for (const offering of offeringResults) {
      const business = businessMap.get(offering.business_id);
      
      if (!business) {
        console.warn(`⚠️ Business not found for offering: ${offering.title}`);
        continue;
      }

      // Filter out offerings without valid images
      if (!offering.image_url || offering.image_url.trim().length === 0) {
        console.warn(`⚠️ Offering ${offering.title} has no image, excluding`);
        continue;
      }

      // Check if business is currently open (simplified check)
      const isOpen = !business.days_closed || !business.days_closed.includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }));

      // Calculate distance if user location is provided
      let distance = null;
      if (latitude && longitude && business.latitude && business.longitude) {
        const R = 3959; // Earth's radius in miles
        const dLat = (business.latitude - latitude) * Math.PI / 180;
        const dLon = (business.longitude - longitude) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(latitude * Math.PI / 180) * Math.cos(business.latitude * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance = R * c;
      }

      const result = {
        offeringId: offering.offering_id,
        businessId: offering.business_id,
        offeringTitle: offering.title,
        offeringDescription: offering.description,
        offeringImageUrl: offering.image_url,
        offeringType: offering.type,
        businessName: business.name,
        businessAddress: business.address || business.location,
        businessLatitude: business.latitude,
        businessLongitude: business.longitude,
        businessHours: business.hours,
        businessPhone: business.phone_number,
        businessWebsite: business.website_url,
        isOpen: isOpen,
        distance: distance,
        similarity: offering.similarity,
        businessRating: {
          thumbsUp: business.thumbs_up || 0,
          thumbsDown: business.thumbs_down || 0,
          sentimentScore: business.sentiment_score || 0
        }
      };

      // Deduplicate by business - keep only the best offering per business
      const existingResult = businessOfferingMap.get(offering.business_id);
      if (!existingResult || offering.similarity > existingResult.similarity) {
        businessOfferingMap.set(offering.business_id, result);
      }
    }

    // Convert map to array
    processedResults = Array.from(businessOfferingMap.values());

    console.log('🎯 After deduplication:', processedResults.length, 'unique businesses');

    // Rank results by similarity, distance, and business rating
    processedResults.sort((a, b) => {
      // Primary: Semantic similarity (highest first)
      if (Math.abs(a.similarity - b.similarity) > 0.05) {
        return b.similarity - a.similarity;
      }
      
      // Secondary: Distance (closest first, if available)
      if (a.distance !== null && b.distance !== null) {
        if (Math.abs(a.distance - b.distance) > 0.5) {
          return a.distance - b.distance;
        }
      }
      
      // Tertiary: Business sentiment score (highest first)
      return (b.businessRating.sentimentScore || 0) - (a.businessRating.sentimentScore || 0);
    });

    // Limit to 7 results as specified
    const finalResults = processedResults.slice(0, 7);

    console.log('✅ Returning', finalResults.length, 'final offering results');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        results: finalResults,
        query: query,
        matchCount: finalResults.length,
        usedOfferingSearch: true,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Offering search error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Offering search failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};