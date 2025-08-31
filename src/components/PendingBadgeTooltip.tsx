import React, { useState, useRef, useEffect } from 'react';
import { ThumbsUp, X } from 'lucide-react';

interface PendingBadgeTooltipProps {
  postId: number;
  postSlug: string;
  businessName: string;
  onRecommend?: () => void;
}

const PendingBadgeTooltip: React.FC<PendingBadgeTooltipProps> = ({ 
  postId, 
  postSlug, 
  businessName, 
  onRecommend 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasRecommended, setHasRecommended] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRecommendation = async () => {
    if (isLoading || hasRecommended) return;

    setIsLoading(true);

    try {
      // Track the recommendation for admin dashboard
      const recommendationData = {
        postId,
        postSlug,
        businessName,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        address: 'Unknown Address' // In a real app, this would be captured from the business data
      };
      
      // Store recommendation data for admin dashboard
      const existingRecommendations = JSON.parse(
        localStorage.getItem('admin_recommendations') || '[]'
      );
      existingRecommendations.push(recommendationData);
      localStorage.setItem('admin_recommendations', JSON.stringify(existingRecommendations));
      
      // Update recommendation count
      const storageKey = `recommendations_${postId}`;
      const currentCount = localStorage.getItem(storageKey);
      const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
      localStorage.setItem(storageKey, newCount.toString());
      
      // Mark as recommended by this user
      const userStorageKey = `user_recommended_${postId}`;
      localStorage.setItem(userStorageKey, 'true');
      
      setHasRecommended(true);
      
      // Keep tooltip open for a moment to show success
      setTimeout(() => {
        setIsVisible(false);
      }, 2000);
      
      showSuccess(`Thank you for recommending ${businessName} for verification!`);
      
      if (onRecommend) {
        onRecommend();
      }
      
    } catch (error) {
      console.error('Error submitting recommendation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
  };

  const hideTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 150); // Small delay to allow moving to tooltip
  };

  const keepTooltipOpen = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  // Check if user has already recommended this post
  useEffect(() => {
    const userStorageKey = `user_recommended_${postId}`;
    const hasUserRecommended = localStorage.getItem(userStorageKey) === 'true';
    setHasRecommended(hasUserRecommended);
  }, [postId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative inline-block">
      <div
        ref={badgeRef}
        className="bg-yellow-500 text-white rounded-full px-3 py-1 flex items-center cursor-pointer hover:bg-yellow-600 transition-colors duration-200"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={() => setIsVisible(!isVisible)}
      >
        <span className="font-poppins text-xs font-bold">PENDING</span>
      </div>

      {isVisible && (
        <div 
          ref={tooltipRef}
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg p-4 z-50"
          onMouseEnter={keepTooltipOpen}
          onMouseLeave={hideTooltip}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="font-poppins font-semibold text-neutral-900 mb-2">
                Pending Verification
              </h4>
              <p className="font-lora text-sm text-neutral-700 leading-relaxed">
                This business has only customer reviews. Click here to recommend a full Verified & Reviewed evaluation.
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              className="ml-2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {hasRecommended ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center mb-2">
                <ThumbsUp className="h-5 w-5 text-green-600 mr-2" />
                <span className="font-poppins font-semibold text-green-700">
                  Already Recommended
                </span>
              </div>
              <p className="font-lora text-xs text-green-600">
                Thank you for recommending {businessName} for verification!
              </p>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRecommendation();
              }}
              disabled={isLoading}
              className={`w-full flex items-center justify-center px-4 py-3 rounded-lg font-poppins font-semibold transition-all duration-200 ${
                isLoading
                  ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600 active:scale-95'
              }`}
            >
              <img 
                src="/verified and reviewed logo-coral copy copy.png" 
                alt="V&R" 
                className="h-4 w-4 mr-2"
              />
              <ThumbsUp className="h-4 w-4 mr-2" />
              {isLoading ? 'Recommending...' : 'Recommend for Verification'}
            </button>
          )}

          <p className="font-lora text-xs text-neutral-500 mt-3 text-center">
            Help us prioritize which businesses to visit and verify next
          </p>
        </div>
      )}
    </div>
  );
};

export default PendingBadgeTooltip;