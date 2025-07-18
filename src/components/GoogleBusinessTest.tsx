import React, { useState } from 'react';
import { RefreshCw, Search, CheckCircle, XCircle, AlertCircle, Terminal, Code, Globe } from 'lucide-react';

const GoogleBusinessTest = () => {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [responseDetails, setResponseDetails] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'discovery' | 'test'>('discovery');

  // Import GMBAccountDiscovery component only when needed
  const GMBAccountDiscovery = React.lazy(() => import('./GMBAccountDiscovery'));

  const testConnection = async () => {
    setStatus('testing');
    setError('');
    setResult(null);
    setResponseDetails(null);

    try {
      // Check if we're in development mode and need netlify dev
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('webcontainer');
      const isNetlifyDev = window.location.port === '8888' || window.location.href.includes('netlify');
      
      if (isDevelopment && !isNetlifyDev) {
        console.warn('Development Setup Required: You need to run "netlify dev" instead of "npm run dev" to test Netlify functions.');
        setStatus('error');
        setError('Development Setup Required: You need to run "netlify dev" instead of "npm run dev" to test Netlify functions.');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/.netlify/functions/google-reviews?accountId=test&locationId=test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Get response text first to see what we're actually receiving
      const responseText = await response.text();

      setResponseDetails({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyPreview: responseText.substring(0, 500),
        contentType: response.headers.get('content-type'),
        url: response.url
      });

      // Check if we got HTML instead of JSON
      if (responseText.trim().startsWith('<!doctype') || responseText.trim().startsWith('<html')) {
        throw new Error('Function returned HTML instead of JSON. Run "netlify dev" to serve functions locally');
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Response is not valid JSON. The function may have an error or isn't running.`);
      }

      if (response.ok) {
        setStatus('success');
        setResult(data);
      } else {
        setStatus('error');
        setError(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const testProductionFunction = async () => {
    setStatus('testing');
    setError('');
    setResult(null);
    setResponseDetails(null);

    try {
      // Test the production Netlify function directly
      const productionUrl = 'https://verifiedandreviewed.com/.netlify/functions/google-reviews?accountId=test&locationId=test';
      
      const response = await fetch(productionUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      
      setResponseDetails({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        bodyPreview: responseText.substring(0, 500),
        contentType: response.headers.get('content-type'),
        url: productionUrl
      });

      // Check if we got HTML instead of JSON
      if (responseText.trim().startsWith('<!doctype') || responseText.trim().startsWith('<html')) {
        throw new Error('Production function returned HTML - function may not be deployed correctly');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Response is not valid JSON. Received: ${responseText.substring(0, 100)}...`);
      }

      if (response.ok) {
        setStatus('success');
        setResult(data);
      } else {
        setStatus('error');
        setError(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Production function test failed');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'testing': return <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />;
      case 'success': return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error': return <XCircle className="h-6 w-6 text-red-500" />;
      default: return <AlertCircle className="h-6 w-6 text-neutral-500" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-neutral-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'testing':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-neutral-200 bg-neutral-50';
    }
  };

  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('webcontainer');
  const isProduction = window.location.hostname === 'verifiedandreviewed.com';
  const isNetlifyDev = window.location.port === '8888' || window.location.href.includes('netlify');

  return (
    <div className="space-y-6">
      {/* Enhanced Tab Navigation */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-neutral-200">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('discovery')}
            className={`flex-1 py-4 px-6 rounded-xl font-poppins font-semibold transition-all duration-200 flex items-center justify-center ${
              activeTab === 'discovery'
                ? 'bg-primary-500 text-white shadow-lg transform scale-105'
                : 'text-neutral-600 hover:text-primary-500 hover:bg-primary-50'
            }`}
          >
            <Icons.Search className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="text-lg">Step 1: Discover Account IDs</div>
              <div className={`text-sm ${activeTab === 'discovery' ? 'text-white opacity-90' : 'text-neutral-500'}`}>
                Find your Google Business IDs
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 py-4 px-6 rounded-xl font-poppins font-semibold transition-all duration-200 flex items-center justify-center ${
              activeTab === 'test'
                ? 'bg-primary-500 text-white shadow-lg transform scale-105'
                : 'text-neutral-600 hover:text-primary-500 hover:bg-primary-50'
            }`}
          >
            <Icons.TestTube className="h-5 w-5 mr-3" />
            <div className="text-left">
              <div className="text-lg">Step 2: Test API Connection</div>
              <div className={`text-sm ${activeTab === 'test' ? 'text-white opacity-90' : 'text-neutral-500'}`}>
                Test with real data
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'discovery' && (
        <div>
          <React.Suspense fallback={
            <div className="text-center py-8">
              <Icons.Loader className="h-8 w-8 text-primary-500 animate-spin mx-auto mb-4" />
              <p className="font-lora text-neutral-600">Loading discovery tool...</p>
            </div>
          }>
            <div className="text-center mb-6">
              <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
                🔍 Discover Your Google My Business IDs
              </h2>
              <p className="font-lora text-neutral-600 max-w-2xl mx-auto">
                First, we need to find your actual Google My Business account ID and location ID(s) using your service account.
              </p>
            </div>
            
            <GMBAccountDiscovery />
          </React.Suspense>
        </div>
      )}

      {activeTab === 'test' && (
        <div>
          <div className="text-center mb-6">
            <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
              🧪 Test API Connection
            </h2>
            <p className="font-lora text-neutral-600 max-w-2xl mx-auto">
              Once you have your account and location IDs, test the API connection with real data.
            </p>
          </div>

          {/* Environment Info */}
          <div className="bg-neutral-100 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Globe className="h-5 w-5 text-neutral-600 mr-2" />
                <span className="font-poppins text-sm font-medium text-neutral-700">
                  Current Environment:
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  isDevelopment ? (isNetlifyDev ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') : 
                  isProduction ? 'bg-green-100 text-green-700' : 
                  'bg-blue-100 text-blue-700'
                }`}>
                  {isDevelopment ? (isNetlifyDev ? '🔧 Netlify Dev' : '⚠️ Vite Dev') : isProduction ? '🌐 Production' : '🚀 Staging'}
                </span>
                <span className="font-mono text-xs text-neutral-600">
                  {window.location.hostname}:{window.location.port}
                </span>
              </div>
            </div>
          </div>

          {/* Development Warning */}
          {isDevelopment && !isNetlifyDev && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-6">
              <div className="flex items-center mb-4">
                <AlertCircle className="h-6 w-6 text-yellow-600 mr-3" />
                <h3 className="font-poppins text-lg font-semibold text-yellow-800">
                  ⚠️ Development Setup Required
                </h3>
              </div>
              
              <div className="space-y-4">
                <p className="font-lora text-yellow-700">
                  You're running the regular Vite dev server, but Netlify functions require the Netlify CLI dev server to work properly.
                </p>
                
                <div className="bg-yellow-100 rounded-lg p-4">
                  <h4 className="font-poppins font-semibold text-yellow-800 mb-2">
                    To test functions locally:
                  </h4>
                  <ol className="font-lora text-yellow-700 space-y-2 text-sm">
                    <li>1. Stop the current dev server (Ctrl+C)</li>
                    <li>2. Install Netlify CLI: <code className="bg-yellow-200 px-2 py-1 rounded">npm install -g netlify-cli</code></li>
                    <li>3. Run: <code className="bg-yellow-200 px-2 py-1 rounded">netlify dev</code></li>
                    <li>4. Access your app at: <code className="bg-yellow-200 px-2 py-1 rounded">localhost:8888</code></li>
                  </ol>
                </div>
                
                <p className="font-lora text-xs text-yellow-600">
                  The Netlify dev server serves both your frontend and functions at the correct endpoints.
                </p>
              </div>
            </div>
          )}

          {/* Main Test Panel */}
          <div className={`border-2 rounded-2xl p-6 ${getStatusColor()}`}>
            <div className="flex items-center mb-4">
              {getStatusIcon()}
              <h3 className="font-poppins text-lg font-semibold ml-3">
                Google Business Profile API Test
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
                <p className="font-lora text-sm mt-1">
                  {status === 'idle' && 'Ready to test connection'}
                  {status === 'testing' && 'Testing Google Business Profile API...'}
                  {status === 'success' && '✅ Connection successful!'}
                  {status === 'error' && `❌ Connection failed: ${error}`}
                </p>
              </div>

              {status === 'success' && result && (
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <h4 className="font-poppins font-semibold text-green-800 mb-2">
                    ✅ API Response Received!
                  </h4>
                  
                  {result.reviews && result.reviews.length > 0 ? (
                    <div>
                      <p className="font-lora text-sm text-green-700 mb-3">
                        Found {result.reviews.length} review(s):
                      </p>
                      <div className="space-y-3">
                        {result.reviews.slice(0, 2).map((review: any, index: number) => (
                          <div key={index} className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <div className="flex items-center mb-2">
                              <div className="flex text-yellow-400 mr-2">
                                {[...Array(review.starRating || 5)].map((_, i) => (
                                  <Star key={i} className="h-3 w-3 fill-current" />
                                ))}
                              </div>
                              <span className="font-poppins text-sm font-semibold text-green-800">
                                {review.reviewer?.displayName || 'Anonymous'}
                              </span>
                            </div>
                            <p className="font-lora text-xs text-green-700">
                              "{review.comment?.substring(0, 100)}..."
                            </p>
                            {review.businessName && (
                              <div className="flex items-center mt-2 text-green-600">
                                <MapPin className="h-3 w-3 mr-1" />
                                <span className="font-lora text-xs">
                                  {review.businessName} - {review.location}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-lora text-sm text-green-700 mb-2">
                        API connection successful, but using mock data for testing.
                      </p>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="font-lora text-xs text-yellow-700">
                          <strong>Note:</strong> To get real reviews, you'll need valid Account ID and Location ID from your Google Business Profile.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {status === 'error' && (
                <div className="bg-white rounded-lg p-4 border border-red-200">
                  <h4 className="font-poppins font-semibold text-red-800 mb-2">
                    ❌ Connection Failed
                  </h4>
                  <p className="font-lora text-sm text-red-700 mb-3">
                    Error details: {error}
                  </p>
                  
                  {error.includes('Development Setup Required') && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                      <p className="font-lora text-xs text-red-700 mb-2">
                        <strong>🚨 Development Server Issue:</strong>
                      </p>
                      <p className="font-lora text-xs text-red-700 mb-2">
                        You need to run <code className="bg-red-100 px-1 rounded">netlify dev</code> instead of <code className="bg-red-100 px-1 rounded">npm run dev</code> to test Netlify functions.
                      </p>
                      <div className="bg-red-100 rounded p-2 mt-2">
                        <p className="font-lora text-xs text-red-700 font-semibold">Quick Fix:</p>
                        <ol className="font-lora text-xs text-red-700 mt-1 space-y-1">
                          <li>1. Stop current server (Ctrl+C)</li>
                          <li>2. Run: <code>netlify dev</code></li>
                          <li>3. Open: <code>localhost:8888</code></li>
                        </ol>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-lora text-xs text-red-700 mb-2">
                      <strong>Other troubleshooting steps:</strong>
                    </p>
                    <ul className="font-lora text-xs text-red-700 space-y-1">
                      <li>• Ensure your site is deployed to Netlify</li>
                      <li>• Verify the function exists in netlify/functions/</li>
                      <li>• Check Netlify function logs for errors</li>
                      <li>• Ensure Google Cloud credentials are set correctly</li>
                      <li>• Enable Google My Business API in Google Cloud Console</li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={testConnection}
                  disabled={status === 'testing'}
                  className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'testing' ? 'Testing...' : 'Test Current Environment'}
                </button>
                
                <button
                  onClick={testProductionFunction}
                  disabled={status === 'testing'}
                  className="font-poppins bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'testing' ? 'Testing...' : 'Test Production API'}
                </button>
                
                {status !== 'idle' && (
                  <button
                    onClick={() => {
                      setStatus('idle');
                      setResult(null);
                      setError('');
                      setResponseDetails(null);
                    }}
                    className="font-poppins border border-neutral-200 text-neutral-700 px-4 py-2 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Response Details Panel */}
          {responseDetails && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
              <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                <Code className="h-5 w-5 mr-2" />
                Response Details
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
                
                {responseDetails.url && (
                  <div>
                    <span className="font-poppins text-sm font-medium text-gray-700">Request URL:</span>
                    <p className="font-mono text-sm mt-1 p-2 bg-neutral-100 rounded break-all">
                      {responseDetails.url}
                    </p>
                  </div>
                )}
                
                <div>
                  <span className="font-poppins text-sm font-medium text-gray-700">Response Body Preview:</span>
                  <pre className="font-mono text-xs mt-1 p-3 bg-neutral-100 rounded overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {responseDetails.bodyPreview}
                  </pre>
                </div>
                
                <details className="border border-neutral-200 rounded-lg">
                  <summary className="font-poppins text-sm font-medium text-gray-700 p-3 cursor-pointer hover:bg-neutral-50">
                    View Full Headers
                  </summary>
                  <pre className="font-mono text-xs p-3 bg-neutral-100 overflow-x-auto">
                    {JSON.stringify(responseDetails.headers, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}

          {/* Development Setup Guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h4 className="font-poppins font-semibold text-blue-800 mb-4 flex items-center">
              <Terminal className="h-5 w-5 mr-2" />
              🚀 Development Setup Guide
            </h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h5 className="font-poppins font-semibold text-blue-800 mb-2">Current Setup:</h5>
                  <p className="font-mono text-sm text-blue-700 break-all">
                    {window.location.origin}
                  </p>
                  <p className="font-lora text-xs text-blue-600 mt-1">
                    {isDevelopment ? (isNetlifyDev ? 'Netlify dev server ✅' : 'Regular Vite dev server ⚠️') : 'Production site'}
                  </p>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h5 className="font-poppins font-semibold text-blue-800 mb-2">Function URL:</h5>
                  <p className="font-mono text-sm text-blue-700 break-all">
                    {window.location.origin}/.netlify/functions/google-reviews
                  </p>
                  <p className="font-lora text-xs text-blue-600 mt-1">
                    Expected Netlify function endpoint
                  </p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h5 className="font-poppins font-semibold text-blue-800 mb-2">Setup Instructions:</h5>
                <div className="space-y-2">
                  {isDevelopment && !isNetlifyDev ? (
                    <div>
                      <p className="font-lora text-sm text-blue-700 mb-2">
                        <strong>For Local Development (Required):</strong>
                      </p>
                      <ol className="font-lora text-sm text-blue-700 space-y-1 ml-4">
                        <li>1. Stop current server: <code className="bg-blue-100 px-1 rounded">Ctrl+C</code></li>
                        <li>2. Install Netlify CLI: <code className="bg-blue-100 px-1 rounded">npm install -g netlify-cli</code></li>
                        <li>3. Run: <code className="bg-blue-100 px-1 rounded">netlify dev</code></li>
                        <li>4. Access functions at: <code className="bg-blue-100 px-1 rounded">localhost:8888/.netlify/functions/</code></li>
                      </ol>
                    </div>
                  ) : (
                    <div>
                      <p className="font-lora text-sm text-blue-700 mb-2">
                        <strong>For Production:</strong>
                      </p>
                      <ol className="font-lora text-sm text-blue-700 space-y-1 ml-4">
                        <li>1. Ensure your site is deployed to Netlify</li>
                        <li>2. Check Netlify dashboard for function deployment status</li>
                        <li>3. Add environment variables in Netlify settings</li>
                        <li>4. Check function logs for any errors</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h4 className="font-poppins font-semibold text-green-800 mb-4 flex items-center">
              <ExternalLink className="h-5 w-5 mr-2" />
              📋 Complete Setup Guide
            </h4>
            
            <div className="space-y-4">
              <div>
                <h5 className="font-poppins font-semibold text-green-800 mb-2">1. Google Cloud Console Setup:</h5>
                <ul className="font-lora text-sm text-green-700 space-y-1 ml-4">
                  <li>• Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                  <li>• Enable "Google My Business API" in APIs & Services</li>
                  <li>• Create a service account with "Business Profile Performance Reports" role</li>
                  <li>• Download the service account JSON key</li>
                </ul>
              </div>
              
              <div>
                <h5 className="font-poppins font-semibold text-green-800 mb-2">2. Environment Variables:</h5>
                <ul className="font-lora text-sm text-green-700 space-y-1 ml-4">
                  <li>• <code className="bg-green-100 px-1 rounded">GOOGLE_PROJECT_ID</code></li>
                  <li>• <code className="bg-green-100 px-1 rounded">GOOGLE_PRIVATE_KEY_ID</code></li>
                  <li>• <code className="bg-green-100 px-1 rounded">GOOGLE_PRIVATE_KEY</code></li>
                  <li>• <code className="bg-green-100 px-1 rounded">GOOGLE_CLIENT_EMAIL</code></li>
                  <li>• <code className="bg-green-100 px-1 rounded">GOOGLE_CLIENT_ID</code></li>
                </ul>
              </div>
              
              <div>
                <h5 className="font-poppins font-semibold text-green-800 mb-2">3. Get Business Profile IDs:</h5>
                <ul className="font-lora text-sm text-green-700 space-y-1 ml-4">
                  <li>• Go to <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google My Business</a></li>
                  <li>• Find your Account ID and Location ID in the URL</li>
                  <li>• Test with real IDs instead of "test" values</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleBusinessTest;