import React, { useState } from 'react';
import { MapPin, Calendar, Eye, Edit, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';

interface UserReview {
  id: number;
  businessName: string;
  location: string;
  rating: number;
  status: 'published' | 'pending' | 'draft';
  isVerified: boolean;
  publishDate: string;
  views: number;
}

interface MyReviewsSectionProps {
  reviews: UserReview[];
}

const MyReviewsSection: React.FC<MyReviewsSectionProps> = ({ reviews }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const reviewsPerPage = 10;
  
  // Simplified for token reduction
  const completedReviews = reviews.filter(review => review.status === 'published' || review.status === 'pending');
  const currentReviews = completedReviews.slice(0, 5);

  return (
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
                        : review.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {review.status === 'published' ? 'Published' : 
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
                    className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button 
                    className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button 
                    className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyReviewsSection;