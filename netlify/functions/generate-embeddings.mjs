// Generate Embeddings for Existing Businesses
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event, context) => {
  let currentProcessingBusinessId = null;
  let effectiveBusinessId = undefined;

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
    const { businessId, batchSize = 10, forceRegenerate = false } = JSON.parse(event.body || '{}');

    if (businessId && typeof businessId === 'string' && businessId.trim() !== '') {
      const cleanBusinessId = businessId.trim();
      const invalidValues = ['null', 'undefined', 'none', 'empty'];
      
      if (!invalidValues.includes(cleanBusinessId.toLowerCase())) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(cleanBusinessId)) {
          effectiveBusinessId = cleanBusinessId;
          console.log(`🎯 Processing single business: ${effectiveBusinessId}`);
        } else {
          console.warn(`⚠️ Invalid UUID format: "${businessId}" – falling back to batch`);
        }
      } else {
        console.warn(`⚠️ Invalid businessId: "${businessId}" – falling back to batch`);
      }
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing required environment variables');
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let queryBuilder = supabase
      .from('businesses')
      .select('id, name, description, short_description, category, location, tags')
      .eq('is_visible_on_platform', true);

    if (effectiveBusinessId) {
      queryBuilder = queryBuilder.eq('id', effectiveBusinessId).limit(1);
    } else {
      queryBuilder = queryBuilder
        .or(forceRegenerate ? 'id.neq.null' : 'embedding.is.null')
        .limit(batchSize);
      console.log(`📦 Processing batch of ${batchSize} businesses`);
    }

    const { data: businesses, error: fetchError } = await queryBuilder;
    if (fetchError) throw fetchError;

    console.log('👁️ Raw fetched businesses:', JSON.stringify(businesses, null, 2));

    console.log('👁️ Raw fetched businesses:', JSON.stringify(businesses, null, 2));

    const validBusinesses = (businesses || []).filter(business => {
      const rawId = business?.id;
      const idStr = String(rawId ?? '').trim().toLowerCase();

      // Reject if it's a known invalid string
      const invalidValues = ['null', 'undefined', '', 'none', 'empty'];
      if (!rawId || invalidValues.includes(idStr)) {
        console.warn(`⚠️ Skipping business with invalid ID: "${idStr}"`, business.name);
        return false;
      }

      // Reject if not a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idStr)) {
        console.warn(`⚠️ Invalid UUID format: "${idStr}"`, business.name);
        return false;
      }

      return true;
    });

    if (!validBusinesses.length) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'No valid businesses found to embed.',
          processed: 0,
          timestamp: new Date().toISOString()
        })
      };
    }

    console.log(`📊 Valid businesses to process: ${validBusinesses.length}`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const business of validBusinesses) {
      try {
        currentProcessingBusinessId = business.id;
        const searchText = [
          business.name,
          business.description,
          business.short_description,
          business.category,
          business.location,
          Array.isArray(business.tags) ? business.tags.join(' ') : ''
        ].filter(Boolean).join(' ').trim();

        if (!searchText) {
          console.warn(`⚠️ Skipping ${business.id} – no text for embedding`);
          errorCount++;
          continue;
        }

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: searchText,
          encoding_format: 'float'
        });

        const embedding = embeddingResponse.data[0].embedding;

        const { error: updateError } = await supabase
          .from('businesses')
          .update({
            embedding: embedding,
            updated_at: new Date().toISOString()
          })
          .eq('id', String(business.id).trim());

        if (updateError) {
          throw updateError;
        }

        results.push({ businessId: business.id, success: true });
        successCount++;
        await new Promise(res => setTimeout(res, 100)); // slight delay

      } catch (error) {
        console.error(`❌ Error on ${currentProcessingBusinessId}:`, error);
        errorCount++;
        results.push({
          businessId: currentProcessingBusinessId,
          success: false,
          error: error.message
        });
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `Generated embeddings for ${successCount} businesses`,
        processed: validBusinesses.length,
        successCount,
        errorCount,
        results,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to generate embeddings',
        message: error.message,
        currentBusinessId: currentProcessingBusinessId || 'unknown',
        errorDetails: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        },
        timestamp: new Date().toISOString()
      })
    };
  }
};
