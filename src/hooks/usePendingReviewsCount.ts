import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export const usePendingReviewsCount = (userId: string | undefined) => {
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPendingReviews = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch all businesses visited by the user
        const { data: visits, error: visitsError } = await supabase
          .from('business_visits')
          .select('business_id')
          .eq('user_id', userId);

        if (visitsError) throw visitsError;

        const visitedBusinessIds = visits?.map(visit => visit.business_id) || [];

        if (visitedBusinessIds.length === 0) {
          setPendingReviewsCount(0);
          setLoading(false);
          return;
        }

        // Fetch all reviews submitted by the user
        const { data: reviews, error: reviewsError } = await supabase
          .from('user_reviews')
          .select('business_id')
          .eq('user_id', userId);

        if (reviewsError) throw reviewsError;

        const reviewedBusinessIds = new Set((reviews || []).map(review => review.business_id));

        // Filter visited businesses to find those not yet reviewed
        const unreviewedVisits = visitedBusinessIds.filter(
          businessId => !reviewedBusinessIds.has(businessId)
        );

        setPendingReviewsCount(unreviewedVisits.length);
      } catch (error) {
        console.error('Error fetching pending reviews count:', error);
        setPendingReviewsCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingReviews();

    // Listen for updates to visited businesses or reviews
    const handleUpdate = () => {
      fetchPendingReviews();
    };

    window.addEventListener('visited-businesses-updated', handleUpdate);
    
    return () => {
      window.removeEventListener('visited-businesses-updated', handleUpdate);
    };
  }, [userId]);

  return { pendingReviewsCount, loading };
};