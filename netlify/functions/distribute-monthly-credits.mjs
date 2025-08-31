// Automatic Monthly Credit Distribution
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
    const { userId } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required field',
          message: 'userId is required'
        })
      };
    }

    // Check required environment variables
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

    // Initialize Supabase client with service role key for elevated privileges
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('💰 Processing monthly credit distribution for user:', userId);

    // Get user's current profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits, last_monthly_credit_given_at, role')
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
    const lastCreditGivenAt = profile.last_monthly_credit_given_at;
    const userRole = profile.role;

    console.log('📊 User credit status:', {
      userId,
      currentCredits,
      lastCreditGivenAt,
      userRole
    });

    // Skip credit distribution for administrators
    if (userRole === 'administrator') {
      console.log('⚠️ Skipping monthly credits for administrator user');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          creditsAdded: 0,
          message: 'Administrator users do not receive monthly credits',
          currentCredits: currentCredits
        })
      };
    }

    // Check if user has 10 or more credits
    if (currentCredits >= 10) {
      console.log('💰 User has sufficient credits, no monthly distribution needed');
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          creditsAdded: 0,
          message: 'User has sufficient credits (10 or more)',
          currentCredits: currentCredits
        })
      };
    }

    // Check if user already received monthly credits this month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (lastCreditGivenAt) {
      const lastCreditDate = new Date(lastCreditGivenAt);
      const lastCreditMonth = lastCreditDate.getMonth();
      const lastCreditYear = lastCreditDate.getFullYear();

      if (lastCreditMonth === currentMonth && lastCreditYear === currentYear) {
        console.log('💰 User already received monthly credits this month');
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            creditsAdded: 0,
            message: 'Monthly credits already distributed this month',
            currentCredits: currentCredits,
            lastDistributedAt: lastCreditGivenAt
          })
        };
      }
    }

    // User qualifies for monthly credits - distribute 100 credits
    console.log('✅ User qualifies for monthly credits, distributing 100 credits');

    // Insert credit transaction (this will trigger the database function to update user credits)
    const { data: transaction, error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: 100,
        type: 'monthly-refill',
        description: 'Monthly free credits (auto-distributed when balance < 10)'
      })
      .select('*')
      .single();

    if (transactionError) {
      console.error('Error creating credit transaction:', transactionError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Failed to distribute monthly credits',
          message: transactionError.message
        })
      };
    }

    // Update the last monthly credit given timestamp
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        last_monthly_credit_given_at: now.toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating last monthly credit timestamp:', updateError);
      // Don't fail the entire operation if timestamp update fails
    }

    // Get updated user credits after transaction
    const { data: updatedProfile, error: updatedProfileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    const newCredits = updatedProfile?.credits || currentCredits + 100;

    console.log('✅ Monthly credit distribution successful:', {
      userId,
      previousCredits: currentCredits,
      creditsAdded: 100,
      newCredits: newCredits,
      transactionId: transaction.id
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        creditsAdded: 100,
        previousCredits: currentCredits,
        newCredits: newCredits,
        message: 'Monthly credits distributed successfully',
        transaction: transaction,
        distributedAt: now.toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Monthly credit distribution error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to distribute monthly credits',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};