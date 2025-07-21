import React, { useState } from 'react';
import { Camera, Upload, Star, MapPin, Tag, ChevronRight, ChevronLeft, Check, X, Loader2 } from 'lucide-react';
import { CreditService } from '../services/creditService';
import { supabase } from '../services/supabaseClient';
import { UserService } from '../services/userService';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types/user';
import type { UserReview } from '../services/supabaseClient';

interface ReviewFormData {
  featuredImage: string | null; // Changed to store URL
  galleryImages: string[]; // Changed to store URLs
  content: string;
  businessName: string;
  businessAddress: string;
  category: string;
  rating: number;
  businessId: string; // Placeholder for now, in real app this would be selected
}

const ReviewSubmissionForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ReviewFormData>({
    featuredImage: null, // Will store URL
    galleryImages: [], // Will store URLs
    content: '',
    businessName: '',
    businessAddress: '',
    category: '',
    rating: 0,
    businessId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' // Placeholder UUID for an existing business
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loading, setLoading] = useState(false); // For overall form submission
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Fetch current user on component mount
  React.useEffect(() => {
    const fetchUser = async () => {
      const user = await UserService.getCurrentUser();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  const categories = [
    'Healthy Restaurants',
    'Restaurants', 
    'Vegan',
    'Hotels',
    'Retail & Grocery',
    'Wellness',
    'Products & Services'
  ];

  // Helper function to upload image to Supabase Storage
  const uploadImageToSupabase = async (file: File, path: string): Promise<string | null> => {
    if (!currentUser) {
      setError('User not authenticated for image upload.');
      return null;
    }
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `${path}/${currentUser.id}/${fileName}`; // Organize by user ID

      const { error: uploadError } = await supabase.storage
        .from('review-images') // Use a dedicated bucket for review images
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false // Don't upsert, create new files
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('review-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image to Supabase:', error);
      setError(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  const handleFeaturedImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadingImages(true);
      setError('');
      const url = await uploadImageToSupabase(file, 'featured');
      if (url) {
        setFormData(prev => ({ ...prev, featuredImage: url }));
      }
      setUploadingImages(false);
    }
  };

  const handleGalleryImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadingImages(true);
    setError('');
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const url = await uploadImageToSupabase(file, 'gallery');
      if (url) {
        uploadedUrls.push(url);
      }
    }
    setFormData(prev => ({ ...prev, galleryImages: [...prev.galleryImages, ...uploadedUrls] }));
    setUploadingImages(false);
  };

  const handleContentChange = (content: string) => {
    setFormData({ ...formData, content });
  };

  const handleRatingClick = (rating: number) => {
    setFormData({ ...formData, rating });
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      setError('You must be logged in to submit a review.');
      return;
    }
    if (!canSubmit) {
      setError('Please fill in all required fields and meet criteria.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const allImageUrls = [];
      if (formData.featuredImage) {
        allImageUrls.push(formData.featuredImage);
      }
      allImageUrls.push(...formData.galleryImages);

      const newReview: Partial<UserReview> = {
        user_id: currentUser.id,
        business_id: formData.businessId, // Ensure this is a valid UUID for an existing business
        review_text: formData.content,
        rating: formData.rating,
        image_urls: allImageUrls,
        status: 'approved' // Reviews now auto-post as approved
      };

      const { data, error: insertError } = await supabase
        .from('user_reviews')
        .insert(newReview)
        .select('*')
        .single();

      if (insertError) throw insertError;

      // Check if review qualifies for credit reward
      const qualifiesForCredit =
        formData.rating > 0 &&
        formData.galleryImages.length >= 3 && // Assuming featured image is not counted here for simplicity
        formData.content.trim().length > 100;

      // If review qualifies, add credit reward
      if (qualifiesForCredit) {
        await CreditService.addReviewCredits(currentUser.id, {
          hasRating: true,
          photoCount: formData.galleryImages.length + (formData.featuredImage ? 1 : 0), // Count all images
          hasText: formData.content.trim().length > 0
        });
      }

      setSuccess(true);
      // Reset form
      setFormData({
        featuredImage: null,
        galleryImages: [],
        content: '',
        businessName: '',
        businessAddress: '',
        category: '',
        rating: 0,
        businessId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' // Reset to placeholder
      });
      setCurrentStep(1); // Reset to first step
      // Redirect after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);

    } catch (err) {
      console.error('Review submission error:', err);
      setError(`Failed to submit review: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const canProceedToStep2 = formData.featuredImage !== null && formData.galleryImages.length > 0;
  const canProceedToStep3 = formData.content.trim().length >= 100;
  const canSubmit = formData.businessName && formData.businessAddress && formData.category && formData.rating > 0 && canProceedToStep3;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <Loader2 className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-spin" />
          <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">Loading User Data...</h2>
          <p className="font-lora text-neutral-600">Please wait while we verify your session.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">Review Submitted!</h2>
          <p className="font-lora text-neutral-600 mb-6">Your review has been published and is now live!</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-poppins font-bold ${
                  currentStep >= step
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-200 text-neutral-600'
                }`}>
                  {currentStep > step ? <Check className="h-5 w-5" /> : step}
                </div>
                {step < 3 && (
                  <div className={`w-24 h-1 mx-4 ${
                    currentStep > step ? 'bg-primary-500' : 'bg-neutral-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="font-lora text-sm text-neutral-600">Upload Media</span>
            <span className="font-lora text-sm text-neutral-600">Write Review</span>
            <span className="font-lora text-sm text-neutral-600">Business Info</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-200">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <X className="h-5 w-5 text-red-500 mr-2" />
                <p className="font-lora text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Step 1: Media Upload */}
          {currentStep === 1 && (
            <div>
              <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6">
                Upload Photos
              </h2>

              {/* Featured Image */}
              <div className="mb-8">
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                  Featured Image (Required)
                </h3>
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors duration-200">
                  {uploadingImages ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                    </div>
                  ) : formData.featuredImage ? (
                    <div className="relative">
                      <img
                        src={formData.featuredImage}
                        alt="Featured"
                        className="max-h-64 mx-auto rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, featuredImage: null })}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Camera className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                      <p className="font-lora text-neutral-600 mb-2">
                        Click to upload your main photo
                      </p>
                      <p className="font-lora text-sm text-neutral-500">
                        JPG, PNG up to 10MB
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFeaturedImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Gallery Images */}
              <div className="mb-8">
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                  Additional Photos (Up to 5)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {formData.galleryImages.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={image}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          galleryImages: prev.galleryImages.filter((_, i) => i !== index) 
                        }))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white rounded px-1 text-xs">
                        {index + 1}
                      </div>
                    </div>
                  ))}

                  {formData.galleryImages.length < 5 && (
                    <label className="border-2 border-dashed border-neutral-300 rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-colors duration-200">
                      {uploadingImages ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                      ) : (
                        <Upload className="h-6 w-6 text-neutral-400 mb-1" />
                      )}
                      <span className="text-xs text-neutral-500">Add Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="font-lora text-xs text-neutral-500 mt-2">
                  {formData.galleryImages.length}/5 gallery images uploaded
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Write Review */}
          {currentStep === 2 && (
            <div>
              <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6">
                Write Your Review
              </h2>

              <div className="mb-6">
                <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                  Review Content (Minimum 100 characters)
                </label>

                {/* Credit Reward Info */}
                <div className="bg-primary-50 rounded-lg p-3 mb-4">
                  <p className="font-lora text-sm text-primary-700">
                    <span className="font-semibold">Earn 1 credit</span> by including a rating, at least 3 photos, and a written review.
                  </p>
                </div>

                <div className="border border-neutral-200 rounded-lg">
                  {/* Rich Text Editor Toolbar */}
                  <div className="border-b border-neutral-200 p-3 flex gap-2">
                    <button type="button" className="px-3 py-1 border border-neutral-200 rounded text-sm font-bold hover:bg-neutral-50">
                      B
                    </button>
                    <button type="button" className="px-3 py-1 border border-neutral-200 rounded text-sm italic hover:bg-neutral-50">
                      I
                    </button>
                    <button type="button" className="px-3 py-1 border border-neutral-200 rounded text-sm hover:bg-neutral-50">
                      H1
                    </button>
                    <button type="button" className="px-3 py-1 border border-neutral-200 rounded text-sm hover:bg-neutral-50">
                      H2
                    </button>
                    <button type="button" className="px-3 py-1 border border-neutral-200 rounded text-sm hover:bg-neutral-50">
                      Link
                    </button>
                  </div>

                  <textarea
                    value={formData.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Share your experience... What did you love? What could be improved? Be honest and detailed to help other visitors."
                    rows={12}
                    className="w-full p-4 border-0 rounded-b-lg font-lora focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <p className="font-lora text-xs text-neutral-500 mt-2">
                  {formData.content.length}/100 characters minimum
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Business Info & Rating */}
          {currentStep === 3 && (
            <div>
              <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6">
                Business Information
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="Enter the business name"
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                    Address/Location
                  </label>
                  <input
                    type="text"
                    value={formData.businessAddress}
                    onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                    placeholder="Enter the full address or location"
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-poppins text-sm font-medium text-neutral-700 block mb-4">
                    Overall Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => handleRatingClick(star)}
                        className={`text-3xl transition-colors duration-200 ${
                          star <= formData.rating ? 'text-yellow-400' : 'text-neutral-300'
                        } hover:text-yellow-400`}
                      >
                        <Star className="h-8 w-8 fill-current" />
                      </button>
                    ))}
                    <span className="font-poppins text-lg font-semibold text-neutral-700 ml-4">
                      {formData.rating > 0 ? `${formData.rating}/5` : 'Select rating'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-neutral-200">
            <button
              type="button"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1 || loading}
              className={`flex items-center font-poppins px-6 py-3 rounded-lg font-semibold transition-colors duration-200 ${
                currentStep === 1 || loading
                  ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Previous
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={
                  loading || uploadingImages ||
                  (currentStep === 1 && !canProceedToStep2) ||
                  (currentStep === 2 && !canProceedToStep3)
                }
                className={`flex items-center font-poppins px-6 py-3 rounded-lg font-semibold transition-colors duration-200 ${
                  loading || uploadingImages ||
                  (currentStep === 1 && !canProceedToStep2) ||
                  (currentStep === 2 && !canProceedToStep3)
                    ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                }`}
              >
                Next
                <ChevronRight className="h-5 w-5 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || loading || uploadingImages}
                className={`flex items-center font-poppins px-6 py-3 rounded-lg font-semibold transition-colors duration-200 ${
                  !canSubmit || loading || uploadingImages
                    ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Submit Review
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewSubmissionForm;