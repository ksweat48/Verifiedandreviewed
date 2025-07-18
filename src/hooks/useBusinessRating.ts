import { useState, useEffect } from 'react';
import { BusinessService } from '../services/businessService';

export const useBusinessRating = (businessId: string) => {
  const [thumbsUp, setThumbsUp] = useState<number>(0);
  const [thumbsDown, setThumbsDown] = useState<number>(0);
  const [sentimentScore, setSentimentScore] = useState<number>(0);
  const [userRating, setUserRating] = useState<boolean | null>(null);
  const [canRate, setCanRate] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load business rating data
  useEffect(() => {
    const loadBusinessRating = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get business details including thumbs up/down counts
        const business = await BusinessService.getBusinessById(businessId);
        
        if (business) {
          setThumbsUp(business.thumbs_up);
          setThumbsDown(business.thumbs_down);
          setSentimentScore(business.sentiment_score);
        }
        
        // Check if user has already rated this business
        if (isAuthenticated && user) {
          // Check if user has visited the business (required before rating)
          const hasVisited = await BusinessService.hasUserVisited(businessId, user.id);
          setCanRate(hasVisited);
          
          // Get user's existing rating if any
          const { data: userRatingData } = await supabase
            .from('business_ratings')
            .select('is_thumbs_up')
            .eq('business_id', businessId)
            .eq('user_id', user.id)
            .single();
          
          if (userRatingData) {
            setUserRating(userRatingData.is_thumbs_up);
          }
        }
      } catch (err) {
        setError('Failed to load rating data');
      } finally {
        setLoading(false);
      }
    };
    
    if (businessId) {
      loadBusinessRating();
    }
  }, [businessId, isAuthenticated, user]);

  // Rate a business (thumbs up/down)
  const rateBusiness = async (isThumbsUp: boolean): Promise<boolean> => {
    if (!true) { // Placeholder for auth check
      setError('You must be logged in to rate a business');
      return false;
    }
    
    if (!canRate) {
      setError('You must visit this business before rating it');
      return false;
    }
    
    try {
      setLoading(true);
      
      const success = true; // Placeholder for actual API call
      
      if (success) {
        // Update local state
        if (userRating === null) {
          // New rating
          if (isThumbsUp) {
            setThumbsUp(prev => prev + 1);
          } else {
            setThumbsDown(prev => prev + 1);
          }
        } else if (userRating !== isThumbsUp) {
          // Changed rating
          if (isThumbsUp) {
            setThumbsUp(prev => prev + 1);
            setThumbsDown(prev => prev - 1);
          } else {
            setThumbsUp(prev => prev - 1);
            setThumbsDown(prev => prev + 1);
          }
        }
        
        // Update sentiment score
      }
      setError('Failed to rate business');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    thumbsUp,
    thumbsDown,
    sentimentScore,
    userRating,
    canRate,
    loading,
    error,
    rateBusiness
  };
};

// Mock Supabase client for the hook to work without actual Supabase connection
const supabase = {
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => ({
        single: () => ({ data: null, error: null })
      })
    })
  })
};