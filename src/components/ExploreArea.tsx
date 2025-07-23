import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BusinessProfileModal from './BusinessProfileModal';
import { BusinessService } from '../services/businessService';

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
  hours: string;
  isPlatformBusiness: boolean;
  tags: string[];
  distance?: number; // Added during processing
}

const ExploreArea = () => {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentReviewIndices, setCurrentReviewIndices] = useState<{ [key: string]: number }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);
  
  useEffect(() => {
    loadNearbyBusinesses();
  }, [refreshKey]);

  const loadNearbyBusinesses = async () => {
    setLoading(true);
    
    try {
      // Fetch real businesses from Supabase
      const realBusinesses = await BusinessService.getBusinesses({
        verified_only: false // Show all businesses, not just verified ones
      });
      
      // Transform the business data to match the expected format
      const transformedBusinesses = realBusinesses.map(business => ({
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
        image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
        isOpen: true, // Default to open since we don't have real-time status
        hours: business.hours || 'Hours unavailable',
        address: business.address || '',
        reviews: [], // We'll need to fetch reviews separately
        isPlatformBusiness: business.is_verified || false,
        tags: business.tags || []
      }));
      
      setBusinesses(transformedBusinesses.slice(0, 6));
    } catch (error) {
      console.error('Error loading businesses:', error);
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
    // Robust navigation URL construction with data validation
    let mapsUrl;
    if (business.latitude && business.longitude) {
      // Priority 1: Use coordinates (most reliable)
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
    } else if (business.address && typeof business.address === 'string' && business.address.trim().length > 0) {
      // Priority 2: Use valid address string
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address.trim())}`;
    } else if (business.name && typeof business.name === 'string' && business.name.trim().length > 0) {
      // Priority 3: Use business name as fallback
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name.trim())}`;
    } else {
      // Last resort: Generic search
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=business`;
    }
    
    console.log('🗺️ Opening Google Maps with URL:', mapsUrl);
    window.open(mapsUrl, '_blank');
  };

  const openBusinessProfile = (business: Business) => {
    setSelectedBusinessForProfile(business);
    setBusinessProfileOpen(true);
  };

  // Function to handle "Recommend" button click
  const handleRecommend = (business: Business) => {
    alert(`Thanks! We'll review ${business.name} for addition to our platform.`);
  };

  // Get sentiment rating text based on score
  const getSentimentRating = (score: number) => {
    if (score >= 80) return { text: 'Great', color: 'bg-green-500' };
    if (score >= 70 && score < 80) return { text: 'Good', color: 'bg-blue-500' };
    if (score >= 65) return { text: 'Fair', color: 'bg-yellow-500' };
    return { text: 'Improve', color: 'bg-red-500' };
  };

  return (
    <section className="py-6 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <Icons.RefreshCw className={`h-5 w-5 text-neutral-400 ${loading ? 'animate-spin' : 'group-hover:rotate-90'} transition-transform duration-300`} />
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
                          <Icons.Clock className="h-3 w-3 mr-1" />
                          <span className="font-lora text-xs">{business.hours || 'Hours unavailable'}</span>
                          {business.distance && (
                            <span className="font-lora text-xs ml-2">• {business.distance.toFixed(1)} mi • 10 min</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Combined Rating Badge */}
                      {/* Tags */}
                      <div className="flex flex-nowrap gap-1 items-center justify-between">
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
                        
                        {/* Combined Rating Badge */}
                        <div className={`${sentimentRating.color} text-white px-3 py-1 rounded-full text-xs font-poppins font-semibold flex items-center shadow-md ml-auto`}>
                          <Icons.ThumbsUp className="h-3 w-3 mr-1 fill-current" />
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
                               <Icons.ThumbsUp className={`h-3 w-3 mr-1 flex-shrink-0 ${business.reviews[currentReviewIndex]?.thumbsUp ? 'text-green-500 fill-current' : 'text-neutral-400'}`} />
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
    </section>
  );
};

export default ExploreArea;