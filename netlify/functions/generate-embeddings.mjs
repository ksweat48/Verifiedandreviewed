// Generate Embeddings for Existing Businesses
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

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
    const { businessId, batchSize = 10, forceRegenerate = false } = JSON.parse(event.body || '{}');

    // Robust businessId sanitization to prevent UUID syntax errors
    let effectiveBusinessId = businessId;
    
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
      .not('id', 'is', null)
      .not('id', 'eq', 'null')
      .not('id', 'eq', '')
      .not('id', 'eq', 'NULL')
      .not('id', 'eq', 'undefined')
      .eq('is_visible_on_platform', true);

    if (businessId) {
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

    if (!businesses || businesses.length === 0) {
      const message = effectiveBusinessId 
        ? `No business found with ID: ${effectiveBusinessId}`
        : 'No businesses need embedding generation';
        
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: effectiveBusinessId 
            ? `Generated embedding for business ${effectiveBusinessId}`
            : `Generated embeddings for ${successCount} businesses`,
          processed: 0,
          businessId: effectiveBusinessId,
          businessId: effectiveBusinessId,
          timestamp: new Date().toISOString()
        })
      };
    }

    console.log(`📊 Processing ${businesses.length} businesses...`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each business
    for (const business of businesses) {
      try {
        // Validate business has required fields
        const businessIdStr = String(business.id || '').trim();
        if (!business.id || 
            business.id === null || 
            businessIdStr === '' ||
            businessIdStr === 'null' || 
            businessIdStr === 'NULL' ||
            businessIdStr === 'undefined' ||
            businessIdStr.toLowerCase() === 'null') {
          console.warn(`⚠️ Skipping business with invalid ID: ${JSON.stringify(business)}`);
          errorCount++;
          results.push({
            businessId: business.id || 'invalid',
            businessName: business.name || 'Unknown',
            success: false,
            error: 'Invalid or null business ID'
          });
          continue;
        }
        
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
          console.warn(`⚠️ Skipping business ${business.id} - no text content`);
          continue;
        }

        console.log(`🧠 Generating embedding for: ${business.name}`);

        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: searchText,
          encoding_format: 'float'
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Update business with embedding
        const { error: updateError } = await supabase
          .from('businesses')
          .update({ 
            embedding: embedding,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessIdStr);

        if (updateError) throw updateError;

        results.push({
          businessId: business.id,
          businessName: business.name,
          success: true,
          embeddingDimensions: embedding.length
        });

        successCount++;
        console.log(`✅ Generated embedding for: ${business.name}`);

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing business ${business.id}:`, error);
        results.push({
          businessId: business.id,
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
        processed: businesses.length,
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
        businessId: effectiveBusinessId,
        timestamp: new Date().toISOString()
      })
    };
  }
};