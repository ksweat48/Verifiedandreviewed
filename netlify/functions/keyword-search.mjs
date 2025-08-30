// Enhanced keyword-based search for offerings with tiered matching
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Stop words to filter out from search queries
const STOP_WORDS = [
  'the', 'is', 'and', 'a', 'an', 'for', 'to', 'in', 'on', 'at', 'with', 'from', 'by', 
  'about', 'as', 'but', 'can', 'do', 'has', 'have', 'he', 'her', 'his', 'how', 'if', 
  'it', 'its', 'just', 'me', 'my', 'no', 'not', 'of', 'or', 'our', 'out', 'she', 'so', 
  'some', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 
  'those', 'through', 'up', 'us', 'very', 'was', 'we', 'what', 'when', 'where', 'which', 
  'who', 'whom', 'why', 'will', 'you', 'your', 'find', 'near', 'best', 'good', 'top', 
  'local', 'great', 'amazing', 'awesome', 'nice', 'cool', 'get', 'want', 'need', 'looking'
];

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

    console.log('🔍 Enhanced keyword search request:', { query, latitude, longitude, matchCount });

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

    // Extract main keywords from query (filter out stop words and short words)
    const allWords = query.trim().toLowerCase().split(/\s+/);
    const mainKeywords = allWords.filter(word => 
      word.length >= 3 && !STOP_WORDS.includes(word)
    );
    
    console.log('🔍 Original query words:', allWords);
    console.log('🔍 Filtered main keywords:', mainKeywords);

    if (mainKeywords.length === 0) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'No valid keywords found',
          message: 'Please provide a more specific search query with meaningful words'
        })
      };
    }

    // Perform multiple targeted searches instead of complex OR query
    console.log('🔍 Performing targeted keyword searches on offerings...');
    
    let allSearchResults = [];
    
    // Search each keyword individually to avoid complex OR parsing issues
    for (const keyword of mainKeywords) {
      console.log(`🔍 Searching for keyword: "${keyword}"`);
      
      // Search in offering titles
      const { data: titleResults, error: titleError } = await supabase
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
            is_visible_on_platform,
            tags
          ),
          offering_images!left (
            url,
            source,
            is_primary,
            approved
          )
        `)
        .eq('status', 'active')
        .eq('businesses.is_visible_on_platform', true)
        .ilike('title', `%${keyword}%`)
        .limit(50);
      
      if (!titleError && titleResults) {
        allSearchResults.push(...titleResults);
      }
      
      // Search in offering descriptions
      const { data: descResults, error: descError } = await supabase
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
            is_visible_on_platform,
            tags
          ),
          offering_images!left (
            url,
            source,
            is_primary,
            approved
          )
        `)
        .eq('status', 'active')
        .eq('businesses.is_visible_on_platform', true)
        .ilike('description', `%${keyword}%`)
        .limit(50);
      
      if (!descError && descResults) {
        allSearchResults.push(...descResults);
      }
      
      // Search in business names
      const { data: nameResults, error: nameError } = await supabase
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
            is_visible_on_platform,
            tags
          ),
          offering_images!left (
            url,
            source,
            is_primary,
            approved
          )
        `)
        .eq('status', 'active')
        .eq('businesses.is_visible_on_platform', true)
        .ilike('businesses.name', `%${keyword}%`)
        .limit(50);
      
      if (!nameError && nameResults) {
        allSearchResults.push(...nameResults);
      }
    }
    
    // Remove duplicates based on offering ID
    const uniqueResults = [];
    const seenIds = new Set();
    
    for (const result of allSearchResults) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        uniqueResults.push(result);
      }
    }
    
    console.log('✅ Found', uniqueResults.length, 'unique offerings after deduplication');
    const searchResults = uniqueResults;


    // Score and categorize results based on keyword matches
    const scoredResults = enrichedResults.map(result => {
      const business = result.businesses;
      
      // Combine all searchable text
      const searchableText = [
        result.title || '',
        result.description || '',
        business.name || '',
        business.description || '',
        business.short_description || ''
      ].join(' ').toLowerCase();

      // Calculate keyword matches and score
      let keywordScore = 0;
      let matchedKeywords = 0;
      const foundKeywords = [];
      
      for (const keyword of mainKeywords) {
        if (searchableText.includes(keyword)) {
          matchedKeywords++;
          foundKeywords.push(keyword);
          
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

      return {
        ...result,
        keywordScore,
        matchedKeywords,
        foundKeywords,
        keywordMatchPercentage: matchedKeywords / mainKeywords.length,
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

    // Group results by number of matched keywords (tiered matching)
    const resultsByKeywordCount = {};
    for (let i = mainKeywords.length; i >= 1; i--) {
      resultsByKeywordCount[i] = scoredResults.filter(result => result.matchedKeywords === i);
    }

    console.log('📊 Results by keyword count:');
    for (let i = mainKeywords.length; i >= 1; i--) {
      console.log(`  ${i} keywords: ${resultsByKeywordCount[i].length} results`);
    }

    // Find the highest tier with results (tiered fallback)
    let finalResults = [];
    let usedKeywordTier = 0;
    
    for (let i = mainKeywords.length; i >= 1; i--) {
      if (resultsByKeywordCount[i].length > 0) {
        finalResults = resultsByKeywordCount[i];
        usedKeywordTier = i;
        console.log(`✅ Using ${i}-keyword matches: ${finalResults.length} results`);
        break;
      }
    }

    if (finalResults.length === 0) {
      console.log('❌ No results found for any keyword combination');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          results: [],
          query: query,
          mainKeywords: mainKeywords,
          usedKeywordTier: 0,
          matchCount: 0,
          message: 'No offerings found matching your search criteria'
        })
      };
    }

    // Calculate distances if user location provided
    if (finalResults.length > 0 && latitude && longitude) {
      try {
        console.log('📏 Calculating distances for', finalResults.length, 'offerings');
        
        const businessesWithCoords = finalResults.filter(result => 
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
            finalResults = finalResults.map(result => {
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
      } catch (distanceError) {
        console.warn('⚠️ Distance calculation failed:', distanceError.message);
      }
    }

    // Filter by 15-mile radius if location provided
    if (latitude && longitude) {
      const maxDistance = 15;
      finalResults = finalResults.filter(result => {
        if (!result.distance || result.distance === 999999) {
          return true; // Keep results without distance data
        }
        return result.distance <= maxDistance;
      });
      console.log(`📏 Results within ${maxDistance} miles: ${finalResults.length} offerings`);
    }

    // Final sort: keyword score (desc), then distance (asc), then creation date (desc)
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

    console.log('🎯 Final enhanced keyword search results:');
    limitedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. "${result.title}" at "${result.business_name}" - Score: ${result.keywordScore} (${result.matchedKeywords}/${mainKeywords.length} keywords) - Distance: ${result.distance}mi`);
      console.log(`     Found keywords: [${result.foundKeywords.join(', ')}]`);
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        results: limitedResults,
        query: query,
        mainKeywords: mainKeywords,
        usedKeywordTier: usedKeywordTier,
        matchCount: limitedResults.length,
        message: `Found ${limitedResults.length} offerings matching ${usedKeywordTier} of ${mainKeywords.length} keywords`,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Enhanced keyword search error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Enhanced keyword search failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};