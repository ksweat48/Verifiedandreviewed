import React, { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Zap, Code } from 'lucide-react';

const OpenAIConnectionTest = () => {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [responseDetails, setResponseDetails] = useState<any>(null);

  const testOpenAIConnection = async () => {
    setStatus('testing');
    setError('');
    setResult(null);
    setResponseDetails(null);

    try {
      // Check if we're in the right environment
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('webcontainer');
      const isNetlifyDev = window.location.port === '8888' || window.location.href.includes('netlify');
      
      if (isDevelopment && !isNetlifyDev) {
        console.warn('Development Setup Required: You need to run "netlify dev" instead of "npm run dev" to test Netlify functions.');
        setStatus('error');
        setError('Development Setup Required: You need to run "netlify dev" instead of "npm run dev" to test Netlify functions.');
        setLoading(false);
        return;
      }
      
      // Test the content generation function which uses OpenAI
      const response = await fetch('/.netlify/functions/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: 'Test Restaurant',
          businessCategory: 'Restaurant',
          reviewText: 'Great food and excellent service. Clean facilities and friendly staff.',
          reviewRating: 5,
          location: 'Test City, State',
          imageUrls: []
        })
      });

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
        throw new Error('Function returned HTML instead of JSON. Run "netlify dev" to serve functions locally.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) { 
        throw new Error(`Invalid JSON response`);
      }

      if (response.ok && data.success) {
        setStatus('success');
        setResult(data);
      } else {
        setStatus('error');
        setError(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
        setResult(null);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'testing': return <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />;
      case 'success': return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error': return <XCircle className="h-6 w-6 text-red-500" />;
      default: return <Zap className="h-6 w-6 text-neutral-500" />;
      case 'error':
        return <Icons.XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Icons.Zap className="h-6 w-6 text-neutral-500" />;
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

      {/* Main Test Panel */}
      <div className={`border-2 rounded-2xl p-6 ${getStatusColor()}`}>
        <div className="flex items-center mb-4">
          {getStatusIcon()}
          <h3 className="font-poppins text-lg font-semibold ml-3">
            OpenAI API Connection Test
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Test your OpenAI API connection to ensure content generation is working correctly.
            </p>
          </div>

          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
            <p className="font-lora text-sm mt-1">
              {status === 'idle' && 'Ready to test OpenAI connection'}
              {status === 'testing' && 'Testing OpenAI API...'}
              {status === 'success' && '✅ OpenAI connection successful!'}
              {status === 'error' && `❌ Connection failed: ${error}`}
            </p>
          </div>

          {status === 'success' && result && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-poppins font-semibold text-green-800 mb-2">
                ✅ OpenAI API Working!
              </h4>
              
              {result.content && (
                <div>
                  <p className="font-lora text-sm text-green-700 mb-3">
                    Successfully generated content using OpenAI:
                  </p>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="font-lora text-sm text-green-700 mb-2">
                      <strong>Generated Title:</strong> {result.content.title}
                    </p>
                    <p className="font-lora text-sm text-green-700 mb-2">
                      <strong>Rating:</strong> {result.content.rating}/5 stars
                    </p>
                    <p className="font-lora text-sm text-green-700">
                      <strong>Content Preview:</strong> {result.content.content?.substring(0, 100)}...
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
              
              {result?.troubleshooting && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <p className="font-lora text-xs text-red-700 mb-2">
                    <strong>Solution:</strong> {result.solution}
                  </p>
                  <div className="bg-red-100 rounded p-2 mt-2">
                    <p className="font-lora text-xs text-red-700 font-semibold">Troubleshooting Steps:</p>
                    <ol className="font-lora text-xs text-red-700 mt-1 space-y-1">
                      {result.troubleshooting.map((step: string, index: number) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="font-lora text-xs text-red-700 mb-2">
                  <strong>Common issues:</strong>
                </p>
                <ul className="font-lora text-xs text-red-700 space-y-1">
                  <li>• OpenAI API key not set in environment variables</li>
                  <li>• Invalid or expired OpenAI API key</li>
                  <li>• Insufficient OpenAI credits or quota exceeded</li>
                  <li>• Network connectivity issues</li>
                  <li>• Netlify function not deployed correctly</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={testOpenAIConnection}
              disabled={status === 'testing' || (isDevelopment && !isNetlifyDev)}
              className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'testing' ? 'Testing...' : 'Test OpenAI Connection'}
            </button>
            
            {status !== 'idle' && status !== 'testing' && (
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

          {isDevelopment && !isNetlifyDev && (
            <p className="font-lora text-xs text-red-600">
              Button disabled: Please run "netlify dev" first
            </p>
          )}
        </div>
      </div>

      {/* Response Details Panel */}
      {responseDetails && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
          <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
            <Icons.Code className="h-5 w-5 mr-2" />
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
          <Icons.Key className="h-5 w-5 mr-2" />
          🔑 OpenAI API Setup Guide
        </h4>
        
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">1. Get Your OpenAI API Key:</h5>
            <ol className="font-lora text-blue-700 space-y-1 text-sm">
              <li>1. Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI API Keys</a></li>
              <li>2. Sign in to your OpenAI account</li>
              <li>3. Click "Create new secret key"</li>
              <li>4. Copy the generated API key</li>
            </ol>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">2. Add to Environment Variables:</h5>
            <ol className="font-lora text-blue-700 space-y-1 text-sm">
              <li>1. Go to your Netlify dashboard</li>
              <li>2. Navigate to Site settings → Environment variables</li>
              <li>3. Add: <code className="bg-blue-100 px-1 rounded">OPENAI_API_KEY</code></li>
              <li>4. Paste your API key as the value</li>
              <li>5. Redeploy your site</li>
            </ol>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2 flex items-center">
              <Icons.DollarSign className="h-4 w-4 mr-1" />
              3. Ensure Sufficient Credits:
            </h5>
            <ul className="font-lora text-blue-700 space-y-1 text-sm">
              <li>• Check your usage at <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Usage</a></li>
              <li>• Add billing information if needed</li>
              <li>• Monitor your API quota and limits</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenAIConnectionTest;