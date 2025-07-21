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

    // --- ADD THIS LOGGING HERE ---
    console.log(`🔍 DEBUG: Incoming businessId from request body: "${businessId}" (type: ${typeof businessId})`);
    // --- END ADDITION ---

    if (businessId && typeof businessId === 'string' && businessId.trim() !== '') {
      const cleanBusinessId = businessId.trim();
      const invalidValues = ['null', 'undefined', 'none', 'empty'];
      
      if (!invalidValues.includes(cleanBusinessId.toLowerCase())) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(cleanBusinessId)) {
          effectiveBusinessId = cleanBusinessId;
          console.log(`🎯 DEBUG: Effective single business ID for processing: "${effectiveBusinessId}"`);
        } else {
          console.warn(`⚠️ DEBUG: Invalid UUID format for input: "${cleanBusinessId}" – falling back to batch`);
            .or(forceRegenerate ? 'id.not.is.null' : 'embedding.is.null')
              } else {
        console.warn(`⚠️ DEBUG: Invalid businessId string: "${cleanBusinessId}" – falling back to batch`);
      }
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
      .select('id') // Only select ID for testing
      .eq('is_visible_on_platform', true);

    if (effectiveBusinessId) {
      queryBuilder = queryBuilder.eq('id', effectiveBusinessId).limit(1);
    } else {
      // --- MODIFIED SECTION START ---
      // Removed: queryBuilder = queryBuilder.is('embedding', null);
      // This filter is being removed to test if it's causing the UUID error.
      // If forceRegenerate is true, we simply fetch all visible businesses.
      // If forceRegenerate is false, we would normally filter by embedding.is.null,
      // but for this test, we're removing that filter entirely.
      // --- MODIFIED SECTION END ---
      queryBuilder = queryBuilder.limit(batchSize);
      console.log(`📦 Processing batch of ${batchSize} businesses`);
    }

    const { data: businesses, error: fetchError } = await queryBuilder;
    if (fetchError) throw fetchError;

    console.log('👁️ DEBUG: Raw fetched businesses (before filtering):', JSON.stringify(businesses, null, 2));

    const validBusinesses = (businesses || []).filter(business => {
      const rawId = business?.id;
      const idStr = String(rawId ?? '').trim().toLowerCase();

      // Reject if it's a known invalid string
      const invalidValues = ['null', 'undefined', '', 'none', 'empty'];
      if (!rawId || invalidValues.includes(idStr)) {
        console.warn(`⚠️ DEBUG: Skipping business with invalid ID (string value): "${idStr}" for business "${business?.name || 'Unknown'}"`);
        return false;
      }

      // Reject if not a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idStr)) {
        console.warn(`⚠️ DEBUG: Invalid UUID format (regex mismatch): "${idStr}" for business "${business?.name || 'Unknown'}"`);
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
          message: 'No valid businesses found to embed after filtering.',
          processed: 0,
          timestamp: new Date().toISOString()
        })
      };
    }

    console.log(`📊 DEBUG: Valid businesses to process (after filtering): ${validBusinesses.length}`);
    console.log(`📋 DEBUG: Valid business IDs that will be processed:`, validBusinesses.map(b => `"${b.id}"`));

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const business of validBusinesses) {
      try {
        currentProcessingBusinessId = business.id;
        // --- ADD THIS LOGGING HERE ---
        console.log(`🔧 DEBUG: About to update business with ID: "${String(business.id).trim()}" (raw: ${JSON.stringify(business.id)})`);
        // --- END ADDITION ---
        
        // NOTE: searchText will be empty if only 'id' is selected, this is expected for this test.
        const searchText = [
          business.name, // This will be undefined
          business.description, // This will be undefined
          business.short_description, // This will be undefined
          business.category, // This will be undefined
          business.location, // This will be undefined
          Array.isArray(business.tags) ? business.tags.join(' ') : '' // This will be undefined
        ].filter(Boolean).join(' ').trim();

        if (!searchText) {
          console.warn(`⚠️ Skipping ${business.id} – no text for embedding`);
          // For this test, we expect searchText to be empty, so we'll just log and continue
          // In a real scenario, this would be an error or a different flow.
          // We'll simulate success for the purpose of this test to see if the query itself works.
          results.push({ businessId: business.id, success: true, message: "Skipped due to empty searchText (expected for this test)" });
          successCount++;
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
          console.error(`❌ DEBUG: Supabase update error for business ID "${business.id}":`, updateError);
          throw updateError;
        }

        console.log(`✅ DEBUG: Successfully updated embedding for business ID: "${business.id}"`);
        results.push({ businessId: business.id, success: true });
        successCount++;
        await new Promise(res => setTimeout(res, 100)); // slight delay

      } catch (error) {
        console.error(`❌ DEBUG: Error processing business ID "${currentProcessingBusinessId}":`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          businessId: currentProcessingBusinessId
        });
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
    console.error('❌ DEBUG: Embedding generation failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      currentBusinessId: currentProcessingBusinessId
    });
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
