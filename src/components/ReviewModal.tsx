import React, { useCallback, useEffect } from 'react';
import * as Icons from 'lucide-react';

interface ReviewImage {
  url: string;
  alt?: string;
}

interface Business {
  id: string;
  name: string;
  rating?: {
    thumbsUp: number;
    thumbsDown?: number;
    sentimentScore: number;
  };
  image: string;
  isOpen: boolean;
  hours: string;
  address: string;
  reviews: Array<{
    text: string;
    author: string;
    authorImage?: string;
    images?: ReviewImage[];
    thumbsUp: boolean;
  }>;
  isPlatformBusiness?: boolean;
  tags?: string[];
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business | null;
  currentReviewIndex: number;
  onPrevReview: () => void;
  onNextReview: () => void;
  onOpenReviewerProfile?: (reviewIndex: number) => void;
  onTakeMeThere?: (business: Business) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  business,
  currentReviewIndex,
  onPrevReview,
  onNextReview,
  onOpenReviewerProfile,
  onTakeMeThere
}) => {
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

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        onPrevReview();
        break;
      case 'ArrowRight':
        onNextReview();
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [isOpen, onPrevReview, onNextReview, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !business) return null;

  const currentReview = business.reviews[currentReviewIndex];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-neutral-200">
          <div className="flex items-center pr-8">
            <img 
              src={business.image} 
              alt={business.name}
              className="w-12 h-12 rounded-lg object-cover mr-4"
            />
            <div>
              <h3 className="font-poppins text-xl font-semibold text-neutral-900">{business.name}</h3>
              <div className="flex items-center text-neutral-600">
                <Icons.MapPin className="h-4 w-4 mr-1" />
                <span className="font-lora text-sm">{business.address}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-neutral-500 hover:text-neutral-700 transition-colors duration-200"
          >
            <Icons.X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Review Content */}
        <div className="p-6">
          {business.reviews.length > 0 ? (
            <div>
              {/* Review Images */}
              {currentReview.images && currentReview.images.length > 0 && (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {currentReview.images.slice(0, 3).map((image, index) => (
                    <img 
                      key={index}
                      src={image.url} 
                      alt={image.alt || `Review image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ))}
                </div>
              )}
              
              {/* Review Text */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <Icons.ThumbsUp className={`h-4 w-4 mr-2 ${currentReview.thumbsUp ? 'text-green-500 fill-current' : 'text-neutral-400'}`} />
                  <span className="font-poppins text-sm font-semibold text-neutral-700">Review</span>
                </div>
                
                <p className="font-lora text-neutral-700 mb-4">
                  "{currentReview.text}"
                </p>
                
                {/* Reviewer Info */}
                <div className="flex items-center">
                  {currentReview.authorImage ? (
                    <img 
                      src={currentReview.authorImage} 
                      alt={currentReview.author}
                      className="w-8 h-8 rounded-full object-cover mr-3 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => onOpenReviewerProfile && onOpenReviewerProfile(currentReviewIndex)}
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                      <span className="font-poppins text-primary-500 font-semibold">
                        {currentReview.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span 
                    className="font-poppins text-sm text-neutral-700 cursor-pointer hover:text-primary-500 transition-colors"
                    onClick={() => onOpenReviewerProfile && onOpenReviewerProfile(currentReviewIndex)}
                  >
                    {currentReview.author}
                  </span>
                </div>
              </div>
              
              {/* Review Navigation */}
              {business.reviews.length > 1 && (
                <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                  <div className="flex items-center">
                    <span className="font-lora text-sm text-neutral-600">
                      {currentReviewIndex + 1} of {business.reviews.length} reviews
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrevReview();
                      }}
                      className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors duration-200"
                      disabled={business.reviews.length <= 1}
                    >
                      <Icons.ChevronLeft className="h-5 w-5" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNextReview();
                      }}
                      className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors duration-200"
                      disabled={business.reviews.length <= 1}
                    >
                      <Icons.ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="font-lora text-neutral-600">No reviews available for this business.</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 bg-neutral-50 rounded-b-2xl">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTakeMeThere && onTakeMeThere(business);
            }}
            className="w-full bg-gradient-to-r from-primary-500 to-accent-500 text-white py-3 px-4 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
          >
            <Icons.Navigation className="h-5 w-5 mr-2" />
            Take Me There
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;