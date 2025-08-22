import React, { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Database, Upload, Search, AlertCircle } from 'lucide-react';
import { OfferingService } from '../services/offeringService';

const OfferingManagementTest = () => {
  const [ingestionStatus, setIngestionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [embeddingStatus, setEmbeddingStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  
  const [ingestionResult, setIngestionResult] = useState<any>(null);
  const [embeddingResult, setEmbeddingResult] = useState<any>(null);
  const [searchResult, setSearchResult] = useState<any>(null);
  
  const [batchSize, setBatchSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('cozy coffee shop');
  const [error, setError] = useState<string>('');

  // Test business ingestion
  const testIngestion = async () => {
    setIngestionStatus('running');
    setError('');
    setIngestionResult(null);

    try {
      console.log('🔄 Starting business ingestion test...');
      
      const result = await OfferingService.ingestAllBusinesses();
      
      if (result.success) {
        setIngestionStatus('success');
        setIngestionResult(result);
      } else {
        setIngestionStatus('error');
        setError('Ingestion completed with errors');
        setIngestionResult(result);
      }
    } catch (err) {
      setIngestionStatus('error');
      setError(err instanceof Error ? err.message : 'Ingestion failed');
    }
  };

  // Test embedding generation
  const testEmbeddingGeneration = async () => {
    setEmbeddingStatus('running');
    setError('');
    setEmbeddingResult(null);

    try {
      console.log('🧠 Starting embedding generation test...');
      
      const response = await fetch('/.netlify/functions/generate-offering-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchSize: batchSize,
          forceRegenerate: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setEmbeddingStatus('success');
        setEmbeddingResult(result);
      } else {
        setEmbeddingStatus('error');
        setError('Embedding generation completed with errors');
        setEmbeddingResult(result);
      }
    } catch (err) {
      setEmbeddingStatus('error');
      setError(err instanceof Error ? err.message : 'Embedding generation failed');
    }
  };

  // Test offering search
  const testOfferingSearch = async () => {
    setSearchStatus('running');
    setError('');
    setSearchResult(null);

    try {
      console.log('🔍 Starting offering search test...');
      
      const result = await OfferingService.searchOfferings(searchQuery, {
        matchThreshold: 0.3,
        matchCount: 5
      });
      
      if (result.success) {
        setSearchStatus('success');
        setSearchResult(result);
      } else {
        setSearchStatus('error');
        setError('Search completed with errors');
        setSearchResult(result);
      }
    } catch (err) {
      setSearchStatus('error');
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Database className="h-5 w-5 text-neutral-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'border-blue-200 bg-blue-50';
      case 'success': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      default: return 'border-neutral-200 bg-neutral-50';
    }
  };

  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname.includes('webcontainer');
  const isNetlifyDev = window.location.port === '8888' || window.location.href.includes('netlify');

  return (
    <div className="space-y-6">
      {/* Step 1: Business Ingestion */}
      <div className={`border-2 rounded-2xl p-6 ${getStatusColor(ingestionStatus)}`}>
        <div className="flex items-center mb-4">
          {getStatusIcon(ingestionStatus)}
          <h3 className="font-poppins text-lg font-semibold ml-3">
            Step 1: Ingest Businesses to Offerings
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Convert existing businesses into the new offerings schema. Each business becomes a primary offering with images.
            </p>
          </div>

          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
            <p className="font-lora text-sm mt-1">
              {ingestionStatus === 'idle' && 'Ready to ingest businesses'}
              {ingestionStatus === 'running' && 'Ingesting businesses into offerings...'}
              {ingestionStatus === 'success' && '✅ Business ingestion completed!'}
              {ingestionStatus === 'error' && `❌ Ingestion failed: ${error}`}
            </p>
          </div>

          {ingestionStatus === 'success' && ingestionResult && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-poppins font-semibold text-green-800 mb-2">
                ✅ Ingestion Results
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Businesses</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{ingestionResult.businessesProcessed}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Offerings</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{ingestionResult.offeringsCreated}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Errors</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{ingestionResult.errors?.length || 0}</div>
                </div>
              </div>

              {ingestionResult.errors && ingestionResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <h5 className="font-poppins font-semibold text-red-800 mb-2">Errors:</h5>
                  <ul className="font-lora text-sm text-red-700 space-y-1">
                    {ingestionResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <button
            onClick={testIngestion}
            disabled={ingestionStatus === 'running'}
            className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ingestionStatus === 'running' ? 'Ingesting...' : 'Start Business Ingestion'}
          </button>
        </div>
      </div>

      {/* Step 2: Embedding Generation */}
      <div className={`border-2 rounded-2xl p-6 ${getStatusColor(embeddingStatus)}`}>
        <div className="flex items-center mb-4">
          {getStatusIcon(embeddingStatus)}
          <h3 className="font-poppins text-lg font-semibold ml-3">
            Step 2: Generate Offering Embeddings
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Generate vector embeddings for all offerings to enable semantic search functionality.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-neutral-200">
            <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
              Batch Size
            </label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
              min="1"
              max="50"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="font-lora text-xs text-neutral-500 mt-1">
              Number of offerings to process in each batch (1-50)
            </p>
          </div>

          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
            <p className="font-lora text-sm mt-1">
              {embeddingStatus === 'idle' && 'Ready to generate embeddings'}
              {embeddingStatus === 'running' && 'Generating embeddings...'}
              {embeddingStatus === 'success' && '✅ Embedding generation completed!'}
              {embeddingStatus === 'error' && `❌ Generation failed: ${error}`}
            </p>
          </div>

          {embeddingStatus === 'success' && embeddingResult && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-poppins font-semibold text-green-800 mb-2">
                ✅ Embedding Results
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Processed</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{embeddingResult.processed}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Success</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{embeddingResult.successCount}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="font-poppins text-sm font-medium text-green-800">Errors</div>
                  <div className="font-poppins text-2xl font-bold text-green-900">{embeddingResult.errorCount}</div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={testEmbeddingGeneration}
            disabled={embeddingStatus === 'running'}
            className="font-poppins bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {embeddingStatus === 'running' ? 'Generating...' : 'Generate Embeddings'}
          </button>
        </div>
      </div>

      {/* Step 3: Test Offering Search */}
      <div className={`border-2 rounded-2xl p-6 ${getStatusColor(searchStatus)}`}>
        <div className="flex items-center mb-4">
          {getStatusIcon(searchStatus)}
          <h3 className="font-poppins text-lg font-semibold ml-3">
            Step 3: Test Offering Search
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Test the new semantic search functionality on the offerings data.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-neutral-200">
            <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
              Search Query
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., cozy coffee shop, romantic dinner, energetic workout"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-lora text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="font-lora text-xs text-neutral-500 mt-1">
              Test semantic search with different vibe queries
            </p>
          </div>

          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
            <p className="font-lora text-sm mt-1">
              {searchStatus === 'idle' && 'Ready to test search'}
              {searchStatus === 'running' && 'Searching offerings...'}
              {searchStatus === 'success' && '✅ Search completed!'}
              {searchStatus === 'error' && `❌ Search failed: ${error}`}
            </p>
          </div>

          {searchStatus === 'success' && searchResult && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-poppins font-semibold text-green-800 mb-2">
                ✅ Search Results ({searchResult.matchCount})
              </h4>
              
              {searchResult.results && searchResult.results.length > 0 ? (
                <div className="space-y-3">
                  {searchResult.results.slice(0, 3).map((result, index) => (
                    <div key={index} className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-poppins font-semibold text-green-900">
                          {result.title}
                        </h5>
                        <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-poppins font-semibold">
                          {Math.round((result.similarity || 0) * 100)}% match
                        </span>
                      </div>
                      <p className="font-lora text-sm text-green-700 mb-2">
                        {result.business_name} • {result.business_category}
                      </p>
                      <p className="font-lora text-xs text-green-600">
                        {result.description || result.business_short_description}
                      </p>
                    </div>
                  ))}
                  
                  {searchResult.results.length > 3 && (
                    <p className="font-lora text-sm text-green-700 text-center">
                      ... and {searchResult.results.length - 3} more results
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-lora text-sm text-green-700">
                  No results found. Try running ingestion and embedding generation first.
                </p>
              )}
            </div>
          )}

          <button
            onClick={testOfferingSearch}
            disabled={searchStatus === 'running' || !searchQuery.trim()}
            className="font-poppins bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searchStatus === 'running' ? 'Searching...' : 'Test Offering Search'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h4 className="font-poppins font-semibold text-blue-800 mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2" />
          🚀 Step 3 Implementation Guide
        </h4>
        
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">1. Run Business Ingestion:</h5>
            <p className="font-lora text-blue-700 text-sm">
              This converts your existing businesses into the new offerings schema. Each business becomes a primary offering with associated images.
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">2. Generate Embeddings:</h5>
            <p className="font-lora text-blue-700 text-sm">
              This creates vector embeddings for semantic search. Each offering gets a 1536-dimension vector that captures its meaning and context.
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">3. Test Search:</h5>
            <p className="font-lora text-blue-700 text-sm">
              Verify that semantic search works correctly by testing different vibe queries against your offerings data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferingManagementTest;