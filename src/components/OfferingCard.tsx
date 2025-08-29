import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import ReviewerProfile from './ReviewerProfile';
import ImageGalleryPopup from './ImageGalleryPopup';
import BusinessProfileModal from './BusinessProfileModal';
import { getSentimentRating, isBusinessOpen } from '../utils/displayUtils';

interface ReviewImage {
  url: string;
  alt?: string;
}

interface BusinessCard {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  address: string;
  location?: string;
  category?: string;
  tags?: string[];
  image: string;
  gallery_urls?: string[];
  hours?: string;
  days_closed?: string;
  phone_number?: string;
  website_url?: string;
  social_media?: string[];
  price_range?: string;
  service_area?: string;
  owner_user_id?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  updated_at?: string;
  is_mobile_business?: boolean;
  phone_number?: string;
  is_verified?: boolean;
  isGoogleVerified?: boolean;
  placeId?: string;
  isAIGenerated?: boolean;
  rating: {
    thumbsUp: number;
    thumbsDown?: number;
    sentimentScore: number;
  };
  isOpen: boolean;
  reviews: Array<{
    text: string;
    author: string;
    authorImage?: string;
    images?: ReviewImage[];
    thumbsUp: boolean;
  }>;
  isPlatformBusiness: boolean;
  distance?: number;
  duration?: number;
  isGoogleVerified?: boolean;
  placeId?: string;
}

