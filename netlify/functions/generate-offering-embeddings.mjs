// Generate embeddings for offerings using OpenAI
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
    const { offeringId, batchSize = 10, forceRegenerate = false } = JSON.parse(event.body || '{}');

    console.log('🧠 Offering embedding generation request:', { offeringId, batchSize, forceRegenerate });

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

    let queryBuilder = supabase
      .from('offerings')
      .select(`
        id,
        title,
        description,
        tags,
        service_type,
        businesses!inner (
          name,
          category,
          location,
          description,
          tags
        )
      `)
      .eq('status', 'active');

    // Single offering or batch processing
    if (offeringId) {
      queryBuilder = queryBuilder.eq('id', offeringId).limit(1);
      console.log('🎯 Processing single offering:', offeringId);
    } else {
      if (!forceRegenerate) {
        // Only process offerings without embeddings
        const { data: offeringsWithoutEmbeddings, error: checkError } = await supabase
          .from('offerings_embeddings')
          .select('offering_id');
        
        if (!checkError && offeringsWithoutEmbeddings) {
          const embeddedOfferingIds = offeringsWithoutEmbeddings.map(e => e.offering_id);
          if (embeddedOfferingIds.length > 0) {
            queryBuilder = queryBuilder.not('id', 'in', `(${embeddedOfferingIds.join(',')})`);
          }
        }
      }
      queryBuilder = queryBuilder.limit(batchSize);
      console.log(`📦 Processing batch of ${batchSize} offerings`);
    }

    const { data: offerings, error: fetchError } = await queryBuilder;
    if (fetchError) throw fetchError;

    if (!offerings || offerings.length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'No offerings found to process',
          processed: 0,
          successCount: 0,
          errorCount: 0
        })
      };
    }

    console.log(`🔄 Processing ${offerings.length} offerings for embedding generation`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each offering
    for (const offering of offerings) {
      try {
        console.log(`🔧 Processing offering: ${offering.title} (${offering.id})`);

        // Build comprehensive text for embedding
        const business = offering.businesses;
        const embeddingText = [
          // Offering details
          offering.title,
          offering.description,
          offering.service_type,
          Array.isArray(offering.tags) ? offering.tags.join(' ') : '',
          
          // Business context
          business.name,
          business.category,
          business.location,
          business.description,
          Array.isArray(business.tags) ? business.tags.join(' ') : ''
        ].filter(Boolean).join(' ').trim();

        if (!embeddingText) {
          console.warn(`⚠️ No text available for offering ${offering.id}`);
          results.push({
            offeringId: offering.id,
            success: false,
            error: 'No text available for embedding'
          });
          errorCount++;
          continue;
        }

        // Generate embedding
        console.log(`🧠 Generating embedding for: "${embeddingText.substring(0, 100)}..."`);
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingText,
          encoding_format: 'float'
        });

        const embedding = embeddingResponse.data[0].embedding;
        console.log(`✅ Generated embedding with ${embedding.length} dimensions`);

        // Store embedding in database
        const { error: embeddingError } = await supabase
          .from('offerings_embeddings')
          .upsert({
            offering_id: offering.id,
            embedding: embedding,
            updated_at: new Date().toISOString()
          });

        if (embeddingError) throw embeddingError;

        console.log(`✅ Stored embedding for offering: ${offering.id}`);
        results.push({
          offeringId: offering.id,
          offeringTitle: offering.title,
          success: true,
          embeddingDimensions: embedding.length
        });
        successCount++;

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing offering ${offering.id}:`, error);
        results.push({
          offeringId: offering.id,
          offeringTitle: offering.title,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    const message = `Generated embeddings for ${successCount}/${offerings.length} offerings`;
    console.log('✅ Batch embedding generation completed:', message);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: message,
        processed: offerings.length,
        successCount,
        errorCount,
        results
      })
    };

  } catch (error) {
    console.error('❌ Offering embedding generation failed:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to generate offering embeddings',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};