import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Brain, Database, AlertCircle, Code, Zap } from 'lucide-react';

interface EmbeddingTestResult {
  success: boolean;
  processed: number;
  successCount: number;
  errorCount: number;
  message: string;
  results?: Array<{
    businessId: string;
    businessName: string;
    success: boolean;
    embeddingDimensions?: number;
    error?: string;
  }>;
}

const EmbeddingGenerationTest = () => {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<EmbeddingTestResult | null>(null);
  const [error, setError] = useState<string>('');
  const [responseDetails, setResponseDetails] = useState<any>(null);
  const [testBusinessId, setTestBusinessId] = useState<string>('');
  const [batchSize, setBatchSize] = useState<number>(5);
  const [forceRegenerate, setForceRegenerate] = useState<boolean>(false);

  const testEmbeddingGeneration = async (businessId?: string) => {
    setStatus('testing');
    setError('');
    setResult(null);
    setResponseDetails(null);

    try {
      // Check if we're in development mode and need netlify dev
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('webcontainer');
      const isNetlifyDev = window.location.port === '8888' || window.location.href.includes('netlify');
      
      if (isDevelopment && !isNetlifyDev) {
        throw new Error('Development Setup Required: You need to run "netlify dev" instead of "npm run dev" to test Netlify functions.');
      }
      
      const response = await fetch('/.netlify/functions/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: businessId || undefined,
          batchSize: batchSize,
          forceRegenerate: forceRegenerate
        })
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

      if (response.ok && data.success) {
        setStatus('success');
        setResult(data);
      } else {
        setStatus('error');
        setError(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
        setResult(data);
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
      default: return <Brain className="h-6 w-6 text-neutral-500" />;
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
            <AlertCircle className="h-6 w-6 text-yellow-600 mr-3" />
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
            Embedding Generation Test
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Test the embedding generation process for semantic search functionality. This generates vector embeddings for businesses using OpenAI.
            </p>
          </div>

          {/* Test Options */}
          <div className="bg-white rounded-lg p-4 border border-neutral-200">
            <h4 className="font-poppins font-semibold text-neutral-800 mb-4">Test Options</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Specific Business ID (Optional)
                </label>
                <input
                  type="text"
                  value={testBusinessId}
                  onChange={(e) => setTestBusinessId(e.target.value)}
                  placeholder="Leave empty for batch processing"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="font-lora text-xs text-neutral-500 mt-1">
                  Test a specific business or leave empty for batch processing
                </p>
              </div>
              
              <div>
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Batch Size
                </label>
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="font-lora text-xs text-neutral-500 mt-1">
                  Number of businesses to process (1-20)
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={forceRegenerate}
                  onChange={(e) => setForceRegenerate(e.target.checked)}
                  className="rounded border-neutral-300 text-primary-500 focus:ring-primary-500 mr-2"
                />
                <span className="font-poppins text-sm text-neutral-700">
                  Force regenerate existing embeddings
                </span>
              </label>
              <p className="font-lora text-xs text-neutral-500 mt-1">
                By default, only businesses without embeddings are processed
              </p>
            </div>
          </div>

          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
            <p className="font-lora text-sm mt-1">
              {status === 'idle' && 'Ready to test embedding generation'}
              {status === 'testing' && 'Generating embeddings...'}
              {status === 'success' && '✅ Embedding generation completed!'}
              {status === 'error' && `❌ Generation failed: ${error}`}
            </p>
          </div>

          {status === 'success' && result && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-poppins font-semibold text-green-800 mb-2">
                ✅ Embedding Generation Results
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Processed</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{result.processed}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Success</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{result.successCount}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Errors</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{result.errorCount}</div>
                </div>
              </div>
              
              <p className="font-lora text-sm text-green-700 mb-3">
                {result.message}
              </p>
              
              {result.results && result.results.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-poppins font-semibold text-green-800">Business Results:</h5>
                  {result.results.map((businessResult, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${
                      businessResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-poppins font-semibold text-sm">
                            {businessResult.businessName}
                          </span>
                          <div className="font-mono text-xs text-neutral-600">
                            ID: {businessResult.businessId}
                          </div>
                        </div>
                        <div className="text-right">
                          {businessResult.success ? (
                            <div className="text-green-700">
                              <CheckCircle className="h-4 w-4 inline mr-1" />
                              <span className="text-xs">
                                {businessResult.embeddingDimensions} dimensions
                              </span>
                            </div>
                          ) : (
                            <div className="text-red-700">
                              <XCircle className="h-4 w-4 inline mr-1" />
                              <span className="text-xs">{businessResult.error}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <h4 className="font-poppins font-semibold text-red-800 mb-2">
                ❌ Embedding Generation Failed
              </h4>
              <p className="font-lora text-sm text-red-700 mb-3">
                Error details: {error}
              </p>
              
              {result && result.message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <p className="font-lora text-xs text-red-700">
                    <strong>Function Response:</strong> {result.message}
                  </p>
                </div>
              )}
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="font-lora text-xs text-red-700 mb-2">
                  <strong>Common issues:</strong>
                </p>
                <ul className="font-lora text-xs text-red-700 space-y-1">
                  <li>• OpenAI API key not set in Netlify environment variables</li>
                  <li>• Supabase credentials not configured in Netlify</li>
                  <li>• pgvector extension not enabled in Supabase</li>
                  <li>• RLS policies preventing function from updating businesses table</li>
                  <li>• OpenAI API quota exceeded or invalid key</li>
                  <li>• Network connectivity issues</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => testEmbeddingGeneration(testBusinessId.trim() || undefined)}
              disabled={status === 'testing' || (isDevelopment && !isNetlifyDev)}
              className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'testing' ? 'Generating...' : 'Test Embedding Generation'}
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
          <Database className="h-5 w-5 mr-2" />
          🔧 Embedding Setup Requirements
        </h4>
        
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">1. Environment Variables (Netlify):</h5>
            <ul className="font-lora text-blue-700 space-y-1 text-sm">
              <li>• <code className="bg-blue-100 px-1 rounded">OPENAI_API_KEY</code> - Your OpenAI API key</li>
              <li>• <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_URL</code> - Your Supabase project URL</li>
              <li>• <code className="bg-blue-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> - Your Supabase anon key</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">2. Supabase Database Setup:</h5>
            <ul className="font-lora text-blue-700 space-y-1 text-sm">
              <li>• Enable the <code className="bg-blue-100 px-1 rounded">pgvector</code> extension</li>
              <li>• Ensure the <code className="bg-blue-100 px-1 rounded">businesses</code> table has an <code className="bg-blue-100 px-1 rounded">embedding</code> column of type <code className="bg-blue-100 px-1 rounded">vector(1536)</code></li>
              <li>• Check RLS policies allow the service role to update the businesses table</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">3. OpenAI Account:</h5>
            <ul className="font-lora text-blue-700 space-y-1 text-sm">
              <li>• Valid API key with sufficient credits</li>
              <li>• Access to the <code className="bg-blue-100 px-1 rounded">text-embedding-3-small</code> model</li>
              <li>• No rate limit restrictions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddingGenerationTest;