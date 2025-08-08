// netlify/functions/generate-embeddings.mjs
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, extractUserIdFromAuth, getClientIP, createRateLimitResponse } from '../utils/rateLimiter.mjs';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Rate limiting configuration for embedding generation
const RATE_LIMIT_CONFIG = {
  maxRequests: 5,
  windowSeconds: 300, // 5 requests per 5 minutes (embedding generation is expensive)
  functionName: 'generate-embeddings'
};

export const handler = async (event, context) => {
  let currentProcessingBusinessId = null;
  let effectiveBusinessId = undefined;
  let currentProcessingOfferingId = null;
  let effectiveOfferingId = undefined;

  // Declare the variables at the top of the handler function
  let businessId;
  let offeringId;
  let entityType;
  let batchSize;
  let forceRegenerate;
  let openaiApiKey;

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
    // Check required environment variables first
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Supabase credentials not configured',
          message: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables'
        })
      };
    }

    const body = JSON.parse(event.body || '{}');
    // Assign values to the already declared variables
    businessId = body.businessId;
    offeringId = body.offeringId;
    entityType = body.entityType || 'business'; // Assign here
    batchSize = body.batchSize || 10;
    forceRegenerate = body.forceRegenerate || false;

    // Rate limiting check (more lenient for admin operations)
    console.log('🚦 Checking rate limits for embedding generation...');
    
    // Try to get user ID from auth header, fallback to IP
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const userId = await extractUserIdFromAuth(authHeader, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const clientIP = getClientIP(event);
    
    const identifier = userId 
      ? { value: userId, type: 'user_id' }
      : { value: clientIP, type: 'ip_address' };
    
    console.log('🔍 Rate limit identifier:', identifier);
    
    const rateLimitResult = await checkRateLimit(
      identifier,
      RATE_LIMIT_CONFIG,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      event.headers['user-agent'],
      { entityType, businessId: businessId?.substring(0, 36), offeringId: offeringId?.substring(0, 36) }
    );
    
    if (!rateLimitResult.allowed) {
      console.log('🚫 Rate limit exceeded for embedding generation');
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }
    
    console.log('✅ Rate limit check passed, remaining:', rateLimitResult.remaining);

    // Check required environment variables
    openaiApiKey = process.env.OPENAI_API_KEY;

    console.log(`🔍 DEBUG: Incoming parameters:`, {
      businessId,
      offeringId,
      entityType,
      batchSize,
      forceRegenerate
    });

    // Validate entityType
    if (!['business', 'offering'].includes(entityType)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid entityType',
          message: 'entityType must be either "business" or "offering"'
        })
      };
    }

    // Process businessId if provided and entityType is business
    if (entityType === 'business' && businessId && typeof businessId === 'string' && businessId.trim() !== '') {
      const cleanBusinessId = businessId.trim();
      const invalidValues = ['null', 'undefined', '', 'none', 'empty'];
      
      if (!invalidValues.includes(cleanBusinessId.toLowerCase())) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(cleanBusinessId)) {
          effectiveBusinessId = cleanBusinessId;
          console.log(`🎯 DEBUG: Effective single business ID for processing: "${effectiveBusinessId}"`);
        } else {
          console.warn(`⚠️ DEBUG: Invalid UUID format for input: "${cleanBusinessId}" – falling back to batch`);
        }
      } else {
        console.warn(`⚠️ DEBUG: Invalid businessId string: "${cleanBusinessId}" – falling back to batch`);
      }
    }

    // Process offeringId if provided and entityType is offering
    if (entityType === 'offering' && offeringId && typeof offeringId === 'string' && offeringId.trim() !== '') {
      const cleanOfferingId = offeringId.trim();
      const invalidValues = ['null', 'undefined', '', 'none', 'empty'];
      
      if (!invalidValues.includes(cleanOfferingId.toLowerCase())) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(cleanOfferingId)) {
          effectiveOfferingId = cleanOfferingId;
          console.log(`🎯 DEBUG: Effective single offering ID for processing: "${effectiveOfferingId}"`);
        } else {
          console.warn(`⚠️ DEBUG: Invalid UUID format for offering input: "${cleanOfferingId}" – falling back to batch`);
        }
      } else {
        console.warn(`⚠️ DEBUG: Invalid offeringId string: "${cleanOfferingId}" – falling back to batch`);
    if (!openaiApiKey) {
      console.warn('⚠️ OpenAI API key not configured - no-op mode');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true,
          message: 'OpenAI API key not configured - skipping embedding generation',
          processed: 0,
          successCount: 0,
          errorCount: 0,
          timestamp: new Date().toISOString()
        })
      };
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let queryBuilder;

    if (entityType === 'business') {
      queryBuilder = supabase
        .from('businesses')
        .select('id, name, description, short_description, category, location, tags, embedding, is_visible_on_platform');

      if (effectiveBusinessId) {
        queryBuilder = queryBuilder.eq('id', effectiveBusinessId).limit(1);
      } else {
        queryBuilder = queryBuilder.eq('is_visible_on_platform', true);
        if (!forceRegenerate) {
          queryBuilder = queryBuilder.is('embedding', null);
        }
        queryBuilder = queryBuilder.limit(batchSize);
        console.log(`📦 Processing batch of ${batchSize} businesses`);
      }
    } else if (entityType === 'offering') {
      queryBuilder = supabase
        .from('offerings')
        .select('id, title, description, tags, status');

      if (effectiveOfferingId) {
        queryBuilder = queryBuilder.eq('id', effectiveOfferingId).limit(1);
      } else {
        queryBuilder = queryBuilder.eq('status', 'active');
        if (!forceRegenerate) {
          // Check if embedding doesn't exist in offerings_embeddings table
          const { data: existingEmbeddings } = await supabase
            .from('offerings_embeddings')
            .select('offering_id');
          
          const embeddedOfferingIds = existingEmbeddings?.map(e => e.offering_id) || [];
          if (embeddedOfferingIds.length > 0) {
            queryBuilder = queryBuilder.not('id', 'in', `(${embeddedOfferingIds.map(id => `'${id}'`).join(',')})`);
          }
        }
        queryBuilder = queryBuilder.limit(batchSize);
        console.log(`📦 Processing batch of ${batchSize} offerings`);
      }
    }

    const { data: entities, error: fetchError } = await queryBuilder;
    if (fetchError) throw fetchError;

    console.log(`👁️ DEBUG: Raw fetched ${entityType}s (before filtering):`, JSON.stringify(entities, null, 2));

    const validEntities = (entities || []).filter(entity => {
      const rawId = entity?.id;
      const idStr = String(rawId ?? '').trim().toLowerCase();

      const invalidValues = ['null', 'undefined', '', 'none', 'empty'];
      if (!rawId || invalidValues.includes(idStr)) {
        console.warn(`⚠️ DEBUG: Skipping ${entityType} with invalid ID (string value): "${idStr}" for ${entityType} "${entity?.name || entity?.title || 'Unknown'}"`);
        return false;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idStr)) {
        console.warn(`⚠️ DEBUG: Invalid UUID format (regex mismatch): "${idStr}" for ${entityType} "${entity?.name || entity?.title || 'Unknown'}"`);
        return false;
      }

      return true;
    });

    if (!validEntities.length) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: `No valid ${entityType}s found to embed after filtering.`,
          processed: 0,
          successCount: 0,
          errorCount: 0,
          timestamp: new Date().toISOString()
        })
      };
    }

    console.log(`📊 DEBUG: Valid ${entityType}s to process (after filtering): ${validEntities.length}`);
    console.log(`📋 DEBUG: Valid ${entityType} IDs that will be processed:`, validEntities.map(e => `"${e.id}"`));

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const entity of validEntities) {
      try {
        if (entityType === 'business') {
          currentProcessingBusinessId = entity.id;
          console.log(`🔧 DEBUG: Processing business ID: "${String(entity.id).trim()}"`);
        } else {
          currentProcessingOfferingId = entity.id;
          console.log(`🔧 DEBUG: Processing offering ID: "${String(entity.id).trim()}"`);
        }
        
        let searchText;
        if (entityType === 'business') {
          searchText = [
            entity.name,
            entity.description,
            entity.short_description,
            entity.category,
            entity.location,
            Array.isArray(entity.tags) ? entity.tags.join(' ') : ''
          ].filter(Boolean).join(' | ').trim();
        } else {
          // For offerings: title + description + tags
          searchText = [
            entity.title,
            entity.description ?? '',
            Array.isArray(entity.tags) ? entity.tags.join(' ') : ''
          ].filter(Boolean).join(' | ').trim();
        }

        if (!searchText) {
          console.warn(`⚠️ Skipping ${entity.id} – no text for embedding`);
          results.push({ 
            [`${entityType}Id`]: entity.id, 
            success: false, 
            error: "No text for embedding" 
          });
          errorCount++;
          continue; 
        }

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: searchText,
          encoding_format: 'float'
        });

        const embedding = embeddingResponse.data[0].embedding;

        let updateError;
        if (entityType === 'business') {
          const { error } = await supabase
            .from('businesses')
            .update({
              embedding: embedding,
              updated_at: new Date().toISOString()
            })
            .eq('id', String(entity.id).trim());
          updateError = error;
        } else {
          // For offerings, upsert into offerings_embeddings table
          const { error } = await supabase
            .from('offerings_embeddings')
            .upsert({
              offering_id: entity.id,
              embedding: embedding,
              updated_at: new Date().toISOString()
            });
          updateError = error;
        }

        if (updateError) {
          console.error(`❌ DEBUG: Supabase update error for ${entityType} ID "${entity.id}":`, updateError);
          throw updateError;
        }

        console.log(`✅ DEBUG: Successfully updated embedding for ${entityType} ID: "${entity.id}"`);
        results.push({ 
          [`${entityType}Id`]: entity.id, 
          [`${entityType}Name`]: entity.name || entity.title,
          success: true, 
          embeddingDimensions: embedding.length 
        });
        successCount++;
        await new Promise(res => setTimeout(res, 100)); // slight delay

      } catch (error) {
        const currentId = entityType === 'business' ? currentProcessingBusinessId : currentProcessingOfferingId;
        console.error(`❌ DEBUG: Error processing ${entityType} ID "${currentId}":`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          [`${entityType}Id`]: currentId
        });
        errorCount++;
        results.push({
          [`${entityType}Id`]: currentId,
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
        message: `Generated embeddings for ${successCount} ${entityType}s`,
        processed: validEntities.length,
        successCount,
        errorCount,
        results,
        entityType,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    const currentId = entityType === 'business' ? currentProcessingBusinessId : currentProcessingOfferingId;
    console.error('❌ DEBUG: Embedding generation failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      [`current${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`]: currentId
    });
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: `Failed to generate ${entityType} embeddings`,
        message: error.message,
        [`current${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`]: currentId || 'unknown',
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