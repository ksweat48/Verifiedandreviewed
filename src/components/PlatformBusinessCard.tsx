import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import ReviewerProfile from './ReviewerProfile';
import ImageGalleryPopup from './ImageGalleryPopup';
import BusinessProfileModal from './BusinessProfileModal';
import { getMatchPercentage } from '../utils/similarityUtils';

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
  is_verified?: boolean;
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
  similarity?: number; // Semantic search similarity score (0-1)
}

const PlatformBusinessCard: React.FC<{
  business: BusinessCard;
  onRecommend: (business: BusinessCard) => void;
  onTakeMeThere: (business: BusinessCard) => void;
}> = ({ business, onRecommend, onTakeMeThere }) => {
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
  
  const getSentimentRating = (score: number) => {
    if (score >= 80) return { text: 'Great', color: 'bg-green-500' };
    if (score >= 70 && score < 80) return { text: 'Good', color: 'bg-blue-500' };
    if (score >= 65) return { text: 'Fair', color: 'bg-yellow-500' };
    return { text: 'Improve', color: 'bg-red-500' };
  };

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
    if (business.reviews && business.reviews.length > 0) {
      setCurrentReviewIndex((prev) => (prev + 1) % business.reviews.length);
    }
  };

  const prevReview = () => {
    if (business.reviews && business.reviews.length > 0) {
      setCurrentReviewIndex((prev) => (prev - 1 + business.reviews.length) % business.reviews.length);
    }
  };

  const openReviewerProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!business.reviews || business.reviews.length === 0) return;
    
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
        !business.reviews[currentReviewIndex] || 
        !business.reviews[currentReviewIndex].images || 
        business.reviews[currentReviewIndex].images.length === 0) {
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
      <div className="relative rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 snap-start flex flex-col bg-white z-0 min-h-[calc(100vh-200px)] sm:min-h-[480px]" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-60 flex-shrink-0 cursor-pointer" onClick={handleBusinessClick}>
          <img
            src={business.image}
            alt={business.name}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute top-3 left-3 z-10">
            <div className={`px-3 py-1 rounded-full text-white text-sm font-poppins font-semibold ${
              business.isOpen ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {business.isOpen ? 'Open' : 'Closed'}
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-80"></div>
          <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
            <h3 className="font-poppins text-base font-bold mb-1 text-shadow line-clamp-1 cursor-pointer" onClick={handleBusinessClick}>
              {business.name}
            </h3>
            
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center">
                <Icons.Clock className="h-3 w-3 mr-1" />
                <span className="font-lora text-xs">{business.hours || 'Hours unavailable'}</span>
                {business.distance && business.duration && (
                  <span className="font-lora text-xs ml-2">• {business.distance.toFixed(1)} mi • {business.duration} min</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex flex-nowrap gap-1 overflow-hidden max-w-[70%]">
                {business.tags?.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-xs font-lora"
                  >
                    {tag}
                  </span>
                ))}
                {(business.tags?.length || 0) > 2 && (
                  <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-xs font-lora">
                    +{business.tags!.length - 2}
                  </span>
                )}
              </div>
              {/* Semantic Similarity Score - Only show if available and > 0 */}
              {business.similarity && business.similarity > 0 && (
                <div className="bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-poppins font-semibold">
                  {getMatchPercentage(business.similarity)}% match
                </div>
              )}
              
              
              <div className={`${sentimentRating.color} text-white px-3 py-1 rounded-full text-xs font-poppins font-semibold flex items-center shadow-md ml-auto`}>
                <Icons.ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                <span className="mr-1">{business.rating?.thumbsUp || 0}</span>
                <span className="mr-1">{business.rating?.thumbsDown ? `/${business.rating.thumbsDown}` : ''}</span>
                <span>{sentimentRating.text}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative bg-neutral-50 rounded-lg p-4 flex-grow flex flex-col">
            {business.reviews && business.reviews.length > 0 ? (
              <div className="flex-grow">
                {/* Review Images - 3 squares under main image */}
                {business.reviews[currentReviewIndex]?.images && business.reviews[currentReviewIndex].images.length > 0 && (
                  <div className="flex gap-1 mb-2">
                    {business.reviews[currentReviewIndex].images.slice(0, 3).map((image, index) => (
                      <img 
                        key={index}
                        src={image.url} 
                        alt={image.alt || `Review image ${index + 1}`}
                        className="w-[32%] aspect-square object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          openImageGallery(index);
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {/* Review content with GO button layout */}
                <div className="flex items-end justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center cursor-pointer" onClick={(e) => {e.stopPropagation(); setBusinessProfileOpen(true);}}>
                        <Icons.ThumbsUp className={`h-3 w-3 mr-1 flex-shrink-0 ${business.reviews[currentReviewIndex]?.thumbsUp ? 'text-green-500 fill-current' : 'text-red-500'}`} />
                        <span className="font-poppins text-xs font-semibold text-neutral-700">Review</span>
                      </div>
                      <span className="font-poppins text-xs text-neutral-500">
                        {currentReviewIndex + 1} of {business.reviews.length}
                      </span>
                    </div>
                    
                    <div className="cursor-pointer" onClick={(e) => {e.stopPropagation(); setBusinessProfileOpen(true);}}>
                      <p className="font-lora text-xs text-neutral-700 line-clamp-none break-words mb-1">
                        "{business.reviews[currentReviewIndex]?.text || 'No review text available'}"
                      </p>
                      <div className="flex items-center mb-1">
                        <div 
                          className="w-6 h-6 rounded-full overflow-hidden mr-2 flex-shrink-0 cursor-pointer"
                          onClick={(e) => {e.stopPropagation(); openReviewerProfile(e);}}
                        >
                          <img 
                            src={business.reviews[currentReviewIndex]?.authorImage || "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100"} 
                            alt={business.reviews[currentReviewIndex]?.author || 'Anonymous'} 
                            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                          />
                        </div>
                        <p 
                          className="font-poppins text-xs text-neutral-500 cursor-pointer hover:text-primary-500 transition-colors"
                          onClick={(e) => {e.stopPropagation(); openReviewerProfile(e);}}
                        >
                          {business.reviews[currentReviewIndex]?.author || 'Anonymous'}
                        </p>
                      </div>
                      
                      {business.reviews.length > 1 && (
                        <div className="flex space-x-2">
                          <button onClick={() => prevReview()} className="text-neutral-400 hover:text-neutral-600 text-xs">←</button>
                          <button onClick={() => nextReview()} className="text-neutral-400 hover:text-neutral-600 text-xs">→</button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 self-end">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onTakeMeThere(business);
                      }}
                      className="w-10 h-10 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                    >
                      GO
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-end justify-between flex-grow">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-lora text-xs text-neutral-500 text-center py-4">No reviews available</p>
                </div>
                <div className="flex-shrink-0 self-end">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onTakeMeThere(business);
                    }}
                    className="w-10 h-10 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                  >
                    GO
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
      
      {selectedReviewer && (
        <ReviewerProfile
          isOpen={reviewerProfileOpen}
          onClose={() => setReviewerProfileOpen(false)}
          reviewer={selectedReviewer}
        />
      )}
      
      {business.reviews && 
       business.reviews[currentReviewIndex]?.images && business.reviews[currentReviewIndex].images.length > 0 && (
         <ImageGalleryPopup
           isOpen={galleryOpen}
           onClose={() => setGalleryOpen(false)}
           images={business.reviews[currentReviewIndex].images || []}
           initialIndex={galleryInitialIndex}
         />
       )}
      
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

export default PlatformBusinessCard;