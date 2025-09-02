import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ReviewService } from '../services/reviewService';
import { BusinessService } from '../services/businessService';
import BusinessProfileModal from './BusinessProfileModal';
import LeaveReviewModal from './LeaveReviewModal';
import type { Business } from '../services/supabaseClient';
import { showSuccess, showError } from '../utils/toast';

interface UserReview {
  id: string;
  businessId: string;
  businessName: string;
  location: string;
  rating: number;
  status: 'pending' | 'approved' | 'rejected';
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
  const [localReviews, setLocalReviews] = useState<UserReview[]>([]);
  const reviewsPerPage = 10;
  
  // Update local reviews when props change
  React.useEffect(() => {
    console.log('🔍 DEBUG: MyReviewsSection received reviews prop:', reviews);
    console.log('🔍 DEBUG: First review detailed:', reviews[0]);
    setLocalReviews(reviews);
  }, [reviews]);
  
  // Use the reviews prop directly instead of localReviews for filtering
  const completedReviews = reviews.filter(review => {
    console.log('🔍 DEBUG: Checking review:', review.id, 'status:', review.status, 'typeof:', typeof review.status);
    const isValidStatus = review.status === 'approved';
    console.log('🔍 DEBUG: Status check result for', review.id, ':', isValidStatus);
    return isValidStatus;
  });
  
  console.log('🔍 DEBUG: reviews prop before filtering:', reviews);
  console.log('🔍 DEBUG: completedReviews after filtering:', completedReviews);
  console.log('🔍 DEBUG: Detailed filter check:', reviews.map(r => ({ 
    id: r.id, 
    status: r.status,
    statusType: typeof r.status,
    statusValue: JSON.stringify(r.status),
    passesFilter: r.status === 'published' || r.status === 'pending' || r.status === 'approved',
    checkPublished: r.status === 'published',
    checkPending: r.status === 'pending', 
    checkApproved: r.status === 'approved'
  })));
  
  const currentReviews = completedReviews;

  const handleViewReview = async (review: UserReview) => {
    try {
      // Fetch the complete business data from the database
      console.log('🔍 Fetching business details for ID:', review.businessId);
      const business = await BusinessService.getBusinessById(review.businessId);
      
      if (business) {
        console.log('✅ Business data fetched successfully:', business.name);
        setSelectedBusinessForProfile(business);
      } else {
        console.error('❌ Business not found for ID:', review.businessId);
        // Fallback to mock business if fetch fails
        const fallbackBusiness: Business = {
          id: review.businessId,
          name: review.businessName,
          address: review.location,
          location: review.location,
          category: 'General',
          tags: [],
          description: `Business information not available`,
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
        setSelectedBusinessForProfile(fallbackBusiness);
      }
      
      setIsBusinessProfileModalOpen(true);
    } catch (error) {
      console.error('Error viewing review:', error);
      showError('Failed to load business details. Please try again.');
    }
  };

  const handleEditReview = (review: UserReview) => {
    console.log('🔍 DEBUG: handleEditReview called with:', review);
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
        showSuccess('Review deleted successfully');
      } else {
        throw new Error('Delete operation failed');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      showError('Failed to delete review. Please try again.');
    } finally {
      setDeletingReviewId(null);
    }
  };
  
  return (
    <>
      <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
          My Reviews ({completedReviews.length})
        </h2>
      </div>

      {completedReviews.length === 0 ? (
        <div className="bg-neutral-50 rounded-xl p-6 text-center">
          <Icons.ThumbsUp className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
            No Reviews Yet
          </h3>
          <p className="font-lora text-neutral-600">
            Your reviews will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentReviews.map((review) => (
            <div key={review.id} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
              {/* Business Image and Name - Line 1 */}
              <div className="flex items-center gap-3 mb-2">
                {/* Business Image - 25% */}
                <div className="w-1/4 flex-shrink-0">
                  <img
                    src={review.image_urls?.[0] || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400'}
                    alt={review.businessName}
                    className="w-full h-16 object-cover rounded-lg"
                  />
                </div>
                
                {/* Business Name - 75% */}
                <div className="w-3/4 flex-shrink-0">
                  <h3 className="font-poppins text-lg font-semibold text-neutral-900 line-clamp-2 break-words leading-tight">
                    {review.businessName}
                  </h3>
                </div>
              </div>
              
              {/* Status and Rating - Line 2 */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                  review.status === 'approved' 
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {review.status === 'approved' ? 'Published' : 'Draft'}
                </div>
                
                {review.rating >= 4 ? (
                  <div className="flex items-center bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    <Icons.ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                    <span className="font-poppins text-xs font-semibold">Recommend</span>
                  </div>
                ) : (
                  <div className="flex items-center bg-red-100 text-red-700 px-2 py-1 rounded-full">
                    <Icons.ThumbsDown className="h-3 w-3 mr-1 fill-current" />
                    <span className="font-poppins text-xs font-semibold">Not for me</span>
                  </div>
                )}
              </div>
              
              {/* Address and Date - Line 3 */}
              <div className="flex items-center gap-4 mb-2 flex-wrap">
                <div className="flex items-center">
                  <Icons.MapPin className="h-4 w-4 text-neutral-500 mr-1" />
                  <span className="font-lora text-sm text-neutral-600 break-words">{review.location}</span>
                </div>
                <div className="flex items-center">
                  <Icons.Calendar className="h-4 w-4 text-neutral-500 mr-1" />
                  <span className="font-lora text-sm text-neutral-600">
                    {new Date(review.publishDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              {/* Views and Actions - Line 4 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Icons.Eye className="h-4 w-4 text-neutral-500 mr-1" />
                  <span className="font-lora text-sm text-neutral-600">
                    {review.views} views
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleViewReview(review)}
                    className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="View"
                  >
                    <Icons.Eye className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleEditReview(review)}
                    className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Edit"
                  >
                    <Icons.Edit className="h-4 w-4" />
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
                      <Icons.Trash2 className="h-4 w-4" />
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