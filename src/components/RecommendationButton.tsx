import React, { useState, useEffect } from 'react';
import { ThumbsUp } from 'lucide-react';

interface RecommendationButtonProps {
  postId: number;
  postSlug: string;
  businessName: string;
  isVerified: boolean;
}

const RecommendationButton: React.FC<RecommendationButtonProps> = ({ 
  postId, 
  postSlug, 
  businessName, 
  isVerified 
}) => {
  const [recommendationCount, setRecommendationCount] = useState(0);
  const [hasRecommended, setHasRecommended] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Don't show for verified posts
  if (isVerified) {
    return null;
  }

  useEffect(() => {
    // Load recommendation count and user's recommendation status
    loadRecommendationData();
  }, [postId]);

  const loadRecommendationData = async () => {
    try {
      // Get recommendation count from localStorage or API
      const storageKey = `recommendations_${postId}`;
      const userStorageKey = `user_recommended_${postId}`;
      
      const count = localStorage.getItem(storageKey);
      const userRecommended = localStorage.getItem(userStorageKey);
      
      setRecommendationCount(count ? parseInt(count) : 0);
      setHasRecommended(userRecommended === 'true');
    } catch (error) {
      console.error('Error loading recommendation data:', error);
    }
  };

  const handleRecommendation = async () => {
    if (isLoading || hasRecommended) return;

    setIsLoading(true);

    try {
      // In a real app, this would be an API call to your backend
      // For now, we'll use localStorage to simulate the functionality
      
      const newCount = recommendationCount + 1;
      const storageKey = `recommendations_${postId}`;
      const userStorageKey = `user_recommended_${postId}`;
      
      // Update localStorage
      localStorage.setItem(storageKey, newCount.toString());
      localStorage.setItem(userStorageKey, 'true');
      
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
      
      // Store in Supabase (simulated)
      
      // Update state
      setRecommendationCount(newCount);
      setHasRecommended(true);
      
      // Show success message
      alert(`Thank you for recommending ${businessName} for verification!`);
      
    } catch (error) {
      alert('Failed to submit recommendation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg border border-neutral-200 p-3">
      <div className="text-center">
        <p className="font-lora text-xs text-neutral-600 mb-2">
          Like this business?
        </p>
        <button
          onClick={handleRecommendation}
          disabled={isLoading || hasRecommended}
          className={`flex items-center justify-center w-full px-3 py-2 rounded-lg font-poppins text-sm font-semibold transition-all duration-200 ${
            hasRecommended
              ? 'bg-green-100 text-green-700 cursor-not-allowed'
              : 'bg-primary-500 text-white hover:bg-primary-600 active:scale-95'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <img 
            src="/verified and reviewed logo-coral copy copy.png" 
            alt="V&R" 
            className="h-4 w-4 mr-2"
          />
          <ThumbsUp className="h-4 w-4 mr-1" />
          {hasRecommended ? 'Recommended' : 'Recommend'}
          {recommendationCount > 0 && (
            <span className="ml-2 bg-white bg-opacity-20 rounded-full px-2 py-1 text-xs">
              {recommendationCount}
            </span>
          )}
        </button>
        <p className="font-lora text-xs text-neutral-500 mt-1">
          Recommend to get Verified
        </p>
      </div>
    </div>
  );
};

export default RecommendationButton;