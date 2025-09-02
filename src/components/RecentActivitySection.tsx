import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import LeaveReviewModal from './LeaveReviewModal';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../hooks/useAuth';

interface VisitedBusiness {
  id: string;
  name: string;
  image: string;
  address: string;
  visitDate: string;
  hasReviewed: boolean;
  rating?: number;
}

const RecentActivitySection: React.FC = () => {
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<VisitedBusiness | null>(null); 
  const [visitedBusinesses, setVisitedBusinesses] = useState<VisitedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchVisitedBusinesses();
    } else {
      setVisitedBusinesses([]);
      setLoading(false);
    }
  }, [user]);
  
  // Listen for visited businesses updates
  useEffect(() => {
    const handleUpdate = () => {
      if (user) {
        fetchVisitedBusinesses();
      }
    };
    
    const handleVisitedBusinessesUpdate = () => {
      if (user) {
        fetchVisitedBusinesses();
      }
    };
    
    window.addEventListener('visited-businesses-updated', handleUpdate);
    window.addEventListener('offering-visit-recorded', handleUpdate);
    window.addEventListener('visited-businesses-updated', handleVisitedBusinessesUpdate);
    
    return () => {
      window.removeEventListener('visited-businesses-updated', handleUpdate);
      window.removeEventListener('offering-visit-recorded', handleUpdate);
      window.removeEventListener('visited-businesses-updated', handleVisitedBusinessesUpdate);
    };
  }, [user]);
  
  const fetchVisitedBusinesses = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user's visited offerings with offering and business details
      const { data: offeringVisitsData, error: offeringVisitsError } = await supabase
        .from('offering_visits')
        .select(`
          offering_id,
          visited_at,
          businesses!inner (
            id,
            name,
            image_url,
            address
          ),
          offerings!inner (
            id,
            title,
            description,
            price_cents,
            currency
          )
        `)
        .eq('user_id', user.id)
        .not('offering_id', 'is', null)
        .order('visited_at', { ascending: false });
      
      if (offeringVisitsError) throw offeringVisitsError;
      
      // Fetch user's offering reviews separately
      const { data: userReviewsData, error: reviewsError } = await supabase
        .from('user_reviews')
        .select('offering_id, rating')
        .eq('user_id', user.id)
        .not('offering_id', 'is', null);
      
      if (reviewsError) throw reviewsError;
      
      if (offeringVisitsData) {
        // Create a map of offering_id to review data for quick lookup
        const reviewsMap = new Map();
        if (userReviewsData) {
          userReviewsData.forEach(review => {
            reviewsMap.set(review.offering_id, review);
          });
        }
        
        const formattedBusinesses: VisitedBusiness[] = offeringVisitsData.map(visit => {
          const review = reviewsMap.get(visit.offering_id);
          return {
            id: visit.offering_id, // Use offering ID as the primary identifier
            name: `${visit.offerings.title} at ${visit.businesses.name}`,
            image: visit.businesses.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
            address: visit.businesses.address || 'No address available',
            visitDate: new Date(visit.visited_at).toLocaleDateString(),
            hasReviewed: !!review,
            rating: review ? review.rating : undefined,
            offeringId: visit.offering_id,
            businessId: visit.businesses.id,
            businessName: visit.businesses.name,
            offeringTitle: visit.offerings.title
          };
        });
        
        // Filter to only show businesses that haven't been reviewed yet
        const unreviewed = formattedBusinesses.filter(business => !business.hasReviewed);
        setVisitedBusinesses(unreviewed);
      } else {
        setVisitedBusinesses([]);
      }
    } catch (err) {
      console.error('Error fetching visited businesses:', err);
      setVisitedBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  // Since visitedBusinesses now only contains unreviewed businesses, 
  // the pending count is simply the array length
  const pendingReviewsCount = visitedBusinesses.length;

  const openReviewModal = (business: VisitedBusiness) => {
    setSelectedBusiness(business);
    setReviewModalOpen(true);
  };

  const handleSubmitReview = (review: {
    businessId: string;
    rating: 'thumbsUp' | 'thumbsDown';
    text: string;
    images: File[];
  }) => {
    // In a real app, this would send the review to your backend
    console.log('Submitting review:', review);
    
    // Update local state to show the business as reviewed
    // This is just for demo purposes - in a real app, you'd refetch the data
    const updatedBusinesses = visitedBusinesses.map(business => {
      if (business.id === review.businessId) {
        return {
          ...business,
          hasReviewed: true,
          rating: review.rating === 'thumbsUp' ? 5 : 2
        };
      }
      return business;
    });
    
    // In a real app, you'd update the state with the new data
    // setVisitedBusinesses(updatedBusinesses);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-poppins text-lg font-semibold text-neutral-900 flex items-center">
          <Icons.Navigation className="h-5 w-5 mr-2 text-primary-500" />
          Activity
        </h3>
        
        {pendingReviewsCount > 0 && (
          <div className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-xs font-poppins font-semibold">
            {pendingReviewsCount} to review
          </div>
        )}
      </div>
      
      {visitedBusinesses.length === 0 ? (
        <div className="bg-neutral-50 rounded-lg p-6 text-center">
          <Icons.Navigation className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
          <h4 className="font-poppins font-semibold text-neutral-700 mb-1">
            No activity yet
          </h4>
          <p className="font-lora text-sm text-neutral-600">
            Visited businesses will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visitedBusinesses.map((business) => (
            <div 
              key={business.id} 
              className={`bg-neutral-50 rounded-lg p-4 border ${
                business.hasReviewed ? 'border-neutral-100' : 'border-neutral-100 hover:border-primary-200 transition-all duration-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <img 
                  src={business.image} 
                  alt={business.name} 
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex-1">
                  <div>
                    <h4 className="font-poppins font-semibold text-neutral-900">{business.name}</h4>
                    <p className="font-lora text-xs text-neutral-600 mb-1">{business.address} • Visited {business.visitDate}</p>
                    {business.hasReviewed && (
                      <div className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-poppins font-semibold inline-block">
                        Reviewed
                      </div>
                    )}
                  </div>
                  {business.hasReviewed && business.rating && (
                    <div className="flex items-center mt-1">
                      {business.rating >= 4 ? (
                        <div className="flex items-center text-green-600">
                          <Icons.ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                          <span className="font-poppins text-xs font-semibold">Recommend</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600">
                          <Icons.ThumbsDown className="h-3 w-3 mr-1 fill-current" />
                          <span className="font-poppins text-xs font-semibold">Not for me</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Full-width review button */}
              {!business.hasReviewed && (
                <button 
                  onClick={() => openReviewModal(business)}
                  className="w-full bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-poppins font-semibold hover:bg-primary-600 transition-colors duration-200 mt-3"
                >
                  Leave a Review
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedBusiness && (
        <LeaveReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          business={selectedBusiness}
          onSubmitReview={handleSubmitReview}
        />
      )}
    </div>
  );
};

export default RecentActivitySection;