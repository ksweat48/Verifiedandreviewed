// Batch ingest existing businesses into the new offerings schema
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
    const { businessId, batchSize = 20 } = JSON.parse(event.body || '{}');

    console.log('📥 Business ingestion request:', { businessId, batchSize });

    // Check required environment variables
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Supabase credentials not configured',
          message: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
        })
      };
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let queryBuilder = supabase
      .from('businesses')
      .select('*')
      .eq('is_visible_on_platform', true);

    // Single business or batch processing
    if (businessId) {
      queryBuilder = queryBuilder.eq('id', businessId).limit(1);
      console.log('🎯 Processing single business:', businessId);
    } else {
      queryBuilder = queryBuilder.limit(batchSize);
      console.log(`📦 Processing batch of ${batchSize} businesses`);
    }

    const { data: businesses, error: fetchError } = await queryBuilder;
    if (fetchError) throw fetchError;

    if (!businesses || businesses.length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'No businesses found to ingest',
          businessesProcessed: 0,
          offeringsCreated: 0,
          errors: []
        })
      };
    }

    console.log(`🔄 Processing ${businesses.length} businesses for ingestion`);

    const results = {
      businessesProcessed: 0,
      offeringsCreated: 0,
      errors: []
    };

    // Process each business
    for (const business of businesses) {
      try {
        console.log(`🔧 Processing business: ${business.name} (${business.id})`);

        // Check if offerings already exist for this business
        const { data: existingOfferings } = await supabase
          .from('offerings')
          .select('id')
          .eq('business_id', business.id);

        if (existingOfferings && existingOfferings.length > 0) {
          console.log(`⚠️ Offerings already exist for business: ${business.name}`);
          results.businessesProcessed++;
          continue;
        }

        // Determine service type based on business type
        let serviceType = 'onsite';
        if (business.is_virtual) {
          serviceType = 'remote';
        } else if (business.is_mobile_business) {
          serviceType = 'mobile';
        }

        // Create primary offering from business data
        const offeringData = {
          business_id: business.id,
          title: business.primary_offering || business.name,
          description: business.description || business.short_description,
          tags: business.tags || [],
          service_type: serviceType,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: newOffering, error: offeringError } = await supabase
          .from('offerings')
          .insert(offeringData)
          .select('id')
          .single();

        if (offeringError) throw offeringError;

        results.offeringsCreated++;
        console.log(`✅ Created offering for business: ${business.name}`);

        // Add business image as primary offering image
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

          console.log(`✅ Added primary image for offering: ${newOffering.id}`);
        }

        // Add gallery images
        if (business.gallery_urls && business.gallery_urls.length > 0 && newOffering?.id) {
          const galleryImages = business.gallery_urls.map(url => ({
            offering_id: newOffering.id,
            source: 'platform',
            url: url,
            is_primary: false,
            approved: true,
            created_at: new Date().toISOString()
          }));

          await supabase
            .from('offering_images')
            .insert(galleryImages);

          console.log(`✅ Added ${galleryImages.length} gallery images for offering: ${newOffering.id}`);
        }

        results.businessesProcessed++;

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.error(`❌ Error processing business ${business.name}:`, error);
        results.errors.push(`${business.name}: ${error.message}`);
        results.businessesProcessed++;
      }
    }

    const message = `Ingested ${results.offeringsCreated} offerings from ${results.businessesProcessed} businesses`;
    console.log('✅ Batch ingestion completed:', message);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: message,
        businessesProcessed: results.businessesProcessed,
        offeringsCreated: results.offeringsCreated,
        errors: results.errors,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Business ingestion failed:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to ingest businesses',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};