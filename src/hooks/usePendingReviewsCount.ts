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
        // Fetch all offerings visited by the user
        const { data: offeringVisits, error: visitsError } = await supabase
          .from('business_visits')
          .select('offering_id, business_id')
          .not('offering_id', 'is', null)
          .eq('user_id', userId);

        if (visitsError) throw visitsError;

        const visitedOfferingIds = offeringVisits?.map(visit => visit.offering_id) || [];

        if (visitedOfferingIds.length === 0) {
          setPendingReviewsCount(0);
          setLoading(false);
          return;
        }

        // Fetch all offering reviews submitted by the user
        const { data: reviews, error: reviewsError } = await supabase
          .from('user_reviews')
          .select('offering_id')
          .not('offering_id', 'is', null)
          .eq('user_id', userId);

        if (reviewsError) throw reviewsError;

        const reviewedOfferingIds = new Set((reviews || []).map(review => review.offering_id));

        // Filter visited offerings to find those not yet reviewed
        const unreviewedVisits = visitedOfferingIds.filter(
          offeringId => !reviewedOfferingIds.has(offeringId)
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

    // Listen for updates to visited offerings or reviews
    const handleUpdate = () => {
      fetchPendingReviews();
    };

    window.addEventListener('visited-businesses-updated', handleUpdate);
    window.addEventListener('offering-visit-recorded', handleUpdate);
    
    return () => {
      window.removeEventListener('visited-businesses-updated', handleUpdate);
      window.removeEventListener('offering-visit-recorded', handleUpdate);
    };
  }, [userId]);

  return { pendingReviewsCount, loading };
};