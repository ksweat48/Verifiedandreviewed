import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Eye, Edit, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ReviewService } from '../services/reviewService';
import { BusinessService } from '../services/businessService';
import BusinessProfileModal from './BusinessProfileModal';
import LeaveReviewModal from './LeaveReviewModal';
import type { Business } from '../services/supabaseClient';

interface UserReview {
  id: string;
  businessId: string;
  businessName: string;
  location: string;
  rating: number;
  status: 'published' | 'pending' | 'draft' | 'approved' | 'rejected';
  isVerified: boolean;
  publishDate: string;
  views: number;
  image_urls?: string[];
  review_text?: string;
}

interface MyReviewsSectionProps {
  reviews: UserReview[];
}

const MyReviewsSection: React.FC<MyReviewsSectionProps> = ({ reviews }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [isBusinessProfileModalOpen, setIsBusinessProfileModalOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [isEditReviewModalOpen, setIsEditReviewModalOpen] = useState(false);
  const [reviewToEdit, setReviewToEdit] = useState<UserReview | null>(null);
  const [localReviews, setLocalReviews] = useState(reviews);
  const reviewsPerPage = 10;
  
  // Simplified for token reduction
  const completedReviews = localReviews.filter(review => 
    review.status === 'published' || 
    review.status === 'pending' || 
    review.status === 'approved'
  );
  const currentReviews = completedReviews;

  // Update local reviews when props change
  React.useEffect(() => {
    setLocalReviews(reviews);
  }, [reviews]);

  const fetchUserReviews = async () => {
    if (user && user.id) {
      try {
        console.log('Fetching reviews for user ID:', user.id);
        const userReviews = await ReviewService.getUserReviews(user.id);
        
        console.log('🔍 DEBUG: Raw userReviews from service:', userReviews);
        console.log('🔍 DEBUG: Number of reviews returned:', userReviews.length);
        if (userReviews.length > 0) {
          console.log('🔍 DEBUG: First review raw data:', userReviews[0]);
          console.log('🔍 DEBUG: First review review_text:', userReviews[0].review_text);
          console.log('🔍 DEBUG: First review rating:', userReviews[0].rating);
          console.log('🔍 DEBUG: First review image_urls:', userReviews[0].image_urls);
        }
        
        const formattedReviews = userReviews.map(review => ({
          id: review.id,
          businessId: review.business_id,
          businessName: review.businesses?.name || 'Unknown Business',
          location: review.businesses?.location || 'Unknown Location',
          rating: review.rating,
          status: review.status,
          isVerified: review.businesses?.is_verified || false,
          publishDate: new Date().toISOString(), // Temporary fallback date
          views: 0, // We don't track views yet
          image_urls: review.image_urls || [],
          review_text: review.review_text
        }));
        
        console.log('🔍 DEBUG: Formatted reviews before setState:', formattedReviews);
        if (formattedReviews.length > 0) {
          console.log('🔍 DEBUG: First formatted review:', formattedReviews[0]);
          console.log('🔍 DEBUG: First formatted review review_text:', formattedReviews[0].review_text);
          console.log('🔍 DEBUG: First formatted review rating:', formattedReviews[0].rating);
          console.log('🔍 DEBUG: First formatted review image_urls:', formattedReviews[0].image_urls);
        }
        
        console.log('Formatted reviews before setting state:', formattedReviews);
        setReviews(formattedReviews);
      } catch (err) {
        console.error('Error fetching user reviews:', err);
      }
    }
  };

  const handleViewReview = async (review: UserReview) => {
    try {
      // For now, we'll use the business name to create a mock business object
      // In a real implementation, you'd fetch the actual business data
      const mockBusiness: Business = {
        id: review.id,
        name: review.businessName,
        address: review.location,
        location: review.location,
        category: 'General',
        tags: [],
        description: `Business associated with review`,
        image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
        gallery_urls: [],
        hours: 'Hours not available',
        is_verified: review.isVerified,
        thumbs_up: 0,
        thumbs_down: 0,
        sentiment_score: 0,
        created_at: review.publishDate,
        updated_at: review.publishDate
      };
      
      setSelectedBusinessForProfile(mockBusiness);
      setIsBusinessProfileModalOpen(true);
    } catch (error) {
      console.error('Error viewing review:', error);
      alert('Failed to load business details');
    }
  };

  const handleEditReview = (review: UserReview) => {
    setReviewToEdit(review);
    setIsEditReviewModalOpen(true);
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    setDeletingReviewId(reviewId);
    try {
      const success = await ReviewService.deleteReview(reviewId);
      if (success) {
        // Remove the review from local state
        setLocalReviews(prev => prev.filter(review => review.id !== reviewId));
        alert('Review deleted successfully');
      } else {
        throw new Error('Delete operation failed');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      alert('Failed to delete review. Please try again.');
    } finally {
      setDeletingReviewId(null);
    }
  };
  
  return (
    <>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
          My Reviews ({completedReviews.length})
        </h2>
      </div>

      {completedReviews.length === 0 ? (
        <div className="bg-neutral-50 rounded-2xl p-8 text-center">
          <ThumbsUp className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
            No Reviews Yet
          </h3>
          <p className="font-lora text-neutral-600">
            Your reviews will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {currentReviews.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900">
                      {review.businessName}
                    </h3>
                    {/* Status Badge */}
                    <div className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                      review.status === 'published' 
                        ? 'bg-green-100 text-green-700' 
                        : review.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : review.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {review.status === 'published' ? 'Published' :
                       review.status === 'approved' ? 'Approved' :
                       review.status === 'pending' ? 'Pending Approval' : 
                       'Draft'}
                    </div>
                    {/* Thumbs Up/Down Rating */}
                    {review.rating >= 4 ? (
                      <div className="flex items-center text-green-600">
                        <ThumbsUp className="h-4 w-4 mr-1 fill-current" />
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <ThumbsDown className="h-4 w-4 mr-1 fill-current" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-neutral-500 mr-1" />
                      <span className="font-lora text-sm text-neutral-600">{review.location}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-neutral-500 mr-1" />
                      <span className="font-lora text-sm text-neutral-600">
                        {new Date(review.publishDate).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <Eye className="h-4 w-4 text-neutral-500 mr-1" />
                      <span className="font-lora text-sm text-neutral-600">
                        {review.views} views
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleViewReview(review)}
                    className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleEditReview(review)}
                    className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteReview(review.id)}
                    disabled={deletingReviewId === review.id}
                    className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingReviewId === review.id ? (
                      <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Business Profile Modal */}
      <BusinessProfileModal
        isOpen={isBusinessProfileModalOpen}
        onClose={() => setIsBusinessProfileModalOpen(false)}
        business={selectedBusinessForProfile}
      />

      {/* LeaveReviewModal for editing */}
      {reviewToEdit && (
        <LeaveReviewModal
          isOpen={isEditReviewModalOpen}
          onClose={() => {
            setIsEditReviewModalOpen(false);
            setReviewToEdit(null);
            window.dispatchEvent(new CustomEvent('visited-businesses-updated'));
          }}
          business={{
            id: reviewToEdit.businessId,
            name: reviewToEdit.businessName,
            image: reviewToEdit.image_urls?.[0] || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
            address: reviewToEdit.location,
            visitDate: reviewToEdit.publishDate,
          }}
          reviewToEdit={reviewToEdit}
          onSubmitReview={() => {}} // Empty function since we handle submission internally
        />
      )}
    </>
  );
};

export default MyReviewsSection;