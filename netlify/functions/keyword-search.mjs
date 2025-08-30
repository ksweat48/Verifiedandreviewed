// Keyword-based search for offerings
import { createClient } from '@supabase/supabase-js';
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
      matchCount = 10
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

    console.log('🔍 Keyword search request:', { query, latitude, longitude, matchCount });

    // Check required environment variables
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required environment variables',
          message: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
        })
      };
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract keywords from query
    const keywords = query.trim().toLowerCase().split(/\s+/).filter(word => word.length > 2);
    console.log('🔍 Extracted keywords:', keywords);

    if (keywords.length === 0) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'No valid keywords found',
          message: 'Please provide a more specific search query'
        })
      };
    }

    // Build keyword search query
    console.log('🔍 Performing keyword search on offerings...');
    
    let queryBuilder = supabase
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
          sentiment_score,
          is_visible_on_platform
        ),
        offering_images!left (
          url,
          source,
          is_primary,
          approved
        )
      `)
      .eq('status', 'active')
      .eq('businesses.is_visible_on_platform', true);

    // Build keyword matching conditions
    // For each keyword, check if it appears in offering title, description, or business name/description
    for (const keyword of keywords) {
      queryBuilder = queryBuilder.or(
        `title.ilike.%${keyword}%,description.ilike.%${keyword}%,businesses.name.ilike.%${keyword}%,businesses.description.ilike.%${keyword}%,businesses.short_description.ilike.%${keyword}%`
      );
    }

    const { data: searchResults, error: searchError } = await queryBuilder
      .limit(50) // Get more candidates for scoring
      .order('created_at', { ascending: false });

    if (searchError) {
      console.error('❌ Keyword search error:', searchError);
      throw new Error(`Keyword search failed: ${searchError.message}`);
    }

    console.log('✅ Found', searchResults?.length || 0, 'keyword matches');

    let enrichedResults = searchResults || [];

    // Score results based on keyword relevance
    enrichedResults = enrichedResults.map(result => {
      const business = result.businesses;
      
      // Combine all searchable text
      const searchableText = [
        result.title || '',
        result.description || '',
        business.name || '',
        business.description || '',
        business.short_description || ''
      ].join(' ').toLowerCase();

      // Calculate keyword match score
      let keywordScore = 0;
      let matchedKeywords = 0;
      
      for (const keyword of keywords) {
        if (searchableText.includes(keyword)) {
          matchedKeywords++;
          
          // Give higher score for matches in title vs description
          if ((result.title || '').toLowerCase().includes(keyword)) {
            keywordScore += 3; // Title match is worth 3 points
          } else if ((business.name || '').toLowerCase().includes(keyword)) {
            keywordScore += 2; // Business name match is worth 2 points
          } else {
            keywordScore += 1; // Description match is worth 1 point
          }
        }
      }

      // Calculate percentage of keywords matched
      const keywordMatchPercentage = matchedKeywords / keywords.length;
      
      // Only include results that match ALL keywords
      const includeResult = keywordMatchPercentage === 1.0;

      return {
        ...result,
        keywordScore,
        matchedKeywords,
        keywordMatchPercentage,
        includeResult,
        // Transform to expected format
        business_id: business.id,
        business_name: business.name,
        business_category: business.category,
        business_description: business.description,
        business_short_description: business.short_description,
        address: business.address,
        location: business.location,
        latitude: business.latitude,
        longitude: business.longitude,
        phone_number: business.phone_number,
        website_url: business.website_url,
        social_media: business.social_media,
        hours: business.hours,
        days_closed: business.days_closed,
        price_range: business.price_range,
        service_area: business.service_area,
        is_verified: business.is_verified,
        is_mobile_business: business.is_mobile_business,
        is_virtual: business.is_virtual,
        thumbs_up: business.thumbs_up || 0,
        thumbs_down: business.thumbs_down || 0,
        sentiment_score: business.sentiment_score || 0,
        image_url: result.offering_images?.find(img => img.is_primary && img.approved)?.url || 
                   result.offering_images?.find(img => img.approved)?.url || 
                   business.image_url || 
                   '/verified and reviewed logo-coral copy copy.png',
        gallery_urls: business.gallery_urls || [],
        isPlatformBusiness: true,
        isOpen: true, // Will be calculated later
        distance: 999999, // Will be calculated later
        duration: 999999,
        source: 'offering',
        // Compatibility fields
        name: business.name,
        image: result.offering_images?.find(img => img.is_primary && img.approved)?.url || 
               result.offering_images?.find(img => img.approved)?.url || 
               business.image_url || 
               '/verified and reviewed logo-coral copy copy.png',
        category: business.category,
        short_description: business.short_description,
        offeringId: result.id,
        offeringTitle: result.title,
        offeringDescription: result.description,
        serviceType: result.service_type,
        priceCents: result.price_cents,
        currency: result.currency,
        offering_images: result.offering_images
      };
    });

    // Filter to only include results that match ALL keywords
    const filteredResults = enrichedResults.filter(result => result.includeResult);
    console.log('✅ Filtered to', filteredResults.length, 'results matching all keywords');

    // Calculate distances if user location provided
    if (filteredResults.length > 0 && latitude && longitude) {
      try {
        console.log('📏 Calculating distances for', filteredResults.length, 'offerings');
        
        const businessesWithCoords = filteredResults.filter(result => 
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
          const distanceResponse = await axios.post(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/get-business-distances`, {
            origin,
            destinations
          }, {
            timeout: 15000
          });
          
          if (distanceResponse.data.success) {
            // Create distance map
            const distanceMap = new Map();
            distanceResponse.data.results.forEach(result => {
              distanceMap.set(result.businessId, {
                distance: result.distance,
                duration: result.duration
              });
            });
            
            // Update results with distances
            filteredResults.forEach(result => {
              const distanceInfo = distanceMap.get(result.business_id);
              if (distanceInfo) {
                result.distance = distanceInfo.distance;
                result.duration = distanceInfo.duration;
              }
            });
            
            console.log('✅ Updated offerings with accurate distances');
          }
        }
      } catch (distanceError) {
        console.warn('⚠️ Distance calculation failed:', distanceError.message);
      }
    }

    // Filter by 15-mile radius if location provided
    let finalResults = filteredResults;
    if (latitude && longitude) {
      const maxDistance = 15;
      finalResults = filteredResults.filter(result => {
        if (!result.distance || result.distance === 999999) {
          return true; // Keep results without distance data
        }
        return result.distance <= maxDistance;
      });
      console.log(`📏 Results within ${maxDistance} miles: ${finalResults.length} offerings`);
    }

    // Sort by keyword relevance score, then by distance
    finalResults.sort((a, b) => {
      // Primary sort: keyword score (higher is better)
      if (a.keywordScore !== b.keywordScore) {
        return b.keywordScore - a.keywordScore;
      }
      
      // Secondary sort: distance (closer is better)
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      
      // Tertiary sort: creation date (newer is better)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Limit to requested count
    const limitedResults = finalResults.slice(0, matchCount);

    console.log('🎯 Final keyword search results:');
    limitedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. "${result.title}" at "${result.business_name}" - Score: ${result.keywordScore} - Distance: ${result.distance}mi`);
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        results: limitedResults,
        query: query,
        matchCount: limitedResults.length,
        keywords: keywords,
        usedKeywordSearch: true,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Keyword search error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Keyword search failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};