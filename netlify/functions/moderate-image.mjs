// Google Cloud Vision SafeSearch Image Moderation
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { checkRateLimit, extractUserIdFromAuth, getClientIP, createRateLimitResponse } from '../utils/rateLimiter.mjs';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Rate limiting configuration for image moderation
const RATE_LIMIT_CONFIG = {
  maxRequests: 20,
  windowSeconds: 60, // 20 requests per minute
  functionName: 'moderate-image'
};

export const handler = async (event) => {
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

    const { imageUrl } = JSON.parse(event.body);

    if (!imageUrl) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Image URL is required',
          message: 'Please provide a valid image URL for moderation'
        })
      };
    }

    // Rate limiting check
    console.log('🚦 Checking rate limits for image moderation...');
    
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
      { imageUrl: imageUrl.substring(0, 100) }
    );
    
    if (!rateLimitResult.allowed) {
      console.log('🚫 Rate limit exceeded for image moderation');
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }
    
    console.log('✅ Rate limit check passed, remaining:', rateLimitResult.remaining);

    // Check if required Google Cloud Vision environment variables are present
    const requiredEnvVars = [
      'GCP_PROJECT_ID',
      'GCP_PRIVATE_KEY_ID', 
      'GCP_PRIVATE_KEY',
      'GCP_CLIENT_EMAIL',
      'GCP_CLIENT_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Google Cloud Vision API not configured',
          missingVariables: missingVars,
          message: `Please set these environment variables in your Netlify dashboard: ${missingVars.join(', ')}`,
          instructions: {
            step1: 'Go to Google Cloud Console and create a service account',
            step2: 'Enable the Cloud Vision API for your project',
            step3: 'Download the service account JSON key',
            step4: 'Add the required environment variables to Netlify',
            step5: 'Redeploy your site for changes to take effect'
          }
        })
      };
    }

    // Enhanced private key cleaning and formatting
    let privateKey = process.env.GCP_PRIVATE_KEY;
    if (privateKey) {
      console.log('🔧 Processing Google Cloud private key...');
      
      // Remove any surrounding quotes
      privateKey = privateKey.replace(/^["']|["']$/g, '');
      
      // Handle different newline formats
      privateKey = privateKey.replace(/\\n/g, '\n');
      privateKey = privateKey.replace(/\\\\/g, '\\');
      
      // Ensure proper line breaks around the key markers
      privateKey = privateKey.replace(/-----BEGIN PRIVATE KEY-----\s*/g, '-----BEGIN PRIVATE KEY-----\n');
      privateKey = privateKey.replace(/\s*-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');
      
      // Remove any extra whitespace but preserve necessary line breaks
      privateKey = privateKey.replace(/\n\s+/g, '\n');
      privateKey = privateKey.replace(/\s+\n/g, '\n');
      
      // Validate the key format
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
        throw new Error('Invalid private key format. Must contain BEGIN and END markers.');
      }
      
      console.log('✅ Google Cloud private key formatted successfully');
    }

    console.log('🔐 Initializing Google Cloud Vision client...');
    console.log('📧 Service account email:', process.env.GCP_CLIENT_EMAIL);
    console.log('🆔 Project ID:', process.env.GCP_PROJECT_ID);

    // Initialize Google Cloud Vision client
    const client = new ImageAnnotatorClient({
      credentials: {
        type: 'service_account',
        project_id: process.env.GCP_PROJECT_ID,
        private_key_id: process.env.GCP_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.GCP_CLIENT_EMAIL,
        client_id: process.env.GCP_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GCP_CLIENT_EMAIL)}`
      }
    });

    console.log('🔍 Sending image to Google Vision SafeSearch:', imageUrl);

    // Perform SafeSearch detection
    const [result] = await client.safeSearchDetection(imageUrl);
    const safeSearch = result.safeSearchAnnotation;

    console.log('📊 Google Vision SafeSearch Result:', safeSearch);

    // Define safety thresholds - you can adjust these based on your content policy
    // VERY_UNLIKELY, UNLIKELY, POSSIBLE = safe
    // LIKELY, VERY_LIKELY = unsafe
    const isSafe = (
      (safeSearch.adult === 'VERY_UNLIKELY' || safeSearch.adult === 'UNLIKELY' || safeSearch.adult === 'POSSIBLE') &&
      (safeSearch.medical === 'VERY_UNLIKELY' || safeSearch.medical === 'UNLIKELY' || safeSearch.medical === 'POSSIBLE') &&
      (safeSearch.racy === 'VERY_UNLIKELY' || safeSearch.racy === 'UNLIKELY' || safeSearch.racy === 'POSSIBLE') &&
      (safeSearch.spoof === 'VERY_UNLIKELY' || safeSearch.spoof === 'UNLIKELY' || safeSearch.spoof === 'POSSIBLE') &&
      (safeSearch.violence === 'VERY_UNLIKELY' || safeSearch.violence === 'UNLIKELY' || safeSearch.violence === 'POSSIBLE')
    );

    // Determine the primary reason for rejection
    let reason = 'Image passed all SafeSearch checks';
    let confidence = 1.0;

    if (!isSafe) {
      if (safeSearch.adult === 'LIKELY' || safeSearch.adult === 'VERY_LIKELY') {
        reason = 'Adult content detected';
        confidence = safeSearch.adult === 'VERY_LIKELY' ? 0.95 : 0.75;
      } else if (safeSearch.racy === 'LIKELY' || safeSearch.racy === 'VERY_LIKELY') {
        reason = 'Racy content detected';
        confidence = safeSearch.racy === 'VERY_LIKELY' ? 0.95 : 0.75;
      } else if (safeSearch.violence === 'LIKELY' || safeSearch.violence === 'VERY_LIKELY') {
        reason = 'Violent content detected';
        confidence = safeSearch.violence === 'VERY_LIKELY' ? 0.95 : 0.75;
      } else if (safeSearch.medical === 'LIKELY' || safeSearch.medical === 'VERY_LIKELY') {
        reason = 'Medical content detected';
        confidence = safeSearch.medical === 'VERY_LIKELY' ? 0.95 : 0.75;
      } else if (safeSearch.spoof === 'LIKELY' || safeSearch.spoof === 'VERY_LIKELY') {
        reason = 'Spoof content detected';
        confidence = safeSearch.spoof === 'VERY_LIKELY' ? 0.95 : 0.75;
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        passed: isSafe,
        reason: reason,
        confidence: confidence,
        details: {
          adult: safeSearch.adult,
          medical: safeSearch.medical,
          racy: safeSearch.racy,
          spoof: safeSearch.spoof,
          violence: safeSearch.violence
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Google Vision moderation error:', error);
    
    // Enhanced error handling with specific solutions
    let errorMessage = error.message;
    let troubleshooting = [];
    let solution = '';

    if (error.message.includes('API has not been used') || error.message.includes('disabled')) {
      errorMessage = 'Google Cloud Vision API not enabled';
      solution = 'You need to enable the Google Cloud Vision API in your Google Cloud Console.';
      troubleshooting = [
        '1. Go to Google Cloud Console → APIs & Services → Library',
        '2. Search for "Cloud Vision API"',
        '3. Click on it and press "Enable"',
        '4. Wait 2-3 minutes for propagation',
        '5. Try your request again'
      ];
    } else if (error.message.includes('1E08010C') || error.message.includes('DECODER')) {
      errorMessage = 'Private Key Format Error';
      solution = 'The private key from your Google Cloud service account JSON is not properly formatted.';
      troubleshooting = [
        '1. Go to Google Cloud Console → IAM & Admin → Service Accounts',
        '2. Find your service account and click "Manage Keys"',
        '3. Create a new JSON key (delete the old one)',
        '4. Open the downloaded JSON file',
        '5. Copy the ENTIRE "private_key" value (including quotes)',
        '6. In Netlify, set GCP_PRIVATE_KEY to this exact value',
        '7. Make sure to include the quotes and \\n characters as-is',
        '8. Redeploy your site'
      ];
    } else if (error.message.includes('invalid_grant')) {
      errorMessage = 'Invalid service account credentials';
      solution = 'The service account credentials are incorrect or expired.';
      troubleshooting = [
        'Verify the service account email is correct',
        'Check that the private key matches the service account',
        'Ensure the service account has Cloud Vision API User role',
        'Try regenerating the service account key'
      ];
    }
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Image moderation failed',
        message: errorMessage,
        solution: solution,
        troubleshooting: troubleshooting,
        originalError: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};