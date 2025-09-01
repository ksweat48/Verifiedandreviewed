import { supabase } from './supabaseClient';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export interface Offering {
  id: string;
  business_id: string;
  title: string;
  description?: string;
  tags: string[];
  price_cents?: number;
  currency: string;
  service_type: 'onsite' | 'mobile' | 'remote' | 'delivery';
  status: 'active' | 'inactive' | 'draft';
  created_at: string;
  updated_at: string;
}

export interface OfferingImage {
  id: string;
  offering_id: string;
  source: 'platform' | 'google_places' | 'website' | 'social_media';
  url: string;
  width?: number;
  height?: number;
  license?: string;
  is_primary: boolean;
  approved: boolean;
  created_at: string;
}

export interface OfferingEmbedding {
  offering_id: string;
  embedding: number[];
  updated_at: string;
}

export class OfferingService {
  // Create a new offering
  static async createOffering(
    businessId: string,
    offeringData: Partial<Offering> & { image_url?: string }
  ): Promise<{ success: boolean; offeringId?: string; error?: string }> {
    try {
      const { data: newOffering, error } = await supabase
        .from('offerings')
        .insert({
          business_id: businessId,
          title: offeringData.title || 'Untitled Offering',
          description: offeringData.description,
          tags: offeringData.tags || [],
          price_cents: offeringData.price_cents,
          currency: offeringData.currency || 'USD',
          service_type: offeringData.service_type || 'onsite',
          status: offeringData.status || 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      // Add offering image if provided
      if (newOffering?.id && offeringData.image_url) {
        const { error: imageError } = await supabase
          .from('offering_images')
          .insert({
            offering_id: newOffering.id,
            source: 'platform',
            url: offeringData.image_url,
            is_primary: true,
            approved: true,
            created_at: new Date().toISOString()
          });
        
        if (imageError) {
          console.error('Error adding offering image:', imageError);
          // Don't fail the entire operation if image fails
        }
      }

      // Generate embedding for the new offering
      if (newOffering?.id) {
        await this.generateOfferingEmbedding(newOffering.id);
      }

      return {
        success: true,
        offeringId: newOffering?.id
      };
    } catch (error) {
      console.error('Error creating offering:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create offering'
      };
    }
  }

  // Update an existing offering
  static async updateOffering(
    offeringId: string,
    offeringData: Partial<Offering> & { image_url?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('offerings')
        .update({
          title: offeringData.title,
          description: offeringData.description,
          tags: offeringData.tags,
          price_cents: offeringData.price_cents,
          currency: offeringData.currency,
          service_type: offeringData.service_type,
          status: offeringData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', offeringId);

      if (error) throw error;

      // Update offering image if provided
      if (offeringData.image_url) {
        const { error: imageError } = await supabase
          .from('offering_images')
          .upsert({
            offering_id: offeringId,
            source: 'platform',
            url: offeringData.image_url,
            is_primary: true,
            approved: true,
            created_at: new Date().toISOString()
          });
        
        if (imageError) {
          console.error('Error updating offering image:', imageError);
          // Don't fail the entire operation if image fails
        }
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('Error updating offering:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update offering'
      };
    }
  }

  // Delete an offering
  static async deleteOffering(offeringId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('offerings')
        .delete()
        .eq('id', offeringId);

      if (error) throw error;

      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting offering:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete offering'
      };
    }
  }

  // Get offerings for a business
  static async getBusinessOfferings(businessId: string): Promise<Offering[]> {
    try {
      const { data, error } = await supabase
        .from('offerings')
        .select(`
          *,
          offering_images!left (
            id,
            url,
            source,
            is_primary,
            approved
          )
        `)
        .eq('business_id', businessId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to include images
      const offeringsWithImages = (data || []).map(offering => ({
        ...offering,
        images: offering.offering_images?.filter(img => img.approved) || []
      }));
      
      return offeringsWithImages;
    } catch (error) {
      console.error('Error fetching business offerings:', error);
      return [];
    }
  }

  // Get a single offering by ID
  static async getOfferingById(offeringId: string): Promise<Offering | null> {
    try {
      const { data, error } = await supabase
        .from('offerings')
        .select(`
          *,
          offering_images!left (
            id,
            url,
            source,
            is_primary,
            approved
          )
        `)
        .eq('id', offeringId)
        .single();

      if (error) throw error;
      
      // Transform data to include images
      const offeringWithImages = {
        ...data,
        images: data.offering_images?.filter(img => img.approved) || []
      };
      
      return offeringWithImages;
    } catch (error) {
      console.error('Error fetching offering by ID:', error);
      return null;
    }
  }

  // Generate embedding for an offering
  static async generateOfferingEmbedding(offeringId: string): Promise<boolean> {
    try {
      console.log('🧠 Generating embedding for offering:', offeringId);

      const response = await fetchWithTimeout('/.netlify/functions/generate-offering-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offeringId: offeringId
        }),
        timeout: 30000
      });

      if (!response.ok) {
        console.warn('⚠️ Embedding generation service not available');
        return false;
      }

      const data = await response.json();
      return data.success || false;
    } catch (error) {
      console.warn('⚠️ Embedding generation failed:', error);
      return false;
    }
  }

  // Batch generate embeddings for all offerings
  static async generateAllEmbeddings(batchSize: number = 10): Promise<{
    success: boolean;
    processed: number;
    successCount: number;
    errorCount: number;
    message: string;
  }> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/generate-offering-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchSize: batchSize,
          forceRegenerate: false
        }),
        timeout: 60000 // 1 minute timeout for batch operations
      });

      if (!response.ok) {
        throw new Error(`Batch embedding generation failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in batch embedding generation:', error);
      return {
        success: false,
        processed: 0,
        successCount: 0,
        errorCount: 1,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Ingest business data into offerings
  static async ingestBusinessAsOfferings(businessId: string): Promise<{
    success: boolean;
    offeringsCreated: number;
    error?: string;
  }> {
    try {
      console.log('📥 Ingesting business data as offerings for:', businessId);

      // Get the business data
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (businessError || !business) {
        throw new Error('Business not found');
      }

      // Check if offerings already exist for this business
      const { data: existingOfferings } = await supabase
        .from('offerings')
        .select('id')
        .eq('business_id', businessId);

      if (existingOfferings && existingOfferings.length > 0) {
        console.log('⚠️ Offerings already exist for business:', businessId);
        return {
          success: true,
          offeringsCreated: 0
        };
      }

      // Determine service type based on business type
      let serviceType: 'onsite' | 'mobile' | 'remote' | 'delivery' = 'onsite';
      if (business.is_virtual) {
        serviceType = 'remote';
      } else if (business.is_mobile_business) {
        serviceType = 'mobile';
      }

      // Create primary offering from business data
      const offeringData = {
        business_id: businessId,
        title: business.primary_offering || business.name,
        description: business.description || business.short_description,
        tags: business.tags || [],
        service_type: serviceType,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newOffering, error: offeringError } = await supabase
        .from('offerings')
        .insert(offeringData)
        .select('id')
        .single();

      if (offeringError) throw offeringError;

      let offeringsCreated = 1;

      // Add business image as offering image if available
      if (business.image_url && newOffering?.id) {
        await supabase
          .from('offering_images')
          .insert({
            offering_id: newOffering.id,
            source: 'platform',
            url: business.image_url,
            is_primary: true,
            approved: true,
            created_at: new Date().toISOString()
          });
      }

      // Add gallery images if available
      if (business.gallery_urls && business.gallery_urls.length > 0 && newOffering?.id) {
        const galleryImages = business.gallery_urls.map(url => ({
          offering_id: newOffering.id,
          source: 'platform' as const,
          url: url,
          is_primary: false,
          approved: true,
          created_at: new Date().toISOString()
        }));

        await supabase
          .from('offering_images')
          .insert(galleryImages);
      }

      // Generate embedding for the new offering
      if (newOffering?.id) {
        await this.generateOfferingEmbedding(newOffering.id);
      }

      console.log('✅ Successfully ingested business as offering:', businessId);

      return {
        success: true,
        offeringsCreated
      };
    } catch (error) {
      console.error('Error ingesting business as offerings:', error);
      return {
        success: false,
        offeringsCreated: 0,
        error: error instanceof Error ? error.message : 'Ingestion failed'
      };
    }
  }

  // Batch ingest all businesses as offerings
  static async ingestAllBusinesses(): Promise<{
    success: boolean;
    businessesProcessed: number;
    offeringsCreated: number;
    errors: string[];
  }> {
    try {
      console.log('📥 Starting batch ingestion of all businesses...');

      // Get all visible businesses
      const { data: businesses, error } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('is_visible_on_platform', true);

      if (error) throw error;

      const results = {
        success: true,
        businessesProcessed: 0,
        offeringsCreated: 0,
        errors: [] as string[]
      };

      // Process each business
      for (const business of businesses || []) {
        try {
          const result = await this.ingestBusinessAsOfferings(business.id);
          results.businessesProcessed++;
          
          if (result.success) {
            results.offeringsCreated += result.offeringsCreated;
          } else {
            results.errors.push(`${business.name}: ${result.error}`);
          }

          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          results.errors.push(`${business.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log('✅ Batch ingestion completed:', results);
      return results;
    } catch (error) {
      console.error('Error in batch ingestion:', error);
      return {
        success: false,
        businessesProcessed: 0,
        offeringsCreated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Get offerings for explore section (random/curated display)
  static async getExploreOfferings(limit: number = 15, userLatitude?: number, userLongitude?: number): Promise<any[]> {
    try {
      console.log('🔍 DEBUG: getExploreOfferings called with:', { 
        limit, 
        userLatitude, 
        userLongitude,
        hasUserLocation: !!(userLatitude && userLongitude)
      });
      
      console.log('🔍 Fetching explore offerings with limit:', limit);

      const { data, error } = await supabase
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
        .eq('businesses.is_visible_on_platform', true)
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching explore offerings:', error);
        throw error;
      }

      console.log('✅ Fetched', data?.length || 0, 'explore offerings');
      
      // Debug: Log business coordinates
      console.log('🗺️ DEBUG: Business coordinates from Supabase:');
      data?.forEach((offering, index) => {
        console.log(`  ${index + 1}. ${offering.businesses.name}: lat=${offering.businesses.latitude}, lng=${offering.businesses.longitude}`);
      });
      
      let enrichedData = data || [];
      
      // Calculate distances if user location is provided
      if (userLatitude && userLongitude && enrichedData.length > 0) {
        try {
          console.log('📏 Calculating distances for explore offerings...');
          
          const businessesWithCoords = enrichedData.filter(offering => 
            offering.businesses.latitude && offering.businesses.longitude
          );
          
          console.log('🗺️ DEBUG: Businesses with coordinates:', businessesWithCoords.length, 'out of', enrichedData.length);
          
          if (businessesWithCoords.length > 0) {
            const origin = { latitude: userLatitude, longitude: userLongitude };
            const destinations = businessesWithCoords.map(offering => ({
              latitude: offering.businesses.latitude,
              longitude: offering.businesses.longitude,
              businessId: offering.businesses.id
            }));
            
            console.log('🗺️ DEBUG: Distance calculation request:', {
              origin,
              destinationsCount: destinations.length,
              destinations: destinations.slice(0, 2) // Log first 2 for brevity
            });
            
            const response = await fetchWithTimeout('/.netlify/functions/get-business-distances', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ origin, destinations }),
              timeout: 15000
            });
            
            console.log('🗺️ DEBUG: Distance API response status:', response.ok, response.status);
            
            if (response.ok) {
              const distanceData = await response.json();
              console.log('🗺️ DEBUG: Distance API response data:', distanceData);
              
              if (distanceData.success) {
                // Create distance map
                const distanceMap = new Map();
                distanceData.results.forEach(result => {
                  distanceMap.set(result.businessId, {
                    distance: result.distance,
                    duration: result.duration
                  });
                });
                
                console.log('🗺️ DEBUG: Distance map created:', Array.from(distanceMap.entries()));
                
                // Update offerings with distances
                enrichedData = enrichedData.map(offering => {
                  const distanceInfo = distanceMap.get(offering.businesses.id);
                  if (distanceInfo) {
                    console.log(`🗺️ DEBUG: Adding distance ${distanceInfo.distance} to ${offering.businesses.name}`);
                    return {
                      ...offering,
                      distance: distanceInfo.distance,
                      duration: distanceInfo.duration
                    };
                  }
                  console.log(`🗺️ DEBUG: No distance info found for ${offering.businesses.name} (ID: ${offering.businesses.id})`);
                  return offering;
                });
                
                console.log('✅ Updated explore offerings with accurate distances');
              } else {
                console.error('❌ DEBUG: Distance API returned success=false:', distanceData);
              }
            } else {
              console.error('❌ DEBUG: Distance API request failed:', response.status, response.statusText);
            }
          } else {
            console.warn('⚠️ DEBUG: No businesses with coordinates found for distance calculation');
          }
        } catch (distanceError) {
          console.warn('⚠️ Distance calculation failed for explore offerings:', distanceError.message);
          console.error('❌ DEBUG: Full distance error:', distanceError);
        }
      } else {
        console.log('🗺️ DEBUG: Skipping distance calculation - missing user location or no offerings');
      }
      
      console.log('📊 DEBUG: Final enriched data before return:', enrichedData.map(o => ({
        name: o.businesses.name,
        distance: o.distance,
        hasDistance: o.distance !== undefined && o.distance !== 999999
      })));
      
      return enrichedData;
    } catch (error) {
      console.error('❌ Error in getExploreOfferings:', error);
      return [];
    }
  }

  // Keyword-based search for offerings
  static async keywordSearchOfferings(
    query: string,
    options: {
      latitude?: number;
      longitude?: number;
      matchCount?: number;
    } = {}
  ): Promise<{
    success: boolean;
    results: any[];
    query: string;
    keywords: string[];
    usedKeywordSearch: boolean;
    error?: string;
  }> {
    try {
      console.log('🔍 Performing keyword search for offerings:', query);

      const response = await fetchWithTimeout('/.netlify/functions/keyword-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          latitude: options.latitude,
          longitude: options.longitude,
          matchCount: options.matchCount || 10
        }),
        timeout: 20000
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            results: [],
            query,
            keywords: [],
            usedKeywordSearch: false,
            error: 'Keyword search service not available. Make sure to run "netlify dev" instead of "npm run dev".'
          };
        }
        
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
        }
        
        return {
          success: false,
          results: [],
          query,
          keywords: [],
          usedKeywordSearch: false,
          error: errorMessage
        };
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse keyword search response:', jsonError);
        throw new Error('Invalid response from keyword search service');
      }
      
      if (!data.success) {
        throw new Error(data.message || 'Keyword search failed');
      }

      console.log('✅ Keyword search completed:', data.matchCount, 'results');
      console.log('🔍 Keywords used:', data.keywords);

      return {
        success: true,
        results: data.results || [],
        query: data.query,
        keywords: data.keywords || [],
        usedKeywordSearch: true
      };

    } catch (error) {
      console.error('❌ Keyword search error:', error);
      
      return {
        success: false,
        results: [],
        query,
        keywords: [],
        usedKeywordSearch: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Search offerings by semantic similarity
  static async searchOfferings(
    query: string,
    options: {
      latitude?: number;
      longitude?: number;
      matchThreshold?: number;
      matchCount?: number;
    } = {}
  ): Promise<{
    success: boolean;
    results: any[];
    query: string;
    matchCount: number;
  }> {
    try {
      console.log('🔍 Searching offerings with query:', query);

      const response = await fetchWithTimeout('/.netlify/functions/search-offerings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          latitude: options.latitude,
          longitude: options.longitude,
          matchThreshold: options.matchThreshold || 0.3,
          matchCount: options.matchCount || 10
        }),
        timeout: 20000
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error searching offerings:', error);
      return {
        success: false,
        results: [],
        query,
        matchCount: 0
      };
    }
  }
}