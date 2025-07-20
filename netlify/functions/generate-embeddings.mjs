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
    const { batchSize = 10, forceRegenerate = false } = JSON.parse(event.body || '{}');

    console.log('🔄 Starting embedding generation process...');

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
    const { data: businesses, error: fetchError } = await supabase
      .from('businesses')
      .select('id, name, description, short_description, category, location, tags')
      .or(forceRegenerate ? 'id.neq.null' : 'embedding.is.null')
      .eq('is_visible_on_platform', true)
      .limit(batchSize);

    if (fetchError) throw fetchError;

    if (!businesses || businesses.length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'No businesses need embedding generation',
          processed: 0,
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
          .eq('id', business.id);

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
        timestamp: new Date().toISOString()
      })
    };
  }
};