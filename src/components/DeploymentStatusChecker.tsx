import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface DeploymentStatus {
  status: 'success' | 'error' | 'building' | 'unknown';
  deployUrl?: string;
  claimUrl?: string;
  error?: string;
  claimed?: boolean;
}

const DeploymentStatusChecker = () => {
  const [status, setStatus] = useState<DeploymentStatus>({
    status: 'unknown'
  });
  const [loading, setLoading] = useState(false);
  const [deployId, setDeployId] = useState<string | null>(null);

  useEffect(() => {
    // Check for deploy ID in localStorage
    const savedDeployId = localStorage.getItem('deploy_id');
    if (savedDeployId) {
      setDeployId(savedDeployId);
      checkDeploymentStatus(savedDeployId);
    }
  }, []);

  const checkDeploymentStatus = async (id: string) => {
    setLoading(true);
    
    try {
      const response = await fetch('/.netlify/functions/getDeploymentStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStatus({
          status: data.state === 'ready' ? 'success' : data.state === 'building' ? 'building' : 'error',
          deployUrl: data.deploy_url,
          claimUrl: data.claim_url,
          claimed: data.claimed
        });
      } else {
        setStatus({
          status: 'error',
          error: data.error || 'Failed to check deployment status'
        });
      }
    } catch (error) {
      console.error('Error checking deployment status:', error);
      setStatus({
        status: 'error',
        error: 'Network error while checking deployment status'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'building':
        return <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />;
      default:
        return <RefreshCw className="h-6 w-6 text-neutral-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'building':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-neutral-200 bg-neutral-50';
    }
  };

  return (
    <div className={`border-2 rounded-2xl p-6 ${getStatusColor()}`}>
      <div className="flex items-center mb-4">
        {getStatusIcon()}
        <h3 className="font-poppins text-lg font-semibold ml-3">
          Deployment Status
        </h3>
      </div>

      <div className="space-y-4">
        {status.status === 'unknown' && !deployId && (
          <p className="font-lora text-neutral-600">
            No recent deployments found. Deploy your site to see status here.
          </p>
        )}

        {status.status === 'building' && (
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-poppins font-semibold text-blue-800 mb-2 flex items-center">
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Deployment in Progress
            </h4>
            <p className="font-lora text-sm text-blue-700 mb-3">
              Your site is currently being built and deployed. This usually takes 1-3 minutes.
            </p>
            <div className="w-full bg-blue-100 rounded-full h-2 mb-4">
              <div className="bg-blue-500 h-2 rounded-full animate-pulse"></div>
            </div>
            <button
              onClick={() => deployId && checkDeploymentStatus(deployId)}
              className="font-poppins bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 transition-colors duration-200"
            >
              Check Status
            </button>
          </div>
        )}

        {status.status === 'success' && (
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <h4 className="font-poppins font-semibold text-green-800 mb-2 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Deployment Successful!
            </h4>
            <p className="font-lora text-sm text-green-700 mb-3">
              Your site has been successfully deployed and is now live.
            </p>
            
            {status.deployUrl && (
              <div className="mb-4">
                <p className="font-poppins text-sm font-medium text-green-800 mb-2">
                  Live URL:
                </p>
                <a
                  href={status.deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center font-poppins bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors duration-200"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visit Your Site
                </a>
              </div>
            )}
            
            {status.claimUrl && !status.claimed && (
              <div>
                <p className="font-poppins text-sm font-medium text-green-800 mb-2">
                  Transfer Ownership:
                </p>
                <div className="bg-green-100 rounded-lg p-3 mb-3">
                  <p className="font-lora text-xs text-green-700 mb-2">
                    You can transfer this deployment to your own Netlify account:
                  </p>
                  <a
                    href={status.claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-poppins bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition-colors duration-200"
                  >
                    Claim This Site
                  </a>
                </div>
              </div>
            )}
            
            {status.claimed && (
              <div className="bg-yellow-100 rounded-lg p-3">
                <p className="font-lora text-sm text-yellow-700">
                  <strong>Note:</strong> This site has been claimed. A new site with a new URL was deployed.
                </p>
              </div>
            )}
          </div>
        )}

        {status.status === 'error' && (
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <h4 className="font-poppins font-semibold text-red-800 mb-2 flex items-center">
              <XCircle className="h-5 w-5 mr-2" />
              Deployment Failed
            </h4>
            <p className="font-lora text-sm text-red-700 mb-3">
              {status.error || 'There was an error with your deployment.'}
            </p>
            <button
              onClick={() => deployId && checkDeploymentStatus(deployId)}
              className="font-poppins bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors duration-200"
            >
              Check Again
            </button>
          </div>
        )}

        {deployId && (
          <div className="mt-4">
            <button
              onClick={() => deployId && checkDeploymentStatus(deployId)}
              disabled={loading}
              className="font-poppins bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeploymentStatusChecker;