import React, { useState } from 'react';
import * as Icons from 'lucide-react';

interface GoogleAccount {
  accountId: string;
  accountName: string;
  accountType: string;
  locationCount: number;
  locations: Array<{
    locationId: string;
    locationName: string;
    address: any;
    phoneNumber: string;
    websiteUrl: string;
    categories: string[];
  }>;
}

const GoogleBusinessProfileTest = () => {
  const [discoverStatus, setDiscoverStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [reviewsStatus, setReviewsStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [manualAccountId, setManualAccountId] = useState<string>('');
  const [manualLocationId, setManualLocationId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [responseDetails, setResponseDetails] = useState<any>(null);

  const testDiscoverAccounts = async () => {
    setDiscoverStatus('testing');
    setError('');
    setAccounts([]);
    setResponseDetails(null);

    try {
      console.log('🔍 Testing Google Business Profile account discovery...');
      
      const response = await fetch('/.netlify/functions/discover-gmb-accounts', {
        method: 'GET'
      });

      const responseText = await response.text();
      
      setResponseDetails({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyPreview: responseText.substring(0, 1000),
        contentType: response.headers.get('content-type')
      });

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Invalid JSON response from discovery function');
      }

      if (response.ok && data.success) {
        setDiscoverStatus('success');
        setAccounts(data.accounts || []);
        
        // Auto-select first account and location if available
        if (data.accounts && data.accounts.length > 0) {
          setSelectedAccount(data.accounts[0].accountId);
          if (data.accounts[0].locations && data.accounts[0].locations.length > 0) {
            setSelectedLocation(data.accounts[0].locations[0].locationId);
          }
        }
      } else {
        setDiscoverStatus('error');
        setError(data.message || data.error || 'Account discovery failed');
      }
    } catch (err) {
      setDiscoverStatus('error');
      setError(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const testGoogleReviews = async () => {
    const accountId = manualAccountId || selectedAccount;
    const locationId = manualLocationId || selectedLocation;
    
    if (!accountId || !locationId) {
      setError('Please provide both Account ID and Location ID');
      return;
    }

    setReviewsStatus('testing');
    setError('');
    setReviews([]);
    setResponseDetails(null);

    try {
      console.log('📝 Testing Google Reviews API with:', { accountId, locationId });
      
      const response = await fetch(`/.netlify/functions/google-reviews?accountId=${accountId}&locationId=${locationId}`, {
        method: 'GET'
      });

      const responseText = await response.text();
      
      setResponseDetails({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyPreview: responseText.substring(0, 1000),
        contentType: response.headers.get('content-type')
      });

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Invalid JSON response from reviews function');
      }

      if (response.ok && data.success) {
        setReviewsStatus('success');
        setReviews(data.reviews || []);
      } else {
        setReviewsStatus('error');
        setError(data.message || data.error || 'Reviews API failed');
        // Still show mock data if available
        if (data.reviews) {
          setReviews(data.reviews);
        }
      }
    } catch (err) {
      setReviewsStatus('error');
      setError(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing': return <Icons.RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'success': return <Icons.CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <Icons.XCircle className="h-5 w-5 text-red-500" />;
      default: return <Icons.Building className="h-5 w-5 text-neutral-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'testing': return 'border-blue-200 bg-blue-50';
      case 'success': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      default: return 'border-neutral-200 bg-neutral-50';
    }
  };

  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('webcontainer');
  const isNetlifyDev = window.location.port === '8888' || window.location.href.includes('netlify');

  return (
    <div className="space-y-6">
      {/* Development Warning */}
      {isDevelopment && !isNetlifyDev && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <Icons.AlertCircle className="h-6 w-6 text-yellow-600 mr-3" />
            <h3 className="font-poppins text-lg font-semibold text-yellow-800">
              ⚠️ Development Setup Required
            </h3>
          </div>
          
          <div className="space-y-4">
            <p className="font-lora text-yellow-700">
              Google Business Profile API functions require the Netlify CLI dev server.
            </p>
            
            <div className="bg-yellow-100 rounded-lg p-4">
              <h4 className="font-poppins font-semibold text-yellow-800 mb-2">
                Quick Fix:
              </h4>
              <ol className="font-lora text-yellow-700 space-y-1 text-sm">
                <li>1. Stop current server: <kbd className="bg-yellow-200 px-2 py-1 rounded">Ctrl+C</kbd></li>
                <li>2. Install Netlify CLI: <code className="bg-yellow-200 px-2 py-1 rounded">npm install -g netlify-cli</code></li>
                <li>3. Run: <code className="bg-yellow-200 px-2 py-1 rounded">netlify dev</code></li>
                <li>4. Access at: <code className="bg-yellow-200 px-2 py-1 rounded">localhost:8888</code></li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Discover Accounts & Locations */}
      <div className={`border-2 rounded-2xl p-6 ${getStatusColor(discoverStatus)}`}>
        <div className="flex items-center mb-4">
          {getStatusIcon(discoverStatus)}
          <h3 className="font-poppins text-lg font-semibold ml-3">
            Step 1: Discover Google Business Accounts
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Discover your Google Business Profile accounts and locations to get the required IDs for API calls.
            </p>
          </div>

          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
            <p className="font-lora text-sm mt-1">
              {discoverStatus === 'idle' && 'Ready to discover accounts'}
              {discoverStatus === 'testing' && 'Discovering accounts and locations...'}
              {discoverStatus === 'success' && `✅ Found ${accounts.length} account(s)!`}
              {discoverStatus === 'error' && `❌ Discovery failed: ${error}`}
            </p>
          </div>

          {discoverStatus === 'success' && accounts.length > 0 && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-poppins font-semibold text-green-800 mb-4">
                ✅ Discovered Accounts & Locations
              </h4>
              
              {accounts.map((account, index) => (
                <div key={index} className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-poppins font-semibold text-green-900">
                      {account.accountName}
                    </h5>
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-poppins font-semibold">
                      {account.locationCount} locations
                    </span>
                  </div>
                  
                  <p className="font-mono text-sm text-green-700 mb-3">
                    Account ID: <code className="bg-green-100 px-2 py-1 rounded">{account.accountId}</code>
                  </p>
                  
                  {account.locations.length > 0 && (
                    <div className="space-y-2">
                      <h6 className="font-poppins font-semibold text-green-800">Locations:</h6>
                      {account.locations.map((location, locIndex) => (
                        <div key={locIndex} className="bg-white p-3 rounded border border-green-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-poppins font-semibold text-green-900">
                              {location.locationName}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedAccount(account.accountId);
                                setSelectedLocation(location.locationId);
                              }}
                              className="bg-green-500 text-white px-2 py-1 rounded text-xs font-poppins font-semibold hover:bg-green-600 transition-colors duration-200"
                            >
                              Select
                            </button>
                          </div>
                          <p className="font-mono text-xs text-green-600">
                            Location ID: <code className="bg-green-100 px-1 rounded">{location.locationId}</code>
                          </p>
                          {location.address && (
                            <p className="font-lora text-xs text-green-700 mt-1">
                              {location.address.streetAddress}, {location.address.city}, {location.address.state}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={testDiscoverAccounts}
            disabled={discoverStatus === 'testing' || (isDevelopment && !isNetlifyDev)}
            className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {discoverStatus === 'testing' ? 'Discovering...' : 'Discover Accounts & Locations'}
          </button>
        </div>
      </div>

      {/* Step 2: Test Google Reviews API */}
      <div className={`border-2 rounded-2xl p-6 ${getStatusColor(reviewsStatus)}`}>
        <div className="flex items-center mb-4">
          {getStatusIcon(reviewsStatus)}
          <h3 className="font-poppins text-lg font-semibold ml-3">
            Step 2: Test Google Reviews API
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Test fetching reviews from your Google Business Profile using the discovered account and location IDs.
            </p>
          </div>

          {/* Account and Location Selection */}
          <div className="bg-white rounded-lg p-4 border border-neutral-200">
            <h4 className="font-poppins font-semibold text-neutral-800 mb-4">API Parameters</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Account ID
                </label>
                <input
                  type="text"
                  value={manualAccountId || selectedAccount}
                  onChange={(e) => setManualAccountId(e.target.value)}
                  placeholder="Enter account ID or use discovered"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Location ID
                </label>
                <input
                  type="text"
                  value={manualLocationId || selectedLocation}
                  onChange={(e) => setManualLocationId(e.target.value)}
                  placeholder="Enter location ID or use discovered"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <p className="font-lora text-xs text-neutral-500 mt-2">
              Use the IDs discovered above or enter them manually if you know them.
            </p>
          </div>

          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
            <p className="font-lora text-sm mt-1">
              {reviewsStatus === 'idle' && 'Ready to test reviews API'}
              {reviewsStatus === 'testing' && 'Fetching reviews...'}
              {reviewsStatus === 'success' && `✅ Found ${reviews.length} review(s)!`}
              {reviewsStatus === 'error' && `❌ Reviews API failed: ${error}`}
            </p>
          </div>

          {reviewsStatus === 'success' && reviews.length > 0 && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-poppins font-semibold text-green-800 mb-4">
                ✅ Google Reviews ({reviews.length})
              </h4>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {reviews.map((review, index) => (
                  <div key={index} className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-poppins font-semibold text-green-900">
                        {review.reviewer?.displayName || 'Anonymous'}
                      </span>
                      <div className="flex items-center">
                        <div className="flex text-yellow-400 mr-2">
                          {[...Array(review.starRating || 5)].map((_, i) => (
                            <Icons.Star key={i} className="h-4 w-4 fill-current" />
                          ))}
                        </div>
                        <span className="font-poppins text-sm font-semibold text-green-700">
                          {review.starRating || 5}/5
                        </span>
                      </div>
                    </div>
                    
                    <p className="font-lora text-sm text-green-700">
                      {review.comment || 'No comment provided'}
                    </p>
                    
                    {review.createTime && (
                      <p className="font-lora text-xs text-green-600 mt-2">
                        {new Date(review.createTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={testGoogleReviews}
            disabled={reviewsStatus === 'testing' || (isDevelopment && !isNetlifyDev)}
            className="font-poppins bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reviewsStatus === 'testing' ? 'Testing...' : 'Test Google Reviews API'}
          </button>
        </div>
      </div>

      {/* Response Details Panel */}
      {responseDetails && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
          <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
            <Icons.Code className="h-5 w-5 mr-2" />
            API Response Details
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
                <p className={`font-mono text-sm mt-1 p-2 rounded ${
                  responseDetails.status === 200 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {responseDetails.status} {responseDetails.statusText}
                </p>
              </div>
              
              <div>
                <span className="font-poppins text-sm font-medium text-gray-700">Content Type:</span>
                <p className={`font-mono text-sm mt-1 p-2 rounded ${
                  responseDetails.contentType?.includes('application/json') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {responseDetails.contentType || 'Unknown'}
                </p>
              </div>
            </div>
            
            <div>
              <span className="font-poppins text-sm font-medium text-gray-700">Response Body Preview:</span>
              <pre className="font-mono text-xs mt-1 p-3 bg-neutral-100 rounded overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                {responseDetails.bodyPreview}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h4 className="font-poppins font-semibold text-blue-800 mb-4 flex items-center">
          <Icons.Settings className="h-5 w-5 mr-2" />
          🔧 Google Business Profile API Setup
        </h4>
        
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">1. Google Cloud Console Setup:</h5>
            <ol className="font-lora text-blue-700 space-y-1 text-sm">
              <li>1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
              <li>2. Create a new project or select existing one</li>
              <li>3. Enable "Google Business Profile API" and "Google Places API"</li>
              <li>4. Create a service account with appropriate permissions</li>
              <li>5. Download the service account JSON key</li>
            </ol>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">2. Netlify Environment Variables:</h5>
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <code className="bg-blue-100 p-2 rounded">GOOGLE_PROJECT_ID</code>
                <code className="bg-blue-100 p-2 rounded">GOOGLE_PRIVATE_KEY_ID</code>
                <code className="bg-blue-100 p-2 rounded">GOOGLE_PRIVATE_KEY</code>
                <code className="bg-blue-100 p-2 rounded">GOOGLE_CLIENT_EMAIL</code>
                <code className="bg-blue-100 p-2 rounded">GOOGLE_CLIENT_ID</code>
                <code className="bg-blue-100 p-2 rounded">GOOGLE_PLACES_API_KEY</code>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">3. Google Business Profile Setup:</h5>
            <ol className="font-lora text-blue-700 space-y-1 text-sm">
              <li>1. Go to <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Business Profile</a></li>
              <li>2. Select your business</li>
              <li>3. Go to Settings → Business Profile settings → Managers</li>
              <li>4. Add your service account email as a manager</li>
              <li>5. Wait 5-10 minutes for permissions to propagate</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Fallback Information */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
        <h4 className="font-poppins font-semibold text-orange-800 mb-4 flex items-center">
          <Icons.MapPin className="h-5 w-5 mr-2" />
          🗺️ Coordinate Fallback System
        </h4>
        
        <div className="space-y-4">
          <p className="font-lora text-orange-700">
            If Google Business Profile API is not working, the system automatically falls back to using coordinates from Google Places API for AI-generated businesses.
          </p>
          
          <div className="bg-white rounded-lg p-4 border border-orange-200">
            <h5 className="font-poppins font-semibold text-orange-800 mb-2">Fallback Features:</h5>
            <ul className="font-lora text-orange-700 space-y-1 text-sm">
              <li>• AI businesses always include latitude/longitude from Google Places</li>
              <li>• "Take Me There" works with coordinates even without Business Profile API</li>
              <li>• Distance calculations use Google Places coordinate data</li>
              <li>• Map navigation functions normally with coordinate fallback</li>
            </ul>
          </div>
          
          <div className="bg-orange-100 rounded-lg p-3">
            <p className="font-lora text-xs text-orange-700">
              <strong>Note:</strong> The coordinate fallback is already implemented in the unified search system. 
              AI-generated businesses will always have location data for map functionality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleBusinessProfileTest;