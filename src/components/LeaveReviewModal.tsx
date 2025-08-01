import React, { useState, useEffect } from 'react';
import { X, Camera, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { CreditService } from '../services/creditService';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';

interface ReviewImage {
  file: File;
  preview: string;
}

interface UserReview {
  id: string;
  businessId: string;
  businessName: string;
  rating: number;
  review_text?: string;
  image_urls?: string[];
}

interface LeaveReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: {
    id: string;
    name: string;
    image: string;
    address: string;
    visitDate: string;
  };
  reviewToEdit?: UserReview;
  onSubmitReview: (review: {
    businessId: string;
    rating: 'thumbsUp' | 'thumbsDown';
    text: string;
    images: File[];
  }) => void;
}

// Helper to convert numeric rating to thumbsUp/thumbsDown
const getThumbsRating = (numericRating: number | undefined) => {
  if (numericRating === undefined) return null;
  return numericRating >= 4 ? 'thumbsUp' : 'thumbsDown';
};

const LeaveReviewModal: React.FC<LeaveReviewModalProps> = ({
  isOpen,
  onClose,
  business,
  reviewToEdit,
  onSubmitReview
}) => {
  const [rating, setRating] = useState<'thumbsUp' | 'thumbsDown' | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [images, setImages] = useState<ReviewImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Reset form when reviewToEdit changes
  useEffect(() => {
    console.log('🔍 DEBUG: reviewToEdit changed:', reviewToEdit);
    if (reviewToEdit) {
      console.log('🔍 DEBUG: Full reviewToEdit object:', JSON.stringify(reviewToEdit, null, 2));
      console.log('🔍 DEBUG: review_text value:', reviewToEdit?.review_text);
      console.log('🔍 DEBUG: rating value:', reviewToEdit?.rating);
      console.log('🔍 DEBUG: image_urls:', reviewToEdit?.image_urls);
    }
    
    if (reviewToEdit) {
      // Pre-fill form with existing review data
      setRating(getThumbsRating(reviewToEdit.rating));
      setReviewText(reviewToEdit.review_text || '');
      setImages(reviewToEdit.image_urls?.map(url => ({ file: null as any, preview: url })) || []);
    } else {
      // Reset form for new review
      setRating(null);
      setReviewText('');
      setImages([]);
    }
  }, [reviewToEdit]);
  
  // Handle browser back button for modal
  useEffect(() => {
    if (isOpen) {
      // Push a new state when modal opens
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
  
  // Reset form when reviewToEdit changes
  useEffect(() => {
    setRating(getThumbsRating(reviewToEdit?.rating));
    setReviewText(reviewToEdit?.review_text || '');
    setImages(reviewToEdit?.image_urls?.map(url => ({ file: null as any, preview: url })) || []);
  }, [reviewToEdit]);

  // Helper function to upload image to Supabase Storage
  const uploadImageToSupabase = async (file: File): Promise<string | null> => {
    try {
      const user = await UserService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `${user.id}/reviews/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('review-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('review-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Limit to 3 images total
    const remainingSlots = 3 - images.length;
    if (remainingSlots <= 0) return;

    setUploadingImages(true);
    
    const uploadImages = async () => {
      const newImages: ReviewImage[] = [];
      
      for (const file of Array.from(files).slice(0, remainingSlots)) {
        const url = await uploadImageToSupabase(file);
        if (url) {
          newImages.push({
            file,
            preview: url // Use the uploaded URL as preview
          });
        }
      }
      
      setImages([...images, ...newImages]);
      setUploadingImages(false);
    };
    
    uploadImages();
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    // Only revoke object URL if it's a local file preview
    if (newImages[index].file) {
      URL.revokeObjectURL(newImages[index].preview);
    }
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const handleSubmit = () => {
    if (!rating) return;
    
    setIsSubmitting(true);
        
    const submitReview = async () => {
      try {
        const user = await UserService.getCurrentUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Collect image URLs (already uploaded during image selection)
        const imageUrls = images.map(img => img.preview);

        // Convert 'thumbsUp'/'thumbsDown' to numeric rating (5 or 1)
        const numericRating = rating === 'thumbsUp' ? 5 : 1;

        if (reviewToEdit) {
          // UPDATE existing review
          const { data, error } = await supabase
            .from('user_reviews')
            .update({
              review_text: reviewText,
              rating: numericRating,
              image_urls: imageUrls,
              status: 'approved',
              updated_at: new Date().toISOString()
            })
            .eq('id', reviewToEdit.id)
            .select('*')
            .single();

          if (error) throw error;
          console.log('Review updated:', data);
        } else {
          // INSERT new review
          const { data, error } = await supabase
            .from('user_reviews')
            .insert({
              user_id: user.id,
              business_id: business.id,
              review_text: reviewText,
              rating: numericRating,
              image_urls: imageUrls,
              status: 'approved'
            })
            .select('*')
            .single();

          if (error) throw error;
          console.log('Review inserted:', data);
          
          // Log review submission activity
          ActivityService.logReviewSubmit(user.id, business.id, business.name);
        }

        // Check if review qualifies for credit reward (only for new reviews)
        if (!reviewToEdit) {
          const qualifiesForCredit = numericRating > 0 && imageUrls.length >= 3 && reviewText.trim().length > 0;
          if (qualifiesForCredit) {
            await CreditService.addReviewCredits(user.id, {
              hasRating: true,
              photoCount: imageUrls.length,
              hasText: reviewText.trim().length > 0
            });
          }
        }

        // Dispatch event to update visited businesses list
        window.dispatchEvent(new CustomEvent('visited-businesses-updated'));

        // Call the original onSubmitReview for any additional handling
        onSubmitReview({
          businessId: reviewToEdit ? reviewToEdit.businessId : business.id,
          rating,
          text: reviewText,
          images: images.map(img => img.file).filter(Boolean) as File[]
        });
        
        // Reset form (only if it was a new submission)
        if (!reviewToEdit) {
          setRating(null);
          setReviewText('');
          setImages([]);
        }
        setIsSubmitting(false);
        onClose();
        
      } catch (error) {
        console.error('Error submitting review:', error);
        alert('Failed to submit review. Please try again.');
        setIsSubmitting(false);
      }
    };
    
    submitReview();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <img 
              src={business.image} 
              alt={business.name}
              className="w-12 h-12 rounded-lg object-cover mr-3"
            />
            <div>
              <h3 className="font-poppins text-xl font-semibold text-neutral-900">
                {reviewToEdit ? 'Edit Your Review' : business.name}
              </h3>
              <p className="font-lora text-sm text-neutral-600">Visited {business.visitDate}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 transition-colors duration-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Credit Reward Info */}
        {!reviewToEdit && (
          <div className="bg-primary-50 rounded-lg p-3 mb-6">
            <p className="font-lora text-sm text-primary-700">Earn 1 credit with a complete review.</p>
          </div>
        )}
        
        {/* Rating Selection */}
        <div className="mb-6">
          <h4 className="font-poppins font-semibold text-neutral-900 mb-3">
            How was your experience?
          </h4>
          <div className="flex gap-4">
            <button
              onClick={() => setRating('thumbsUp')}
              className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                rating === 'thumbsUp' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-neutral-200 hover:border-green-300'
              }`}
            >
              <ThumbsUp className={`h-8 w-8 mb-2 ${rating === 'thumbsUp' ? 'text-green-500 fill-current' : 'text-neutral-400'}`} />
              <span className={`font-poppins font-semibold ${rating === 'thumbsUp' ? 'text-green-700' : 'text-neutral-700'}`}>
                Recommend
              </span>
            </button>
            
            <button
              onClick={() => setRating('thumbsDown')}
              className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                rating === 'thumbsDown' 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-neutral-200 hover:border-red-300'
              }`}
            >
              <ThumbsDown className={`h-8 w-8 mb-2 ${rating === 'thumbsDown' ? 'text-red-500 fill-current' : 'text-neutral-400'}`} />
              <span className={`font-poppins font-semibold ${rating === 'thumbsDown' ? 'text-red-700' : 'text-neutral-700'}`}>
                Not for me
              </span>
            </button>
          </div>
        </div>
        
        {/* Review Text */}
        <div className="mb-6">
          <h4 className="font-poppins font-semibold text-neutral-900 mb-3">
            Share your thoughts (optional)
          </h4>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="What did you like or dislike? What should others know before visiting?"
            rows={4}
            className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        
        {/* Image Upload */}
        <div className="mb-6">
          <h4 className="font-poppins font-semibold text-neutral-900 mb-3">
            Add photos (optional)
          </h4>
          
          <div className="flex gap-2 mt-3">
            {images.map((image, index) => (
              <div key={index} className="relative w-16 h-16">
                <img 
                  src={image.preview} 
                  alt={`Upload ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            
            {/* Upload Button - Only show if less than 3 images */}
            {images.length < 3 && (
              <label className="w-16 h-16 border-2 border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-colors duration-200">
                <Camera className="h-4 w-4 text-neutral-400 mb-1" />
                <span className="text-xs text-neutral-500">{images.length > 0 ? 'Add more' : 'Add photos'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          
          <p className="font-lora text-xs text-neutral-500">
            {images.length}/3 photos • Help others see what you experienced
          </p>
        </div>
        
        {/* Submit Button */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 font-poppins border border-neutral-200 text-neutral-700 py-3 px-4 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!rating || isSubmitting || uploadingImages}
            className={`flex-1 font-poppins py-3 px-4 rounded-lg font-semibold transition-colors duration-200 ${
              !rating || isSubmitting || uploadingImages
                ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            {isSubmitting ? 'Submitting...' : uploadingImages ? 'Uploading...' : (reviewToEdit ? 'Update Review' : 'Post Review')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveReviewModal;