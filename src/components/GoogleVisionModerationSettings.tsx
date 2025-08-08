import React, { useState, useEffect } from 'react';
import { Shield, Eye, CheckCircle, XCircle, AlertTriangle, Settings, Key, Database, RefreshCw } from 'lucide-react';
import { AppSettingsService } from '../services/appSettingsService';

const GoogleVisionModerationSettings = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadCurrentSetting();
  }, []);

  const loadCurrentSetting = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const setting = await AppSettingsService.getSetting('enable_vision_moderation');
      setIsEnabled(setting?.enabled === true);
    } catch (err) {
      setError('Failed to load moderation settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const newValue = {
        enabled: !isEnabled,
        description: 'Enable Google Cloud Vision SafeSearch for image moderation',
        updated_by: 'admin',
        updated_at: new Date().toISOString()
      };

      const success = await AppSettingsService.updateSetting('enable_vision_moderation', newValue);
      
      if (success) {
        setIsEnabled(!isEnabled);
        setSuccess(`Google Vision moderation ${!isEnabled ? 'enabled' : 'disabled'} successfully`);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error('Failed to update setting');
      }
    } catch (err) {
      setError('Failed to update moderation setting');
    } finally {
      setUpdating(false);
    }
  };

  const testGoogleVision = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      // Test with a safe image from Pexels
      const testImageUrl = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400';
      
      const response = await fetch('/.netlify/functions/moderate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl: testImageUrl })
      });

      const result = await response.json();
      setTestResult(result);

      if (!response.ok) {
        throw new Error(result.message || 'Test failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = () => {
    if (loading) return 'border-neutral-200 bg-neutral-50';
    if (isEnabled) return 'border-green-200 bg-green-50';
    return 'border-yellow-200 bg-yellow-50';
  };

  const getStatusIcon = () => {
    if (loading) return <RefreshCw className="h-6 w-6 text-neutral-500 animate-spin" />;
    if (isEnabled) return <CheckCircle className="h-6 w-6 text-green-500" />;
    return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Main Settings Panel */}
      <div className={`border-2 rounded-2xl p-6 ${getStatusColor()}`}>
        <div className="flex items-center mb-4">
          {getStatusIcon()}
          <h3 className="font-poppins text-lg font-semibold ml-3">
            Google Cloud Vision SafeSearch
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Purpose:</span>
            <p className="font-lora text-sm mt-1">
              Use Google's AI to automatically detect inappropriate content in uploaded images (NSFW, violence, etc.). 
              When disabled, only basic file checks are performed.
            </p>
          </div>

          <div>
            <span className="font-poppins text-sm font-medium text-gray-700">Current Status:</span>
            <p className="font-lora text-sm mt-1">
              {loading ? 'Loading...' : isEnabled ? '✅ Google Vision moderation is ENABLED' : '⚠️ Google Vision moderation is DISABLED (basic checks only)'}
            </p>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between bg-white rounded-lg p-4 border border-neutral-200">
            <div>
              <h4 className="font-poppins font-semibold text-neutral-800">
                Enable Google Vision Moderation
              </h4>
              <p className="font-lora text-sm text-neutral-600">
                Automatically scan uploaded images for inappropriate content
              </p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={handleToggle}
                disabled={loading || updating}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                isEnabled ? 'bg-green-500' : 'bg-neutral-300'
              } ${(loading || updating) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                } mt-0.5 ml-0.5`}></div>
              </div>
            </label>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="font-lora text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <p className="font-lora text-green-700">{success}</p>
              </div>
            </div>
          )}

          {/* Test Button */}
          <div className="flex gap-3">
            <button
              onClick={loadCurrentSetting}
              disabled={loading}
              className="font-poppins border border-neutral-200 text-neutral-700 px-4 py-2 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh Status'}
            </button>
            
            <button
              onClick={testGoogleVision}
              disabled={testing || !isEnabled}
              className="font-poppins bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? 'Testing...' : 'Test Google Vision'}
            </button>
          </div>

          {!isEnabled && (
            <p className="font-lora text-xs text-yellow-600">
              Test button disabled: Enable Google Vision moderation first
            </p>
          )}
        </div>
      </div>

      {/* Test Results Panel */}
      {testResult && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
          <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2" />
            Test Results
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="font-poppins text-sm font-medium text-gray-700">Status:</span>
                <p className={`font-mono text-sm mt-1 p-2 rounded ${
                  testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {testResult.success ? 'SUCCESS' : 'FAILED'}
                </p>
              </div>
              
              <div>
                <span className="font-poppins text-sm font-medium text-gray-700">Image Safe:</span>
                <p className={`font-mono text-sm mt-1 p-2 rounded ${
                  testResult.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {testResult.passed ? 'SAFE' : 'FLAGGED'}
                </p>
              </div>
            </div>
            
            <div>
              <span className="font-poppins text-sm font-medium text-gray-700">Reason:</span>
              <p className="font-lora text-sm mt-1 p-2 bg-neutral-100 rounded">
                {testResult.reason || 'No reason provided'}
              </p>
            </div>

            {testResult.details && (
              <div>
                <span className="font-poppins text-sm font-medium text-gray-700">SafeSearch Categories:</span>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                  {Object.entries(testResult.details).map(([category, likelihood]) => (
                    <div key={category} className={`p-2 rounded text-center ${
                      likelihood === 'VERY_LIKELY' || likelihood === 'LIKELY' 
                        ? 'bg-red-100 text-red-700' 
                        : likelihood === 'POSSIBLE'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      <div className="font-poppins text-xs font-semibold capitalize">{category}</div>
                      <div className="font-lora text-xs">{likelihood}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {testResult.troubleshooting && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="font-lora text-xs text-red-700 mb-2">
                  <strong>Solution:</strong> {testResult.solution}
                </p>
                <div className="bg-red-100 rounded p-2 mt-2">
                  <p className="font-lora text-xs text-red-700 font-semibold mb-1">Troubleshooting Steps:</p>
                  <ol className="font-lora text-xs text-red-700 mt-1 space-y-1">
                    {testResult.troubleshooting.map((step: string, index: number) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h4 className="font-poppins font-semibold text-blue-800 mb-4 flex items-center">
          <Key className="h-5 w-5 mr-2" />
          🔑 Google Cloud Vision Setup Guide
        </h4>
        
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">1. Enable Google Cloud Vision API:</h5>
            <ol className="font-lora text-blue-700 space-y-1 text-sm">
              <li>1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
              <li>2. Select your project or create a new one</li>
              <li>3. Go to APIs & Services → Library</li>
              <li>4. Search for "Cloud Vision API" and enable it</li>
              <li>5. Make sure billing is enabled for your project</li>
            </ol>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">2. Create Service Account:</h5>
            <ol className="font-lora text-blue-700 space-y-1 text-sm">
              <li>1. Go to IAM & Admin → Service Accounts</li>
              <li>2. Click "Create Service Account"</li>
              <li>3. Name it (e.g., "netlify-vision-moderator")</li>
              <li>4. Grant it the "Cloud Vision API User" role</li>
              <li>5. Create and download a JSON key</li>
            </ol>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">3. Add Environment Variables to Netlify:</h5>
            <div className="font-lora text-blue-700 space-y-2 text-sm">
              <p>Go to Netlify Dashboard → Site settings → Environment variables and add:</p>
              <ul className="space-y-1 ml-4">
                <li>• <code className="bg-blue-100 px-1 rounded">GCP_PROJECT_ID</code> - Your Google Cloud project ID</li>
                <li>• <code className="bg-blue-100 px-1 rounded">GCP_PRIVATE_KEY_ID</code> - From the JSON key file</li>
                <li>• <code className="bg-blue-100 px-1 rounded">GCP_PRIVATE_KEY</code> - The full private key (including headers)</li>
                <li>• <code className="bg-blue-100 px-1 rounded">GCP_CLIENT_EMAIL</code> - Service account email</li>
                <li>• <code className="bg-blue-100 px-1 rounded">GCP_CLIENT_ID</code> - From the JSON key file</li>
              </ul>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h5 className="font-poppins font-semibold text-blue-800 mb-2">4. Deploy and Test:</h5>
            <ol className="font-lora text-blue-700 space-y-1 text-sm">
              <li>1. Redeploy your Netlify site after adding environment variables</li>
              <li>2. Enable the toggle above</li>
              <li>3. Click "Test Google Vision" to verify the integration</li>
              <li>4. Monitor the admin review queue for any flagged images</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Current Behavior */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
        <h4 className="font-poppins font-semibold text-neutral-800 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Current Image Moderation Behavior
        </h4>
        
        <div className="space-y-3">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
              <span className="font-poppins text-xs font-bold text-blue-600">1</span>
            </div>
            <div>
              <h5 className="font-poppins font-semibold text-neutral-800">Basic File Checks (Always Active)</h5>
              <p className="font-lora text-sm text-neutral-600">
                File size validation (max 10MB) and format validation (JPEG, PNG, WebP only)
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
              <span className="font-poppins text-xs font-bold text-blue-600">2</span>
            </div>
            <div>
              <h5 className="font-poppins font-semibold text-neutral-800">
                Google Vision SafeSearch {isEnabled ? '(ACTIVE)' : '(INACTIVE)'}
              </h5>
              <p className="font-lora text-sm text-neutral-600">
                {isEnabled 
                  ? 'AI-powered detection of adult, violent, medical, racy, and spoof content'
                  : 'Skipped - only basic source validation is performed'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
              <span className="font-poppins text-xs font-bold text-blue-600">3</span>
            </div>
            <div>
              <h5 className="font-poppins font-semibold text-neutral-800">Auto-Approval Decision</h5>
              <p className="font-lora text-sm text-neutral-600">
                Images are auto-approved if they pass all active checks and AUTO_APPROVE_OFFERINGS=true
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
        <h4 className="font-poppins font-semibold text-yellow-800 mb-4 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          💰 Cost Considerations
        </h4>
        
        <div className="space-y-3">
          <p className="font-lora text-yellow-700 text-sm">
            Google Cloud Vision API charges per image analyzed. Current pricing (as of 2024):
          </p>
          <ul className="font-lora text-yellow-700 space-y-1 text-sm ml-4">
            <li>• First 1,000 images per month: Free</li>
            <li>• 1,001 - 5,000,000 images: $1.50 per 1,000 images</li>
            <li>• 5,000,001+ images: $0.60 per 1,000 images</li>
          </ul>
          <p className="font-lora text-yellow-700 text-sm">
            Monitor your usage at <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Billing</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default GoogleVisionModerationSettings;