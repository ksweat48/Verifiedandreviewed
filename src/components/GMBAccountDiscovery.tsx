import React, { useState } from 'react';
import { Search, TestTube, RefreshCw, CheckCircle, XCircle, Users, Key, Copy, MapPin, Phone, Globe, ExternalLink } from 'lucide-react';

interface Account {
  accountId: string;
  accountName: string;
  accountType: string;
  fullAccountPath: string;
  locationCount: number;
  locations: Location[];
  error?: string;
}

interface Location {
  locationId: string;
  locationName: string;
  address: {
    streetAddress: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  phoneNumber: string;
  websiteUrl: string;
  categories: string[];
  fullLocationPath: string;
  storeCode: string;
  locationState: string;
}

interface DiscoveryResult {
  success: boolean;
  message: string;
  serviceAccountEmail?: string;
  totalAccounts?: number;
  totalLocations?: number;
  accounts?: Account[];
  usage?: {
    note: string;
    example: {
      accountId: string;
      locationId: string;
      apiCall: string;
    };
  };
  instructions?: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    step5: string;
  };
  troubleshooting?: {
    commonIssues: string[];
    nextSteps: string[];
  };
}

const GMBAccountDiscovery = () => {
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string>('');

  const discoverAccounts = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Check if we're in the right environment
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('webcontainer');
      const isNetlifyDev = window.location.port === '8888' || window.location.href.includes('netlify');
      
      if (isDevelopment && !isNetlifyDev) {
        throw new Error('Development Setup Required: You need to run "netlify dev" instead of "npm run dev" to test Netlify functions.');
      }
      
      const response = await fetch('/.netlify/functions/discover-gmb-accounts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      
      // Check if we got HTML instead of JSON (common when function isn't running)
      if (responseText.trim().startsWith('<!doctype') || responseText.trim().startsWith('<html')) {
        throw new Error('Function returned HTML instead of JSON. Make sure you\'re running "netlify dev" and the function is deployed.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response`);
      }

      setResult(data);

      if (!data.success) {
          console.warn('Development Setup Required: You need to run "netlify dev" instead of "npm run dev" to test Netlify functions.');
          setResult({
            success: false,
            message: 'Development Setup Required: You need to run "netlify dev" instead of "npm run dev" to test Netlify functions.',
            troubleshooting: {
              commonIssues: [
                'Netlify functions not running (use netlify dev)',
                'Network connectivity issues'
              ],
              nextSteps: [
                'Stop current server (Ctrl+C) and run: netlify dev',
                'Check browser console for detailed errors'
              ]
            }
          });
          setLoading(false);
          return;
      }
      if (data.success) {
        // Success
      } else {
        // Warning
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to connect to discovery function',
        troubleshooting: {
          commonIssues: [
            'Netlify functions not running (use netlify dev)',
            'Network connectivity issues',
            'Function deployment problems',
            'Service account credentials not configured'
          ],
          nextSteps: [
            'Stop current server (Ctrl+C) and run: netlify dev',
            'Check browser console for detailed errors',
            'Verify function exists in netlify/functions/',
            'Ensure environment variables are set correctly'
          ]
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const getStatusIcon = () => {
    if (loading) return <Icons.RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />;
    if (!result) return <Icons.Search className="h-6 w-6 text-neutral-500" />;
    if (result.success) return <Icons.CheckCircle className="h-6 w-6 text-green-500" />;
    return <Icons.XCircle className="h-6 w-6 text-red-500" />;
  };

  const getStatusColor = () => {
    if (loading) return 'border-blue-200 bg-blue-50';
    if (!result) return 'border-neutral-200 bg-neutral-50';
    if (result.success) return 'border-green-200 bg-green-50';
    return 'border-red-200 bg-red-50';
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
              You're running the regular Vite dev server, but Netlify functions require the Netlify CLI dev server.
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

      {/* Header */}
      <div className={`border-2 rounded-2xl p-6 ${getStatusColor()}`}>
        <div className="flex items-center mb-4">
          {getStatusIcon()}
          <h3 className="font-poppins text-lg font-semibold ml-3">
            Google My Business Account Discovery
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Discover your Google My Business account IDs and location IDs using your service account credentials.
              This will give you the exact IDs needed for the API calls.
            </p>
          </div>

          <div className="bg-neutral-50 rounded-lg p-4">
            <h4 className="font-poppins font-semibold text-neutral-800 mb-2">
              📋 What this will find:
            </h4>
            <ul className="font-lora text-sm text-neutral-700 space-y-1">
              <li>• Your Google My Business account ID(s)</li>
              <li>• All location IDs under each account</li>
              <li>• Business names and addresses</li>
              <li>• Ready-to-use API call examples</li>
            </ul>
          </div>

          <button
                ? 'bg-primary-500 text-white shadow-lg transform scale-105'
                : 'text-neutral-600 hover:text-primary-500 hover:bg-primary-50'
            className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <Icons.RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Discovering Accounts...
              </>
            ) : (
              <>
                <Icons.Search className="h-5 w-5 mr-2" />
                Discover My Accounts & Locations
              </>
            )}
          </button>

          {isDevelopment && !isNetlifyDev && (
            onClick={() => setActiveTab('test')}
              Button disabled: Please run "netlify dev" first
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Success Results */}
          {result.success && result.accounts && result.accounts.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
              <div className="flex items-center mb-6">
                <Icons.CheckCircle className="h-6 w-6 text-green-500 mr-3" />
                <div>
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900">
                    ✅ Discovery Successful!
                  </h3>
                  <p className="font-lora text-neutral-600">
                    Found {result.totalAccounts} account(s) with {result.totalLocations} location(s)
                  </p>
                </div>
              </div>

              {/* Service Account Info */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-2">
                  <Icons.Key className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="font-poppins font-semibold text-blue-800">Service Account</span>
                </div>
                <p className="font-mono text-sm text-blue-700 break-all">
                  {result.serviceAccountEmail}
                </p>
              </div>

              {/* Accounts and Locations */}
              <div className="space-y-6">
                {result.accounts.map((account, accountIndex) => (
                  <div key={account.accountId} className="border border-neutral-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Icons.Building className="h-5 w-5 text-neutral-600 mr-3" />
                        <div>
                          <h4 className="font-poppins text-lg font-semibold text-neutral-900">
                            {account.accountName}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-neutral-600">
                            <span>Type: {account.accountType}</span>
                            <span>Locations: {account.locationCount}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => copyToClipboard(account.accountId, `account-${accountIndex}`)}
                        className="flex items-center bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-lg transition-colors duration-200"
                      >
                        {copiedText === `account-${accountIndex}` ? (
                          <Icons.CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <Icons.Copy className="h-4 w-4 text-neutral-600 mr-2" />
                        )}
                        <span className="font-mono text-sm font-semibold">
                          {account.accountId}
                        </span>
                      </button>
                    </div>

                    {account.error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <p className="font-lora text-sm text-red-700">
                          Error loading locations: {account.error}
                        </p>
                      </div>
                    )}

                    {/* Locations */}
                    {account.locations.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="font-poppins font-semibold text-neutral-800">Locations:</h5>
                        {account.locations.map((location, locationIndex) => (
                          <div key={location.locationId} className="bg-neutral-50 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center mb-2">
                                  <Icons.MapPin className="h-4 w-4 text-neutral-600 mr-2" />
                                  <h6 className="font-poppins font-semibold text-neutral-900">
                                    {location.locationName}
                                  </h6>
                                </div>
                                
                                {location.address && (
                                  <p className="font-lora text-sm text-neutral-600 mb-2">
                                    {location.address.streetAddress}, {location.address.city}, {location.address.state} {location.address.postalCode}
                                  </p>
                                )}
                                
                                <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
                                  {location.phoneNumber && (
                                    <div className="flex items-center">
                                      <Icons.Phone className="h-3 w-3 mr-1" />
                                      <span>{location.phoneNumber}</span>
                                    </div>
                                  )}
                                  {location.websiteUrl && (
                                    <div className="flex items-center">
                                      <Icons.Globe className="h-3 w-3 mr-1" />
                                      <a href={location.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        Website
                                      </a>
                                    </div>
                                  )}
                                  {location.categories.length > 0 && (
                                    <span>Categories: {location.categories.join(', ')}</span>
                                  )}
                                </div>
                              </div>
                              
                              <button
                                onClick={() => copyToClipboard(location.locationId, `location-${accountIndex}-${locationIndex}`)}
                                className="flex items-center bg-white hover:bg-neutral-100 px-3 py-2 rounded-lg transition-colors duration-200 border border-neutral-200"
                              >
                                {copiedText === `location-${accountIndex}-${locationIndex}` ? (
                                  <Icons.CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                ) : (
                                  <Icons.Copy className="h-4 w-4 text-neutral-600 mr-2" />
                                )}
                                <span className="font-mono text-sm font-semibold">
                                  {location.locationId}
                                </span>
                              </button>
                            </div>

                            {/* Test API Call */}
                            <div className="bg-white rounded border border-neutral-200 p-3">
                              <p className="font-poppins text-xs font-semibold text-neutral-700 mb-2">
                                Test API Call:
                              </p>
                              <div className="flex items-center justify-between">
                                <code className="font-mono text-xs text-neutral-600 break-all">
                                  /.netlify/functions/google-reviews?accountId={account.accountId}&locationId={location.locationId}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(
                                    `/.netlify/functions/google-reviews?accountId=${account.accountId}&locationId=${location.locationId}`,
                                    `api-${accountIndex}-${locationIndex}`
                                  )}
                                  className="ml-2 p-1 hover:bg-neutral-100 rounded"
                                >
                                  {copiedText === `api-${accountIndex}-${locationIndex}` ? (
                                    <Icons.CheckCircle className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Icons.Copy className="h-3 w-3 text-neutral-600" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Usage Instructions */}
              {result.usage && (
                <div className="bg-green-50 rounded-lg p-4 mt-6">
                  <h4 className="font-poppins font-semibold text-green-800 mb-2">
                    🎯 How to Use These IDs:
                  </h4>
                  <p className="font-lora text-sm text-green-700 mb-3">
                    {result.usage.note}
                  </p>
                  <div className="bg-white rounded border border-green-200 p-3">
                    <p className="font-poppins text-xs font-semibold text-green-800 mb-2">Example:</p>
                    <div className="space-y-1 font-mono text-xs text-green-700">
                      <div>Account ID: <span className="font-semibold">{result.usage.example.accountId}</span></div>
                      <div>Location ID: <span className="font-semibold">{result.usage.example.locationId}</span></div>
                      <div>API Call: <span className="font-semibold">{result.usage.example.apiCall}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Access Instructions */}
          {result.success === false && result.instructions && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
              <div className="flex items-center mb-6">
                <Icons.Users className="h-6 w-6 text-orange-500 mr-3" />
                <div>
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900">
                    🔐 Service Account Needs Access
                  </h3>
                  <p className="font-lora text-neutral-600">
                    Your service account hasn't been added as a manager to your Google Business Profile yet.
                  </p>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4 mb-6">
                <h4 className="font-poppins font-semibold text-orange-800 mb-3">
                  📋 Follow these steps to grant access:
                </h4>
                <ol className="font-lora text-sm text-orange-700 space-y-2">
                  <li><strong>1.</strong> {result.instructions.step1}</li>
                  <li><strong>2.</strong> {result.instructions.step2}</li>
                  <li><strong>3.</strong> {result.instructions.step3}</li>
                  <li><strong>4.</strong> {result.instructions.step4}</li>
                  <li><strong>5.</strong> {result.instructions.step5}</li>
                </ol>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-poppins font-semibold text-blue-800 mb-2">
                  📧 Service Account Email:
                </h4>
                <div className="flex items-center justify-between bg-white rounded border border-blue-200 p-3">
                  <code className="font-mono text-sm text-blue-700 break-all">
                    {result.serviceAccountEmail}
                  </code>
                  <button
                    onClick={() => copyToClipboard(result.serviceAccountEmail || '', 'service-email')}
                    className="ml-2 p-1 hover:bg-blue-100 rounded"
                  >
                    {copiedText === 'service-email' ? (
                      <Icons.CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Icons.Copy className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                </div>
                <p className="font-lora text-xs text-blue-600 mt-2">
                  Copy this email and add it as a manager in your Google Business Profile settings.
                </p>
              </div>

              {/* Direct Link to Google Business */}
              <div className="mt-4">
                <a
                  href="https://business.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center font-poppins bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors duration-200"
                >
                  <Icons.ExternalLink className="h-4 w-4 mr-2" />
                  Open Google Business Profile
                </a>
              </div>
            </div>
          )}

          {/* Error Troubleshooting */}
          {result.success === false && result.troubleshooting && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
              <div className="flex items-center mb-6">
                <Icons.AlertCircle className="h-6 w-6 text-red-500 mr-3" />
                <h3 className="font-poppins text-xl font-semibold text-neutral-900">
                  🔧 Troubleshooting
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-poppins font-semibold text-red-800 mb-3">
                    Common Issues:
                  </h4>
                  <ul className="font-lora text-sm text-red-700 space-y-1">
                    {result.troubleshooting.commonIssues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-poppins font-semibold text-green-800 mb-3">
                    Next Steps:
                  </h4>
                  <ul className="font-lora text-sm text-green-700 space-y-1">
                    {result.troubleshooting.nextSteps.map((step, index) => (
                      <li key={index}>• {step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GMBAccountDiscovery;