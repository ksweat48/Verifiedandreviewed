// Generate Embeddings for Existing Businesses
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event, context) => {
  // Declare variables at the top level for proper scope
  let currentProcessingBusinessId = null;
  let effectiveBusinessId = null;
  
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
    const { businessId, batchSize = 10, forceRegenerate = false } = JSON.parse(event.body || '{}');

    // Robust businessId sanitization to prevent UUID syntax errors
    effectiveBusinessId = businessId;
    
    // Check if businessId is invalid and should be treated as undefined
    if (businessId) {
      const businessIdStr = String(businessId).trim().toLowerCase();
      const invalidValues = ['null', 'undefined', '', 'none', 'empty'];
      
      if (invalidValues.includes(businessIdStr)) {
        console.warn(`⚠️ Invalid businessId received: "${businessId}" - falling back to batch processing`);
        effectiveBusinessId = undefined;
      } else {
        // Validate UUID format (basic check)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(businessIdStr)) {
          console.warn(`⚠️ Invalid UUID format for businessId: "${businessId}" - falling back to batch processing`);
          effectiveBusinessId = undefined;
        }
      }
    }
    console.log('🔄 Starting embedding generation process...', effectiveBusinessId ? `for business ${effectiveBusinessId}` : `batch of ${batchSize}`);

    // Check required environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Initialize clients
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get businesses that need embeddings
    let queryBuilder = supabase
      .from('businesses')
      .select('id, name, description, short_description, category, location, tags')
      .eq('is_visible_on_platform', true);

    if (effectiveBusinessId) {
      // If a valid businessId is provided, process only that one
      queryBuilder = queryBuilder.eq('id', effectiveBusinessId).limit(1);
      console.log(`🎯 Processing single business: ${effectiveBusinessId}`);
    } else {
      // Otherwise, use the batch processing logic
      queryBuilder = queryBuilder
        .or(forceRegenerate ? 'id.neq.null' : 'embedding.is.null')
        .limit(batchSize);
      console.log(`📦 Processing batch of ${batchSize} businesses`);
    }

    const { data: businesses, error: fetchError } = await queryBuilder;

    if (fetchError) throw fetchError;

    // Critical: Filter out invalid UUIDs after fetching from Supabase
    // This prevents any "null" strings or malformed IDs from causing UUID syntax errors
    const validBusinesses = (businesses || []).filter(business => {
      if (!business.id) {
        console.warn(`⚠️ Skipping business with missing ID:`, business.name || 'Unknown');
        return false;
      }
      
      const businessIdStr = String(business.id).trim();
      
      // Check for invalid string values
      const invalidValues = ['null', 'undefined', '', 'none', 'empty', 'NULL'];
      if (invalidValues.includes(businessIdStr.toLowerCase())) {
        console.warn(`⚠️ Skipping business with invalid ID string: "${businessIdStr}" for business:`, business.name || 'Unknown');
        return false;
      }
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(businessIdStr)) {
        console.warn(`⚠️ Skipping business with invalid UUID format: "${businessIdStr}" for business:`, business.name || 'Unknown');
        return false;
      }
      
      return true;
    });

    if (!validBusinesses || validBusinesses.length === 0) {
      const message = effectiveBusinessId 
        ? `No business found with ID: ${effectiveBusinessId}`
        : `No valid businesses need embedding generation (${(businesses || []).length} total fetched, ${validBusinesses.length} valid)`;
        
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: message,
          processed: 0,
          businessId: effectiveBusinessId,
          timestamp: new Date().toISOString()
        })
      };
    }

    console.log(`📊 Processing ${validBusinesses.length} valid businesses (${(businesses || []).length} total fetched)...`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each business
    for (const business of validBusinesses) {
      try {
        // Set current business ID for error logging - CRITICAL: Set this first
        currentProcessingBusinessId = business.id;
        effectiveBusinessId = business.id;
        
        console.log(`🔍 VERBOSE: Starting processing for business ID: "${business.id}"`);
        console.log(`🔍 VERBOSE: Business ID type: ${typeof business.id}`);
        console.log(`🔍 VERBOSE: Business name: "${business.name}"`);
        
        // Generate search text for embedding
        const searchText = [
          business.name,
          business.description,
          business.short_description,
          business.category,
          business.location,
          Array.isArray(business.tags) ? business.tags.join(' ') : ''
        ].filter(Boolean).join(' ').trim();

        if (!searchText) {
          console.warn(`⚠️ VERBOSE: Skipping business ${business.id} (${business.name}) - no text content for embedding`);
          errorCount++;
          results.push({
            businessId: business.id,
            businessName: business.name || 'Unknown',
            success: false,
            error: 'No text content available for embedding generation'
          });
          continue;
        }

        console.log(`🧠 VERBOSE: Generating embedding for: ${business.name} (ID: ${business.id})`);
        console.log(`🧠 VERBOSE: Search text length: ${searchText.length} characters`);

        // Generate embedding using OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: searchText,
          encoding_format: 'float'
        });

        const embedding = embeddingResponse.data[0].embedding;
        
        console.log(`🔍 VERBOSE: Generated embedding with ${embedding.length} dimensions`);
        console.log(`🔍 VERBOSE: About to update business in Supabase...`);
        console.log(`🔍 VERBOSE: Business ID for update: "${business.id}" (type: ${typeof business.id})`);
        console.log(`🔍 VERBOSE: Embedding array length: ${embedding.length}`);
        console.log(`🔍 VERBOSE: Update timestamp: ${new Date().toISOString()}`);

        // TEMPORARY TEST: Update only timestamp first to isolate the issue
        console.log(`🔍 VERBOSE: Testing timestamp-only update first...`);
        const { error: timestampError } = await supabase
          .from('businesses')
          .update({ 
            updated_at: new Date().toISOString()
          })
          .eq('id', business.id);

        if (timestampError) {
          console.error(`❌ VERBOSE: Timestamp-only update failed for business ${business.id}:`, timestampError);
          throw timestampError;
        }
        
        console.log(`✅ VERBOSE: Timestamp-only update successful, now updating with embedding...`);
        
        // Now update with embedding
        const { error: updateError } = await supabase
          .from('businesses')
          .update({ 
            embedding: embedding,
            updated_at: new Date().toISOString()
          })
          .eq('id', business.id);

        if (updateError) {
          console.error(`❌ VERBOSE: Embedding update failed for business ${business.id}:`, updateError);
          throw updateError;
        }
        
        console.log(`✅ VERBOSE: Embedding update successful for business ${business.id}`);

        results.push({
          businessId: business.id,
          businessName: business.name,
          success: true,
          embeddingDimensions: embedding.length
        });

        successCount++;
        console.log(`✅ VERBOSE: Completed processing for: ${business.name} (ID: ${business.id})`);

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ VERBOSE: Error processing business ${currentProcessingBusinessId} (${business.name}):`, error);
        console.error(`❌ VERBOSE: Error details:`, {
          businessId: currentProcessingBusinessId,
          businessName: business.name,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint
        });
        results.push({
          businessId: currentProcessingBusinessId,
          businessName: business.name,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    console.log(`🎯 Embedding generation complete: ${successCount} success, ${errorCount} errors`);

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
        currentBusinessId: currentProcessingBusinessId,
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