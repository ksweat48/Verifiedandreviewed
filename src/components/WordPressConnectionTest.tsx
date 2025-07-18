import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';

const WordPressConnectionTest = () => {
  const [status, setStatus] = useState<'testing' | 'connected' | 'failed' | 'demo'>('testing');
  const [details, setDetails] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [postsCount, setPostsCount] = useState<number>(0);
  const [samplePost, setSamplePost] = useState<any>(null);

  // Lazy load the WordPressService to reduce initial bundle size
  const getWordPressService = async () => {
    const { WordPressService } = await import('../services/wordpress');
    return WordPressService;
  };

  const testConnection = async () => {
    setStatus('testing');
    setDetails('Testing connection...');

    const testUrl = import.meta.env.VITE_WORDPRESS_API_URL || 'https://cms.verifiedandreviewed.com/wp-json/wp/v2';
    setApiUrl(testUrl);

    const WordPressService = await getWordPressService();

    try {
      // Test if WordPress is available
      const isAvailable = await WordPressService.isWordPressAvailable();
      
      if (isAvailable) {
        // Get posts to test data
        const result = await WordPressService.getPosts({ per_page: 5 });
        
        setStatus('connected');
        setPostsCount(result.total);
        setSamplePost(result.posts[0] || null);
        setDetails(`✅ WordPress is live! Found ${result.total} posts. API responding correctly.`);
      } else {
        throw new Error('WordPress API not accessible');
      }
    } catch (error) {
      setStatus('demo');
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          setDetails('⏱️ Connection timeout - WordPress may not be set up yet or is slow to respond');
        } else if (error.message.includes('CORS')) {
          setDetails('🚫 CORS error - WordPress needs CORS headers configured');
        } else if (error.message.includes('Failed to fetch') || error.message.includes('Network Error')) {
          setDetails('🌐 Network error - WordPress backend not accessible at this URL');
        } else {
          setDetails(`❌ Connection failed: ${error.message}`);
        }
      } else {
        setDetails('❌ Unknown connection error');
      }
    }
  };

  useEffect(() => {
    // Delay the initial test to reduce initial load time
    testConnection();
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'testing':
        return <Icons.RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />;
      case 'connected':
        return <Icons.CheckCircle className="h-6 w-6 text-green-500" />;
      case 'failed':
        return <Icons.XCircle className="h-6 w-6 text-red-500" />;
      case 'demo':
        return <Icons.AlertCircle className="h-6 w-6 text-yellow-500" />;
      default:
        return <Icons.RefreshCw className="h-6 w-6 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'testing':
        return 'border-blue-200 bg-blue-50';
      case 'connected':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'demo':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className={`border-2 rounded-2xl p-6 ${getStatusColor()}`}>
      <div className="flex items-center mb-4">
        {getStatusIcon()}
        <h3 className="font-poppins text-lg font-semibold ml-3">
          WordPress CMS Connection
        </h3>
      </div>

      <div className="space-y-4">
        <div>
          <span className="font-poppins text-sm font-medium text-gray-700">API URL:</span>
          <p className="font-mono text-sm text-gray-600 break-all">{apiUrl}</p>
        </div>

        <div>
          <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
          <p className="font-lora text-sm mt-1">{details}</p>
        </div>

        {status === 'connected' && (
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center mb-3">
              <Database className="h-5 w-5 text-green-600 mr-2" />
              <h4 className="font-poppins font-semibold text-green-800">✅ CMS Data Available!</h4>
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="font-lora text-sm text-green-700">
                <strong>Total Posts:</strong> {postsCount}
              </p>
              {samplePost && (
                <div className="bg-green-50 rounded p-3 border border-green-200">
                  <p className="font-lora text-sm text-green-700 mb-2">
                    <strong>Latest Post:</strong> {samplePost.title?.rendered}
                  </p>
                  {samplePost.acf && (
                    <div className="text-xs text-green-600">
                      <p><strong>Business:</strong> {samplePost.acf.business_name || 'N/A'}</p>
                      <p><strong>Location:</strong> {samplePost.acf.location || 'N/A'}</p>
                      <p><strong>Rating:</strong> {samplePost.acf.rating || 'N/A'}/5</p>
                      <p><strong>Health Score:</strong> {samplePost.acf.health_score || 'N/A'}</p>
                      <p><strong>Verified:</strong> {samplePost.acf.is_verified ? 'Yes' : 'No'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <a 
                href={`${apiUrl.replace('/wp-json/wp/v2', '/wp-admin')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-poppins bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors duration-200 text-sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open WordPress Admin
              </a>
              
              <a 
                href={apiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-poppins border border-green-500 text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition-colors duration-200 text-sm"
              >
                <Code className="h-4 w-4 mr-2" />
                View API
              </a>
            </div>
          </div>
        )}

        {status === 'demo' && (
          <div className="bg-white rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center mb-2">
              <img 
                src="/verified and reviewed logo-coral copy copy.png" 
                alt="Verified & Reviewed" 
                className="h-5 w-5 mr-2"
              />
              <h4 className="font-poppins font-semibold text-yellow-800">⚠️ Using Demo Data</h4>
            </div>
            <p className="font-lora text-sm text-yellow-700 mb-3">
              WordPress CMS is not accessible. The app is showing demo content instead of your real reviews.
            </p>
            
            <div className="bg-yellow-100 rounded p-3 border border-yellow-200 mb-4">
              <h5 className="font-poppins font-semibold text-yellow-800 mb-2">To fix this:</h5>
              <ol className="font-lora text-yellow-700 space-y-1 text-sm">
                <li>1. Ensure WordPress is installed at: <code className="bg-yellow-200 px-1 rounded">{apiUrl.replace('/wp-json/wp/v2', '')}</code></li>
                <li>2. Install required plugins (ACF, REST API)</li>
                <li>3. Configure CORS headers in WordPress</li>
                <li>4. Add some review posts with ACF fields</li>
                <li>5. Update your .env file if URL is different</li>
              </ol>
            </div>
            
            <div className="text-center">
              <a 
                href="https://wordpress.org/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-poppins bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition-colors duration-200 text-sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Download WordPress
              </a>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <div className="flex items-center mb-2">
              <img 
                src="/verified and reviewed logo-coral copy copy.png" 
                alt="Verified & Reviewed" 
                className="h-5 w-5 mr-2"
              />
              <h4 className="font-poppins font-semibold text-red-800">❌ Connection Failed</h4>
            </div>
            <p className="font-lora text-sm text-red-700 mb-3">
              WordPress backend is not responding correctly. Check:
            </p>
            <ul className="font-lora text-sm text-red-700 space-y-1 mb-4">
              <li>• WordPress is installed and running</li>
              <li>• REST API is enabled</li>
              <li>• CORS headers are configured</li>
              <li>• URL in .env file is correct</li>
              <li>• Server is accessible from this domain</li>
            </ul>
            
            <div className="bg-red-100 rounded p-3 border border-red-200">
              <p className="font-lora text-xs text-red-600">
                <strong>Current URL:</strong> {apiUrl}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={testConnection}
          disabled={status === 'testing'}
          className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'testing' ? 'Testing...' : 'Test Again'}
        </button>
      </div>
    </div>
  );
};

export default WordPressConnectionTest;