const OfferingCard: React.FC<{
  business: BusinessCard;
  onRecommend: (business: BusinessCard) => void;
  onTakeMeThere: (business: BusinessCard) => void;
  onOpenOfferingReviews?: (business: BusinessCard) => void;
  offeringReviewCounts?: Record<string, number>;
}> = ({ business, onRecommend, onTakeMeThere, onOpenOfferingReviews, offeringReviewCounts }) => {
 // Debug: Log the business object and its reviews
 console.log("Card received reviews:", business.reviews);
 console.log(`🎴 PlatformBusinessCard rendering: ${business.name}`);
 console.log("Card received reviews:", business.reviews);
 console.log(`🎴 Reviews array:`, business.reviews);
 console.log(`🎴 Reviews length: ${business.reviews?.length || 0}`);
 console.log(`🎴 Has reviews: ${business.reviews && business.reviews.length > 0}`);
 
  // ✅ Check if the reviews are still there before rendering
  useEffect(() => {
    console.log("🎴 PlatformBusinessCard received reviews:", business.reviews);
  }, [business]);
  
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewerProfileOpen, setReviewerProfileOpen] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<any>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);

  // Add null checks and default values for rating object
  const sentimentScore = business.rating?.sentimentScore ?? 0;
  const thumbsUp = business.rating?.thumbsUp ?? 0;
  const thumbsDown = business.rating?.thumbsDown ?? 0;
  const sentimentRating = getSentimentRating(sentimentScore);

  const nextReview = () => {
    if (!business.reviews || business.reviews.length === 0) return;
    if (business.reviews && business.reviews.length > 0) {
      setCurrentReviewIndex((prev) => (prev + 1) % business.reviews.length);
    }
  };

  const prevReview = () => {
    if (!business.reviews || business.reviews.length === 0) return;
    if (business.reviews && business.reviews.length > 0) {
      setCurrentReviewIndex((prev) => (prev - 1 + business.reviews.length) % business.reviews.length);
    }
  };

  const openReviewerProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!business.reviews || business.reviews.length === 0 || !business.reviews[currentReviewIndex]) return;
    
    const review = business.reviews[currentReviewIndex];
    
    const reviewer = {
      name: review.author,
      image: review.authorImage || "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100",
      level: Math.floor(Math.random() * 5) + 1,
      reviewCount: Math.floor(Math.random() * 50) + 1,
      joinDate: '2023-' + (Math.floor(Math.random() * 12) + 1) + '-' + (Math.floor(Math.random() * 28) + 1),
      bio: `Food enthusiast and travel blogger. I love discovering hidden gems and sharing honest reviews about my experiences.`,
      reviews: [
        {
          businessName: business.name,
          location: business.address,
          date: new Date().toLocaleDateString(),
          rating: review.thumbsUp ? 'thumbsUp' as const : 'thumbsDown' as const,
          text: review.text
        }
      ]
    };
    
    setSelectedReviewer(reviewer);
    setReviewerProfileOpen(true);
  };

  const openImageGallery = (imageIndex: number = 0) => {
    if (!business.reviews || 
        business.reviews.length === 0 ||
        !business.reviews[currentReviewIndex] || 
        !business.reviews[currentReviewIndex].images || 
        business.reviews[currentReviewIndex].images?.length === 0) {
      return;
    }
    
    setGalleryInitialIndex(imageIndex);
    setGalleryOpen(true);
  };

  const handleBusinessClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusinessProfileOpen(true);
  };

  return (
    <>
      <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 hover:shadow-sm transition-all duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Offering Image */}
        {business.isAIGenerated ? (
          // AI-generated businesses: compact header with badges
          <div className="mb-3">
            <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg p-3 mb-2 cursor-default">
              <div className="flex items-center justify-center">
                <Icons.Sparkles className="h-5 w-5 text-purple-500 mr-2" />
                <span className="font-poppins text-sm font-semibold text-purple-700">AI Found</span>
              </div>
            </div>
            
            {/* Badges row for AI businesses */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Google Verified Badge */}
                {business.isGoogleVerified && (
                  <div className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-poppins font-semibold">
                    Google
                  </div>
                )}
                
                {/* Open/Closed Badge */}
                <div className={`px-2 py-1 rounded-full text-white text-xs font-poppins font-bold ${
                  business.isOpen ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {business.isOpen ? 'OPEN' : 'CLOSED'}
                </div>
              </div>
              
              {/* Action Icons */}
              <div className="flex items-center gap-2">
                {/* Heart Icon */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRecommend(business);
                  }}
                  className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 group"
                  title="Add to favorites"
                >
                  <Icons.Heart className="h-4 w-4 text-neutral-600 group-hover:text-red-500 group-hover:fill-current transition-all duration-200" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Platform businesses: keep existing image layout
          <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-neutral-100 cursor-pointer" onClick={handleBusinessClick}>
            <img
              src={business.image || business.image_url || '/verified and reviewed logo-coral copy copy.png'}
              alt={business.name || business.title}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
            
            {/* Open/Closed Badge - Bottom Left */}
            <div className="absolute bottom-2 left-2">
              <div className={`px-2 py-1 rounded-full text-white text-xs font-poppins font-bold ${
                isBusinessOpen(business) ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {isBusinessOpen(business) ? 'OPEN' : 'CLOSED'}
              </div>
            </div>
            
            {/* Heart Icon - Top Right */}
            <div className="absolute top-2 right-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRecommend(business);
                }}
                className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 group"
                title="Add to favorites"
              >
                <Icons.Heart className="h-4 w-4 text-neutral-600 group-hover:text-red-500 group-hover:fill-current transition-all duration-200" />
              </button>
            </div>
          </div>
        )}
        
        {/* Offering Details */}
        <div className="space-y-2">
          {/* Main Text: Offering name */}
          <h6 className="font-poppins font-bold text-black text-sm line-clamp-1">
            {business.title || business.name || 'Untitled Offering'}
          </h6>
          
          {/* Sub Text: "at [Business Name]" */}
          <p className="font-lora text-xs text-black font-bold line-clamp-1">
            at {business.business_name || business.name || 'Unknown Business'}
          </p>
          
          {/* Description */}
          {!business.isAIGenerated ? (
            (business.description || business.short_description) && (
              <p className="font-lora text-xs text-neutral-600 line-clamp-2">
                {business.description || business.short_description}
              </p>
            )
          ) : (
            {/* No description for AI businesses */}
          )}
          
          {/* Distance Display */}
          {business.distance && business.distance !== 999999 && (
            <p className="font-lora text-xs text-neutral-500">
              {business.distance.toFixed(1)} mil.
            </p>
          )}
          
          {/* Price */}
          {!business.isAIGenerated && business.price_cents && business.price_cents > 0 && (
            <div className="flex items-center justify-between">
              <span className="font-poppins font-bold text-primary-600 text-sm">
                ${(business.price_cents / 100).toFixed(2)}
              </span>
            </div>
          )}
          
          {/* Bottom Actions - Phone and Map for both AI and Platform */}
          <div className="flex items-center gap-2 mt-2">
            {/* Phone Icon - Left (conditional for both AI and Platform) */}
            {business.phone_number && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`tel:${business.phone_number}`, '_self');
                }}
                className="p-2 bg-green-100 hover:bg-green-200 text-green-600 hover:text-green-700 rounded-lg transition-all duration-200 flex items-center justify-center"
                title="Call business"
              >
                <Icons.Phone className="h-4 w-4" />
              </button>
            )}
            
            {/* Review Icon - Center (only for platform businesses) */}
            <div className="flex-1 flex justify-center">
            {business.isPlatformBusiness && onOpenOfferingReviews && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOfferingReviews(business);
                  }}
                  className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 hover:text-purple-700 rounded-lg transition-all duration-200 flex items-center justify-center"
                  title="View reviews"
                >
                  <Icons.MessageSquare className="h-4 w-4" />
                </button>
                {/* Review Count Notification Badge */}
                {offeringReviewCounts && business.offeringId && offeringReviewCounts[business.offeringId] > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {offeringReviewCounts[business.offeringId]}
                  </span>
                )}
              </div>
            )}
            </div>
            
            {/* Map Icon - Right (always present, behavior differs for AI vs Platform) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTakeMeThere(business);
              }}
              className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 rounded-lg transition-all duration-200 flex items-center justify-center"
              title={business.isAIGenerated ? "View Google Profile" : "Get directions"}
            >
              <Icons.MapPin className="h-4 w-4" />
            </button>
          </div>
          
          {/* Tags */}
          {business.tags && business.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {business.tags.slice(0, 2).map((tag, index) => (
                <span key={index} className="bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full text-xs font-lora">
                  {tag}
                </span>
              ))}
              {business.tags.length > 2 && (
                <span className="bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full text-xs font-lora">
                  +{business.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reviewer Profile Modal */}
      {reviewerProfileOpen && selectedReviewer && (
        <ReviewerProfile
          isOpen={reviewerProfileOpen}
          onClose={() => setReviewerProfileOpen(false)}
          reviewer={selectedReviewer}
        />
      )}
      
      {/* Image Gallery Popup */}
      {business.reviews && 
       business.reviews.length > 0 &&
       business.reviews[currentReviewIndex]?.images && 
       business.reviews[currentReviewIndex].images?.length > 0 && (
         <ImageGalleryPopup
           isOpen={galleryOpen}
           onClose={() => setGalleryOpen(false)}
           images={business.reviews[currentReviewIndex]?.images || []}
           initialIndex={galleryInitialIndex}
         />
       )}
      
      {/* Business Profile Modal */}
      <BusinessProfileModal
        isOpen={businessProfileOpen}
        onClose={() => setBusinessProfileOpen(false)}
        business={{
          // Pass all business properties directly
          ...business,
          // Map specific fields for modal compatibility
          image_url: business.image,
          location: business.location || business.address,
          is_verified: business.is_verified || business.isPlatformBusiness,
          thumbs_up: business.rating?.thumbsUp,
          thumbs_down: business.rating?.thumbsDown,
          sentiment_score: business.rating?.sentimentScore,
          gallery_urls: business.gallery_urls || business.reviews?.[0]?.images?.map(img => img.url) || []
        }}
      />
    </>
  );
};

export default OfferingCard;