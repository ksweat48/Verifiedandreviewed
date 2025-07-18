// Google My Business Account & Location Discovery
import { GoogleAuth } from 'google-auth-library';

export const handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🔍 Starting Google My Business account discovery...');

    // Check if required environment variables are present
    const requiredEnvVars = [
      'GOOGLE_PROJECT_ID',
      'GOOGLE_PRIVATE_KEY_ID', 
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_CLIENT_EMAIL',
      'GOOGLE_CLIENT_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required environment variables',
          missingVariables: missingVars,
          message: `Please set these environment variables in your Netlify dashboard: ${missingVars.join(', ')}`,
          instructions: {
            step1: 'Go to your Netlify dashboard',
            step2: 'Navigate to Site settings → Environment variables',
            step3: 'Add the missing Google Cloud service account variables',
            step4: 'Redeploy your site for changes to take effect'
          }
        })
      };
    }

    // Enhanced private key cleaning and formatting
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
      console.log('🔧 Processing private key...');
      
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
      
      console.log('✅ Private key formatted successfully');
    }

    console.log('🔐 Initializing Google Auth...');
    console.log('📧 Service account email:', process.env.GOOGLE_CLIENT_EMAIL);

    // Initialize Google Auth with your service account
    const auth = new GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_CLIENT_EMAIL)}`
      },
      scopes: ['https://www.googleapis.com/auth/business.manage']
    });

    console.log('🔑 Getting auth client...');
    const authClient = await auth.getClient();
    console.log('✅ Authentication successful');

    // Step 1: List all accounts
    console.log('📋 Fetching accounts...');
    const accountsResponse = await authClient.request({
      url: 'https://mybusiness.googleapis.com/v4/accounts',
      method: 'GET'
    });

    const accounts = accountsResponse.data.accounts || [];
    console.log(`📊 Found ${accounts.length} account(s)`);

    if (accounts.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'No accounts found. Make sure your service account has been added as a manager to your Google Business Profile.',
          serviceAccountEmail: process.env.GOOGLE_CLIENT_EMAIL,
          accounts: [],
          locations: [],
          instructions: {
            step1: 'Go to https://business.google.com',
            step2: 'Select your business',
            step3: 'Go to Settings → Business Profile settings → Managers',
            step4: `Add this email as a manager: ${process.env.GOOGLE_CLIENT_EMAIL}`,
            step5: 'Wait a few minutes and try again'
          }
        })
      };
    }

    // Step 2: For each account, get locations
    const accountsWithLocations = [];
    
    for (const account of accounts) {
      console.log(`🏢 Processing account: ${account.name}`);
      
      try {
        const locationsResponse = await authClient.request({
          url: `https://mybusiness.googleapis.com/v4/${account.name}/locations`,
          method: 'GET'
        });

        const locations = locationsResponse.data.locations || [];
        console.log(`📍 Found ${locations.length} location(s) for account ${account.name}`);

        accountsWithLocations.push({
          accountId: account.name.split('/')[1], // Extract ID from "accounts/123456789"
          accountName: account.accountName || 'Unnamed Account',
          accountType: account.type || 'PERSONAL',
          fullAccountPath: account.name,
          locationCount: locations.length,
          locations: locations.map(location => ({
            locationId: location.name.split('/')[3], // Extract ID from "accounts/123/locations/456"
            locationName: location.locationName || 'Unnamed Location',
            address: location.address ? {
              streetAddress: location.address.addressLines?.join(', ') || '',
              city: location.address.locality || '',
              state: location.address.administrativeArea || '',
              postalCode: location.address.postalCode || '',
              country: location.address.regionCode || ''
            } : null,
            phoneNumber: location.primaryPhone || '',
            websiteUrl: location.websiteUrl || '',
            categories: location.primaryCategory ? [location.primaryCategory.displayName] : [],
            fullLocationPath: location.name,
            storeCode: location.storeCode || '',
            locationState: location.locationState || 'UNSPECIFIED'
          }))
        });
      } catch (locationError) {
        console.error(`❌ Error fetching locations for account ${account.name}:`, locationError);
        accountsWithLocations.push({
          accountId: account.name.split('/')[1],
          accountName: account.accountName || 'Unnamed Account',
          accountType: account.type || 'PERSONAL',
          fullAccountPath: account.name,
          locationCount: 0,
          locations: [],
          error: locationError.message
        });
      }
    }

    // Step 3: Return organized results
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `Successfully discovered ${accounts.length} account(s) and their locations`,
        serviceAccountEmail: process.env.GOOGLE_CLIENT_EMAIL,
        totalAccounts: accounts.length,
        totalLocations: accountsWithLocations.reduce((sum, acc) => sum + acc.locationCount, 0),
        accounts: accountsWithLocations,
        usage: {
          note: 'Use the accountId and locationId values in your API calls',
          example: {
            accountId: accountsWithLocations[0]?.accountId || 'ACCOUNT_ID_HERE',
            locationId: accountsWithLocations[0]?.locations[0]?.locationId || 'LOCATION_ID_HERE',
            apiCall: `/.netlify/functions/google-reviews?accountId=ACCOUNT_ID&locationId=LOCATION_ID`
          }
        }
      })
    };

  } catch (error) {
    console.error('🚨 Account discovery failed:', error);
    
    // Enhanced error handling with specific solutions
    let errorMessage = error.message;
    let troubleshooting = [];
    let solution = '';

    if (error.message.includes('1E08010C') || error.message.includes('DECODER')) {
      errorMessage = 'Private Key Format Error';
      solution = 'The private key from your Google Cloud service account JSON is not properly formatted.';
      troubleshooting = [
        '1. Go to Google Cloud Console → IAM & Admin → Service Accounts',
        '2. Find your service account and click "Manage Keys"',
        '3. Create a new JSON key (delete the old one)',
        '4. Open the downloaded JSON file',
        '5. Copy the ENTIRE "private_key" value (including quotes)',
        '6. In Netlify, set GOOGLE_PRIVATE_KEY to this exact value',
        '7. Make sure to include the quotes and \\n characters as-is',
        '8. Redeploy your site'
      ];
    } else if (error.message.includes('invalid_grant')) {
      errorMessage = 'Invalid service account credentials';
      solution = 'The service account credentials are incorrect or expired.';
      troubleshooting = [
        'Verify the service account email is correct',
        'Check that the private key matches the service account',
        'Ensure the service account has the correct permissions',
        'Try regenerating the service account key'
      ];
    }
    
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to discover accounts',
        message: errorMessage,
        solution: solution,
        troubleshooting: troubleshooting,
        originalError: error.message,
        serviceAccountEmail: process.env.GOOGLE_CLIENT_EMAIL
      })
    };
  }
};