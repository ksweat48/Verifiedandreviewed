// Semantic search for offerings using vector embeddings
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event, context) => {
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
    const { query, latitude, longitude, matchThreshold = 0.3, matchCount = 10 } = JSON.parse(event.body);

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

    console.log('🔍 Offering search request:', { query, latitude, longitude, matchThreshold, matchCount });

    // Check required environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required environment variables',
          message: 'Please set OPENAI_API_KEY, VITE_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY'
        })
      };
    }

    // Initialize clients
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate embedding for search query
    console.log('🧠 Generating embedding for query:', query);
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.trim(),
      encoding_format: 'float'
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('✅ Generated query embedding with dimensions:', queryEmbedding.length);

    // Perform semantic search using RPC function
    console.log('🔍 Performing semantic search on offerings...');
    const { data: searchResults, error: searchError } = await supabase.rpc(
      'search_offerings_by_vibe',
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: Math.min(matchCount, 20)
      }
    );

    if (searchError) {
      console.error('❌ Semantic search error:', searchError);
      throw new Error(`Semantic search failed: ${searchError.message}`);
    }

    console.log('✅ Found', searchResults?.length || 0, 'offering matches');

    // Enrich results with full offering and business details
    let enrichedResults = [];
    if (searchResults && searchResults.length > 0) {
      console.log('🔄 Enriching search results with full details...');
      
      const offeringIds = searchResults.map(result => result.id);
      
      // Fetch full offering details with business info and images
      const { data: fullOfferings, error: detailsError } = await supabase
        .from('offerings')
        .select(`
          *,
          businesses!inner (
            id,
            name,
            address,
            location,
            category,
            description,
            short_description,
            image_url,
            gallery_urls,
            hours,
            days_closed,
            phone_number,
            website_url,
            social_media,
            price_range,
            service_area,
            is_verified,
            is_mobile_business,
            is_virtual,
            latitude,
            longitude,
            thumbs_up,
            thumbs_down,
            sentiment_score
          ),
          offering_images!left (
            url,
            source,
            is_primary,
            approved
          )
        `)
        .in('id', offeringIds)
        .eq('status', 'active');

      if (detailsError) {
        console.error('❌ Error enriching results:', detailsError);
        enrichedResults = searchResults;
      } else {
        // Create a map for quick lookup
        const offeringsMap = new Map();
        if (fullOfferings) {
          fullOfferings.forEach(offering => {
            offeringsMap.set(offering.id, offering);
          });
        }

        // Merge search results with full details
        enrichedResults = searchResults.map(searchResult => {
          const fullOffering = offeringsMap.get(searchResult.id);
          if (fullOffering) {
            const business = fullOffering.businesses;
            
            // Get primary image or fallback
            const primaryImage = fullOffering.offering_images?.find(img => img.is_primary && img.approved);
            const fallbackImage = fullOffering.offering_images?.find(img => img.approved);
            const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';

            // Transform to unified format
            return {
              // Offering data
              id: fullOffering.id,
              title: fullOffering.title,
              description: fullOffering.description,
              tags: fullOffering.tags || [],
              price_cents: fullOffering.price_cents,
              currency: fullOffering.currency,
              service_type: fullOffering.service_type,
              
              // Business data
              business_id: business.id,
              business_name: business.name,
              business_category: business.category,
              business_description: business.description,
              business_short_description: business.short_description,
              
              // Location data
              address: business.address,
              location: business.location,
              latitude: business.latitude,
              longitude: business.longitude,
              
              // Contact data
              phone_number: business.phone_number,
              website_url: business.website_url,
              social_media: business.social_media,
              
              // Business details
              hours: business.hours,
              days_closed: business.days_closed,
              price_range: business.price_range,
              service_area: business.service_area,
              
              // Status and verification
              is_verified: business.is_verified,
              is_mobile_business: business.is_mobile_business,
              is_virtual: business.is_virtual,
              
              // Rating data
              thumbs_up: business.thumbs_up || 0,
              thumbs_down: business.thumbs_down || 0,
              sentiment_score: business.sentiment_score || 0,
              
              // Image data
              image_url: imageUrl,
              gallery_urls: business.gallery_urls || [],
              
              // Search metadata
              similarity: searchResult.similarity,
              isPlatformBusiness: true,
              isOpen: true, // Default to open
              distance: 999999, // Will be calculated externally
              duration: 999999,
              
              // Compatibility fields
              name: business.name,
              image: imageUrl,
              category: business.category,
              short_description: business.short_description
            };
          } else {
            console.warn(`⚠️ Full details not found for offering: ${searchResult.id}`);
            return {
              ...searchResult,
              isPlatformBusiness: true,
              isOpen: true,
              distance: 999999,
              duration: 999999
            };
          }
        });

        console.log('✅ Successfully enriched', enrichedResults.length, 'offering results');
      }
    }

    // Calculate distances if user location provided
    if (enrichedResults.length > 0 && latitude && longitude) {
      try {
        console.log('📏 Calculating distances for', enrichedResults.length, 'offerings');
        
        const businessesWithCoords = enrichedResults.filter(result => 
          result.latitude && result.longitude
        );
        
        if (businessesWithCoords.length > 0) {
          const origin = { latitude, longitude };
          const destinations = businessesWithCoords.map(result => ({
            latitude: result.latitude,
            longitude: result.longitude,
            businessId: result.business_id
          }));
          
          // Call distance calculation function
          const distanceResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/get-business-distances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destinations })
          });
          
          if (distanceResponse.ok) {
            const distanceData = await distanceResponse.json();
            if (distanceData.success) {
              // Create distance map
              const distanceMap = new Map();
              distanceData.results.forEach(result => {
                distanceMap.set(result.businessId, {
                  distance: result.distance,
                  duration: result.duration
                });
              });
              
              // Update results with distances
              enrichedResults = enrichedResults.map(result => {
                const distanceInfo = distanceMap.get(result.business_id);
                if (distanceInfo) {
                  return {
                    ...result,
                    distance: distanceInfo.distance,
                    duration: distanceInfo.duration
                  };
                }
                return result;
              });
              
              console.log('✅ Updated offerings with accurate distances');
            }
          }
        }
      } catch (distanceError) {
        console.warn('⚠️ Distance calculation failed:', distanceError.message);
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        results: enrichedResults,
        query: query,
        matchCount: enrichedResults.length,
        usedSemanticSearch: true,
        matchThreshold: matchThreshold,
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