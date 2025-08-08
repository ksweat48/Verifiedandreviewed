// Secure Credit Deduction Function
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, extractUserIdFromAuth, getClientIP, createRateLimitResponse } from '../utils/rateLimiter.mjs';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Rate limiting configuration for credit deduction
const RATE_LIMIT_CONFIG = {
  maxRequests: 30,
  windowSeconds: 60, // 30 requests per minute
  functionName: 'deduct-credits'
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

    const { userId, amount, type, description } = JSON.parse(event.body);

    if (!userId || !amount || !type) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required fields',
          message: 'userId, amount, and type are required'
        })
      };
    }

    // Rate limiting check
    console.log('🚦 Checking rate limits for credit deduction...');
    
    // Use the provided userId for rate limiting
    const identifier = { value: userId, type: 'user_id' };
    
    console.log('🔍 Rate limit identifier:', identifier);
    
    const rateLimitResult = await checkRateLimit(
      identifier,
      RATE_LIMIT_CONFIG,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      event.headers['user-agent'],
      { type, amount }
    );
    
    if (!rateLimitResult.allowed) {
      console.log('🚫 Rate limit exceeded for credit deduction');
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }
    
    console.log('✅ Rate limit check passed, remaining:', rateLimitResult.remaining);


    // Initialize Supabase client with service role key for elevated privileges
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('💳 Processing credit deduction:', { userId, amount, type, description });

    // First, check if user has enough credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'User not found',
          message: profileError.message
        })
      };
    }

    const currentCredits = profile.credits || 0;
    const creditsToDeduct = Math.abs(amount); // Ensure positive value

    if (currentCredits < creditsToDeduct) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Insufficient credits',
          message: `You need ${creditsToDeduct} credits to search. You have ${currentCredits} credits.`
        })
      };
    }

    // Insert credit transaction (this will trigger the database function to update user credits)
    const { data: transaction, error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -creditsToDeduct, // Negative for deduction
        type: type,
        description: description || `Credit deduction for ${type}`
      })
      .select('*')
      .single();

    if (transactionError) {
      console.error('Error creating credit transaction:', transactionError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Failed to deduct credits',
          message: transactionError.message
        })
      };
    }

    // Get updated user credits after transaction
    const { data: updatedProfile, error: updatedProfileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    const newCredits = updatedProfile?.credits || 0;

    console.log('✅ Credit deduction successful:', {
      userId,
      previousCredits: currentCredits,
      deducted: creditsToDeduct,
      newCredits: newCredits,
      transactionId: transaction.id
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        transaction: transaction,
        previousCredits: currentCredits,
        newCredits: newCredits,
        deducted: creditsToDeduct
      })
    };

  } catch (error) {
    console.error('❌ Credit deduction error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to deduct credits',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};