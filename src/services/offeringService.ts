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