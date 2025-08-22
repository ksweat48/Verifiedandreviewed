import React, { useState, useEffect } from 'react';
import { X, ThumbsUp, ThumbsDown, Star, Calendar, User } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface OfferingReview {
  id: string;
  user_id: string;
  offering_id: string;
  review_text: string;
  rating: number;
  image_urls: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles?: {
    name: string;
    avatar_url?: string;
  };
}

interface OfferingReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  offeringId: string;
  offeringTitle: string;
  businessName: string;
}

const OfferingReviewsModal: React.FC<OfferingReviewsModalProps> = ({
  isOpen,
  onClose,
  offeringId,
  offeringTitle,
  businessName
}) => {
  const [reviews, setReviews] = useState<OfferingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle browser back button for modal
  useEffect(() => {
    if (isOpen) {
      window.history.pushState(null, '', window.location.href);
      
      const handlePopState = (event) => {
        if (isOpen) {
          onClose();
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, onClose]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Fetch reviews when modal opens
  useEffect(() => {
    if (isOpen && offeringId) {
      fetchOfferingReviews();
    }
  }, [isOpen, offeringId]);

  const fetchOfferingReviews = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Note: This assumes the database schema has been updated to include offering_id
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          *,
          profiles!inner (
            name,
            avatar_url
          )
        `)
        .eq('offering_id', offeringId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setReviews(data || []);
    } catch (err) {
      console.error('Error fetching offering reviews:', err);
      setError('Failed to load reviews');
      // Clear reviews on error
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  const thumbsUpCount = reviews.filter(review => review.rating >= 4).length;
  const thumbsDownCount = reviews.filter(review => review.rating < 4).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
                {offeringTitle}
              </h2>
              <p className="font-lora text-neutral-600">
                at {businessName}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-700 transition-colors duration-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Rating Summary */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center">
              <div className="flex text-yellow-400 mr-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < Math.round(averageRating) ? 'fill-current' : ''}`} />
                ))}
              </div>
              <span className="font-poppins font-semibold text-neutral-700">
                {averageRating.toFixed(1)} ({reviews.length} reviews)
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-green-100 text-green-700 px-2 py-1 rounded-full">
                <ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                <span className="font-poppins text-xs font-semibold">{thumbsUpCount}</span>
              </div>
              <div className="flex items-center bg-red-100 text-red-700 px-2 py-1 rounded-full">
                <ThumbsDown className="h-3 w-3 mr-1 fill-current" />
                <span className="font-poppins text-xs font-semibold">{thumbsDownCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Content */}
        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-neutral-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
                      <div className="h-4 bg-neutral-200 rounded w-full"></div>
                      <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="font-lora text-red-600">{error}</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8">
              <Star className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                No Reviews Yet
              </h3>
              <p className="font-lora text-neutral-600">
                Be the first to leave a review for this offering!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-neutral-200 pb-6 last:border-b-0">
                  <div className="flex items-start gap-4">
                    <img
                      src={review.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100'}
                      alt={review.profiles?.name || 'Anonymous'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-poppins font-semibold text-neutral-900">
                          {review.profiles?.name || 'Anonymous'}
                        </h4>
                        <div className="flex items-center">
                          <div className="flex text-yellow-400 mr-2">
                            {[...Array(review.rating)].map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-current" />
                            ))}
                          </div>
                          <span className="font-poppins text-sm font-semibold text-neutral-700">
                            {review.rating}/5
                          </span>
                        </div>
                        <div className="flex items-center text-neutral-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span className="font-lora text-sm">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <p className="font-lora text-neutral-700 leading-relaxed mb-3">
                        {review.review_text}
                      </p>
                      
                      {/* Review Images */}
                      {review.image_urls && review.image_urls.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {review.image_urls.slice(0, 3).map((imageUrl, index) => (
                            <img
                              key={index}
                              src={imageUrl}
                              alt={`Review image ${index + 1}`}
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          ))}
                          {review.image_urls.length > 3 && (
                            <div className="w-16 h-16 bg-neutral-100 rounded-lg flex items-center justify-center">
                              <span className="font-poppins text-xs text-neutral-600">
                                +{review.image_urls.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfferingReviewsModal;