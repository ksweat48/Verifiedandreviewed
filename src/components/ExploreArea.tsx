import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, ThumbsUp, MapPin, Navigation } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import BusinessProfileModal from './BusinessProfileModal';
import LeaveReviewModal from './LeaveReviewModal';
import { BusinessService } from '../services/businessService';
import { ReviewService } from '../services/reviewService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { getMatchPercentage } from '../utils/similarityUtils';
import { getSentimentRating } from '../utils/displayUtils';

interface ReviewImage {
  url: string;
  alt?: string;
}

interface Business {
  id: string;
  name: string;
  image: string;
  rating: {
    thumbsUp: number;
    thumbsDown?: number;
    sentimentScore: number;
  };
  isOpen: boolean;
  hours: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  reviews: Array<{
    text: string;
    author: string;
    authorImage?: string;
    images?: ReviewImage[];
    thumbsUp: boolean;
  }>;
  isPlatformBusiness: boolean;
  tags: string[];
  distance?: number; // Added during processing
}

const ExploreArea = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentReviewIndices, setCurrentReviewIndices] = useState<{ [key: string]: number }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);
  const [leaveReviewModalOpen, setLeaveReviewModalOpen] = useState(false);
  const [selectedBusinessForReview, setSelectedBusinessForReview] = useState<Business | null>(null);
  
  useEffect(() => {
    loadNearbyBusinesses();
  }, [refreshKey]);

  const loadNearbyBusinesses = async () => {
    setLoading(true);
    
    try {
      // Use the unified search system to get platform offerings
      const searchResponse = await SemanticSearchService.searchByVibe('restaurants cafes bars food services', {
        latitude: undefined,
        longitude: undefined,
        matchThreshold: 0.1, // Very low threshold for broad discovery
        matchCount: 6
      });
      
      let transformedBusinesses = [];
      
      if (searchResponse.success && searchResponse.results.length > 0) {
        // Use unified search results (prioritizing platform offerings)
        transformedBusinesses = searchResponse.results.map(business => ({
          id: business.id || business.business_id,
          name: business.name || business.business_name,
          category: business.category || business.business_category,
          description: business.description || business.business_description,
          short_description: business.short_description || business.business_short_description,
          phone_number: business.phone_number,
          website_url: business.website_url,
          social_media: business.social_media || [],
          price_range: business.price_range,
          service_area: business.service_area,
          days_closed: business.days_closed,
          owner_user_id: business.owner_user_id,
          latitude: business.latitude,
          longitude: business.longitude,
          created_at: business.created_at,
          updated_at: business.updated_at,
          rating: business.rating || {
            thumbsUp: business.thumbs_up || 0,
            thumbsDown: business.thumbs_down || 0,
            sentimentScore: business.sentiment_score || 0
          },
          image: business.image || business.image_url || '/verified and reviewed logo-coral copy copy.png',
          isOpen: business.isOpen !== undefined ? business.isOpen : true,
          hours: business.hours || 'Hours unavailable',
          address: business.address || business.location || '',
          reviews: business.reviews || [],
          isPlatformBusiness: business.isPlatformBusiness || business.is_verified || false,
          tags: business.tags || [],
          similarity: business.similarity
        }));
      } else {
        // Fallback to legacy business service if unified search fails
        const offeringIds = searchResponse.results
          .filter(business => business.source === 'offering')
          .map(business => business.id)
          .filter(Boolean);
          
        const businessIds = searchResponse.results
          .filter(business => business.source === 'platform_business')
          .map(business => business.business_id || business.id)
          .filter(Boolean);
        
        const realBusinesses = await BusinessService.getAllBusinesses();
        transformedBusinesses = realBusinesses.map(business => ({
          id: business.id,
          name: business.name,
          category: business.category,
          description: business.description,
          short_description: business.short_description,
          phone_number: business.phone_number,
          website_url: business.website_url,
          social_media: business.social_media,
          price_range: business.price_range,
          service_area: business.service_area,
          days_closed: business.days_closed,
          owner_user_id: business.owner_user_id,
          latitude: business.latitude,
          longitude: business.longitude,
          created_at: business.created_at,
          updated_at: business.updated_at,
          rating: {
            thumbsUp: business.thumbs_up || 0,
            thumbsDown: business.thumbs_down || 0,
            sentimentScore: business.sentiment_score || 0
          },
          image: business.image_url || '/verified and reviewed logo-coral copy copy.png',
          isOpen: true,
          hours: business.hours || 'Hours unavailable',
          address: business.address || '',
          reviews: [],
          isPlatformBusiness: business.is_verified || false,
          tags: business.tags || []
        }));
      }
      
      // Fetch reviews for each business
      const businessesWithReviews = await Promise.all(
        transformedBusinesses.slice(0, 6).map(async (business) => {
          try {
            const reviews = await ReviewService.getBusinessReviews(business.id);
            const formattedReviews = reviews.map(review => ({
              text: review.review_text || 'No review text available',
              author: review.profiles?.name || 'Anonymous',
              authorImage: review.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100',
              images: review.images || [],
              thumbsUp: review.thumbs_up || false
            }));
            
            return {
              ...business,
              reviews: formattedReviews
            };
          } catch (error) {
            console.error('Error fetching reviews for business:', business.id, error);
            return business;
          }
        })
      );
      
      // Handle batch review fetching
      let allOfferingReviews: any[] = [];
      let allBusinessReviews: any[] = [];
      
      if (offeringIds.length > 0) {
        console.log('📦 Batch fetching reviews for', offeringIds.length, 'offerings');
        allOfferingReviews = await ReviewService.getReviewsForOffering(offeringIds);
      }
      
      if (businessIds.length > 0) {
        console.log('📦 Batch fetching reviews for', businessIds.length, 'businesses');
        allBusinessReviews = await ReviewService.getReviewsForBusiness(businessIds);
      }
      
      // Create maps for quick lookup
      const offeringReviewsMap = new Map();
      const businessReviewsMap = new Map();
      
      allOfferingReviews.forEach(review => {
        if (!offeringReviewsMap.has(review.offering_id)) {
          offeringReviewsMap.set(review.offering_id, []);
        }
        offeringReviewsMap.get(review.offering_id).push(review);
      });
      
      allBusinessReviews.forEach(review => {
        if (!businessReviewsMap.has(review.business_id)) {
          businessReviewsMap.set(review.business_id, []);
        }
        businessReviewsMap.get(review.business_id).push(review);
      });
      
      // Attach reviews to businesses
      transformedBusinesses.forEach(business => {
        let reviews = [];
        
        if (business.source === 'offering') {
          reviews = offeringReviewsMap.get(business.id) || [];
        } else if (business.source === 'platform_business') {
          const businessId = business.business_id || business.id;
          reviews = businessReviewsMap.get(businessId) || [];
        }
        
        const formattedReviews = reviews.map((review: any) => ({
          text: review.review_text || 'No review text available',
          author: review.profiles?.name || 'Anonymous',
          authorImage: review.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100',
          images: review.images || [],
          thumbsUp: review.thumbs_up || false
        }));
        
        business.reviews = formattedReviews;
      });
      
      setBusinesses(businessesWithReviews);
    } catch (error) {
      console.error('Error loading nearby businesses:', error);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle review navigation
  const nextReview = (businessId: string) => {
    const business = businesses.find(b => b.id === businessId);
    if (!business || !business.reviews || business.reviews.length === 0) return;
    
    setCurrentReviewIndices(prev => ({
      ...prev,
      [businessId]: ((prev[businessId] || 0) + 1) % business.reviews.length
    }));
  };
  
  const prevReview = (businessId: string) => {
    const business = businesses.find(b => b.id === businessId);
    if (!business || !business.reviews || business.reviews.length === 0) return;
    
    setCurrentReviewIndices(prev => ({
      ...prev,
      [businessId]: ((prev[businessId] || 0) - 1 + business.reviews.length) % business.reviews.length
    }));
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Function to handle "Take Me There" button click
  const handleTakeMeThere = (business: Business) => {
    // Debug: Log the complete business object to inspect data
    console.log('🗺️ DEBUG: ExploreArea handleTakeMeThere called with business object:', business);
    console.log('🗺️ DEBUG: Business coordinates:', { 
      latitude: business.latitude, 
      longitude: business.longitude,
      hasCoords: !!(business.latitude && business.longitude)
    });
    console.log('🗺️ DEBUG: Business address/name:', { 
      address: business.address, 
      name: business.name,
      addressType: typeof business.address,
      nameType: typeof business.name
    });
    
    // Robust navigation URL construction with data validation
    let mapsUrl;
    if (business.latitude && business.longitude) {
      // Priority 1: Use coordinates (most reliable)
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
      console.log('🗺️ DEBUG: Using coordinates for maps URL');
    } else if (business.address && typeof business.address === 'string' && business.address.trim().length > 0) {
      // Priority 2: Use valid address string
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address.trim())}`;
      console.log('🗺️ DEBUG: Using address for maps URL:', business.address.trim());
    } else if (business.name && typeof business.name === 'string' && business.name.trim().length > 0) {
      // Priority 3: Use business name as fallback
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name.trim())}`;
      console.log('🗺️ DEBUG: Using business name for maps URL:', business.name.trim());
    } else {
      // Last resort: Generic search
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=business`;
      console.log('🗺️ DEBUG: Using generic fallback for maps URL');
    }
    
    console.log('🗺️ Opening Google Maps with URL:', mapsUrl);
    window.open(mapsUrl, '_blank');
  };

  const openBusinessProfile = (business: Business) => {
    setSelectedBusinessForProfile(business);
    setBusinessProfileOpen(true);
  };

  const openReviewModal = (business: Business) => {
    setSelectedBusinessForReview(business);
    setLeaveReviewModalOpen(true);
  };

  const handleReviewSubmit = async (reviewData: any) => {
    // Handle review submission logic here
    setLeaveReviewModalOpen(false);
    setSelectedBusinessForReview(null);
    // Refresh businesses to show new review
    handleRefresh();
  };

  // Function to handle "Recommend" button click
  const handleRecommend = (business: Business) => {
    alert(`Thanks! We'll review ${business.name} for addition to our platform.`);
  };

  // Handle favoriting platform businesses
  const handleFavoritePlatformBusiness = async (business: Business) => {
    if (!currentUser) {
      // Dispatch custom event to open auth modal
      const event = new CustomEvent('open-auth-modal', {
        detail: { mode: 'signup' }
      });
      document.dispatchEvent(event);
      return;
    }

    try {
      // Transform platform business to recommendation format
      const businessData = {
        name: business.name,
        address: business.address || business.location || 'Address not available',
        location: business.location || business.address || 'Location not available',
        category: business.category || 'Platform Business',
        description: business.description || business.short_description || `Platform business: ${business.name}`,
        image: business.image,
        shortDescription: business.short_description || business.description,
        rating: 5, // Default high rating for platform businesses
        hours: business.hours,
        isOpen: true,
        reviews: business.reviews || [],
        isPlatformBusiness: true,
        tags: business.tags || [],
        similarity: 0.9 // High similarity for platform businesses
      };

      const success = await BusinessService.saveAIRecommendation(businessData, currentUser.id);
      if (success) {
        alert(`${business.name} has been added to your favorites!`);
      } else {
        alert('Failed to add to favorites. Please try again.');
      }
    } catch (error) {
      console.error('Error adding platform business to favorites:', error);
      alert('Failed to add to favorites. Please try again.');
    }
  };

  const openImageGallery = (business: Business, reviewIndex: number, imageIndex: number) => {
    // Handle image gallery opening logic here
    console.log('Opening image gallery for business:', business.name, 'review:', reviewIndex, 'image:', imageIndex);
  };

  return (
    <section className="py-6 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-cinzel text-xl font-bold text-neutral-900">
              Explore new businesses
            </h2>
          </div>
          
          <button
            onClick={handleRefresh}
            className="p-2 rounded-full hover:bg-neutral-100 transition-all duration-300 group"
          >
            <RefreshCw className={`h-5 w-5 text-neutral-400 ${loading ? 'animate-spin' : 'group-hover:rotate-90'} transition-transform duration-300`} />
          </button>
        </div>

        {/* Platform Business Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            // Loading skeletons - create an array of 6 items
            [...Array(6)].map((_, index) => (
              <div key={index} className="bg-neutral-100 rounded-xl h-[480px] animate-pulse"></div>
            ))
          ) : (
            // Actual business cards
            businesses.map((business) => {
              // Use businessIndex to create unique state for each card
              const currentReviewIndex = currentReviewIndices[business.id] || 0;
              const sentimentRating = getSentimentRating(business.rating.sentimentScore);

              return (
                <div key={business.id} className="relative rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col min-h-[480px]">
                  {/* Main Image with Overlay */}
                  <div 
                    className="relative h-60 flex-shrink-0 cursor-pointer"
                    onClick={(e) => {e.stopPropagation(); openBusinessProfile(business);}}
                  >
                    <img 
                      src={business.image} 
                      alt={business.name} 
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Open/Closed Tag */}
                    <div className="absolute top-3 right-3 z-10">
                      <div className={`px-3 py-1 rounded-full text-white text-sm font-poppins font-semibold ${
                        business.isOpen ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {business.isOpen ? 'Open' : 'Closed'}
                      </div>
                    </div>
                    
                    {/* Favorite Button - Bottom Right */}
                    {currentUser && (
                      <div className="absolute bottom-3 right-3 z-10">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleFavoritePlatformBusiness(business);
                          }}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 group"
                          title="Add to favorites"
                        >
                          <Icons.Heart className="h-4 w-4 text-neutral-600 group-hover:text-red-500 group-hover:fill-current transition-all duration-200" />
                        </button>
                      </div>
                    )}
                    
                    {/* Dark Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-80"></div>
                    
                    {/* Business Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                      <h3 
                        className="font-poppins text-lg font-bold mb-1 text-shadow line-clamp-1 cursor-pointer"
                        onClick={(e) => {e.stopPropagation(); openBusinessProfile(business);}}
                      >
                        {business.name}
                      </h3>
                      
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          <span className="font-lora text-xs">{business.hours || 'Hours unavailable'}</span>
                          {business.distance && (
                            <span className="font-lora text-xs ml-2">• {business.distance.toFixed(1)} mi • 10 min</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Badges positioned at bottom-left */}
                      <div className="flex items-center gap-2">
                        {/* Semantic Similarity Score - Only show if available and > 0 */}
                        {business.similarity && business.similarity > 0 && (
                          <div className="bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-poppins font-semibold">
                            {getMatchPercentage(business.similarity)}% match
                          </div>
                        )}
                        
                        <div className={`${sentimentRating.color} text-white px-3 py-1 rounded-full text-xs font-poppins font-semibold flex items-center shadow-md`}>
                          <ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                          <span className="mr-1">{business.rating?.thumbsUp || 0}</span> 
                          <span className="mr-1">{business.rating?.thumbsDown ? `/${business.rating.thumbsDown}` : ''}</span>
                          <span>{sentimentRating.text}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                   
                  {/* Reviews Section */}
                  <div className="bg-white p-3 border-t border-neutral-100 flex-grow flex flex-col">
                    {/* Review Images - Only show if available */}
                    {business.reviews && business.reviews[currentReviewIndex]?.images && business.reviews[currentReviewIndex].images.length > 0 && (
                      <div className="flex gap-1 mb-2">
                        {business.reviews[currentReviewIndex].images.slice(0, 3).map((image, index) => (
                          <img 
                            key={index}
                            src={image.url} 
                            alt={image.alt || `Review image ${index + 1}`}
                            className="w-[32%] aspect-square object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              openImageGallery(business, currentReviewIndex, index);
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    <div className="bg-neutral-50 rounded-lg p-3 flex-grow">
                      {business.reviews && business.reviews.length > 0 ? (
                        <div className="flex justify-between h-full">
                          <div 
                            className="flex-1 pr-2 cursor-pointer" 
                            onClick={(e) => {e.stopPropagation(); openBusinessProfile(business);}}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center">
                               <ThumbsUp className={`h-3 w-3 mr-1 flex-shrink-0 ${business.reviews[currentReviewIndex]?.thumbsUp ? 'text-green-500 fill-current' : 'text-neutral-400'}`} />
                                <span className="font-poppins text-xs font-semibold text-neutral-700">Review</span>
                              </div>
                              <span className="font-poppins text-xs text-neutral-500">
                                {currentReviewIndex + 1} of {business.reviews.length}
                              </span>
                            </div>
                            
                            <p className="font-lora text-sm text-neutral-700 mb-1 line-clamp-2">
                             "{business.reviews[currentReviewIndex]?.text || 'No review text available'}" 
                            </p>
                            
                            <div className="flex items-center justify-between mt-auto">
                              <div className="flex items-center">
                                <div className="w-6 h-6 rounded-full overflow-hidden mr-2 flex-shrink-0">
                                  <img 
                                    src={business.reviews[currentReviewIndex]?.authorImage || "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100"} 
                                    alt={business.reviews[currentReviewIndex]?.author || 'Anonymous'} 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <p 
                                  className="font-poppins text-xs text-neutral-500"
                                >
                                  {business.reviews[currentReviewIndex]?.author || 'Anonymous'}
                                </p>
                              </div>
                              
                              {business.reviews.length > 1 && (
                                <div className="flex space-x-2">
                                 <button onClick={() => prevReview(business.id)} className="text-neutral-400 hover:text-neutral-600 text-xs">←</button>
                                 <button onClick={() => nextReview(business.id)} className="text-neutral-400 hover:text-neutral-600 text-xs">→</button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-shrink-0 self-end">
                            <button
                              onClick={(e) => {e.stopPropagation(); handleTakeMeThere(business);}}
                              className="w-10 h-10 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                              aria-label="Take me there"
                            >
                              GO
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between h-full" onClick={(e) => {e.stopPropagation(); openReviewModal(business);}}>
                          <p className="font-lora text-sm text-neutral-500 text-center py-4 flex-1 cursor-pointer">No reviews available</p>
                          <div className="flex-shrink-0 self-end">
                            <button
                              onClick={(e) => {e.stopPropagation(); handleTakeMeThere(business);}}
                              className="w-10 h-10 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                              aria-label="Take me there"
                            >
                              GO
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Business Profile Modal */}
      {selectedBusinessForProfile && (
        <BusinessProfileModal
          isOpen={businessProfileOpen}
          onClose={() => setBusinessProfileOpen(false)}
          business={{
            id: selectedBusinessForProfile.id,
            name: selectedBusinessForProfile.name,
            category: selectedBusinessForProfile.category || selectedBusinessForProfile.tags?.[0],
            description: selectedBusinessForProfile.description,
            short_description: selectedBusinessForProfile.short_description,
            address: selectedBusinessForProfile.address,
            location: selectedBusinessForProfile.address || selectedBusinessForProfile.location,
            image_url: selectedBusinessForProfile.image,
            gallery_urls: selectedBusinessForProfile.gallery_urls || [],
            hours: selectedBusinessForProfile.hours,
            days_closed: selectedBusinessForProfile.days_closed,
            phone_number: selectedBusinessForProfile.phone_number,
            website_url: selectedBusinessForProfile.website_url,
            social_media: selectedBusinessForProfile.social_media,
            price_range: selectedBusinessForProfile.price_range,
            service_area: selectedBusinessForProfile.service_area,
            tags: selectedBusinessForProfile.tags,
            is_verified: selectedBusinessForProfile.isPlatformBusiness,
            thumbs_up: selectedBusinessForProfile.rating?.thumbsUp,
            thumbs_down: selectedBusinessForProfile.rating?.thumbsDown,
            sentiment_score: selectedBusinessForProfile.rating?.sentimentScore,
            isOpen: selectedBusinessForProfile.isOpen,
            owner_user_id: selectedBusinessForProfile.owner_user_id,
            latitude: selectedBusinessForProfile.latitude,
            longitude: selectedBusinessForProfile.longitude,
            created_at: selectedBusinessForProfile.created_at,
            updated_at: selectedBusinessForProfile.updated_at
          }}
        />
      )}
      
      {/* Leave Review Modal */}
      {selectedBusinessForReview && (
        <LeaveReviewModal
          isOpen={leaveReviewModalOpen}
          onClose={() => setLeaveReviewModalOpen(false)}
          business={{
            id: selectedBusinessForReview.id,
            name: selectedBusinessForReview.name,
            image_url: selectedBusinessForReview.image,
            address: selectedBusinessForReview.address
          }}
          visitDate={new Date().toISOString().split('T')[0]}
          onSubmit={handleReviewSubmit}
        />
      )}
    </section>
  );
};

export default ExploreArea;