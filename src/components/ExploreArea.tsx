import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, ThumbsUp, MapPin, Navigation, Phone, Edit, Package } from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNavigate } from 'react-router-dom';
import BusinessProfileModal from './BusinessProfileModal';
import LeaveReviewModal from './LeaveReviewModal';
import { BusinessService } from '../services/businessService';
import { ReviewService } from '../services/reviewService';
import { OfferingService } from '../services/offeringService';
import { formatPrice, isBusinessOpen } from '../utils/displayUtils';
import OfferingReviewsModal from './OfferingReviewsModal';
import { showSuccess, showError } from '../utils/toast';

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
  const { latitude, longitude, error: locationError, loading: locationLoading } = useGeolocation();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentReviewIndices, setCurrentReviewIndices] = useState<{ [key: string]: number }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);
  const [leaveReviewModalOpen, setLeaveReviewModalOpen] = useState(false);
  const [selectedBusinessForReview, setSelectedBusinessForReview] = useState<Business | null>(null);
  const [isOfferingReviewsModalOpen, setIsOfferingReviewsModalOpen] = useState(false);
  const [selectedOfferingForReviews, setSelectedOfferingForReviews] = useState<{
    id: string;
    title: string;
    businessName: string;
  } | null>(null);
  const [offeringReviewCounts, setOfferingReviewCounts] = useState<Record<string, number>>({});
  
  useEffect(() => {
    // Only load businesses when we have geolocation data or when refreshing
    if (!locationLoading) {
      loadNearbyBusinesses();
    }
  }, [refreshKey, latitude, longitude, locationLoading]);

  const loadNearbyBusinesses = async () => {
    console.log('🔍 DEBUG: ExploreArea loadNearbyBusinesses called');
    console.log('🗺️ DEBUG: Geolocation data:', { 
      latitude, 
      longitude, 
      locationLoading, 
      locationError 
    });
    
    // Don't proceed if geolocation is still loading
    if (locationLoading) {
      console.log('⏳ DEBUG: Geolocation still loading, skipping business fetch');
      return;
    }
    
    setLoading(true);
    
    try {
      // Fetch platform offerings for explore section
      const offerings = await OfferingService.getExploreOfferings(6, latitude, longitude);
      
      console.log('📦 DEBUG: Received offerings from service:', offerings.length, 'items');
      console.log('📊 DEBUG: First offering data:', offerings[0]);
      console.log('🗺️ DEBUG: Distance values in offerings:', offerings.map(o => ({ 
        name: o.businesses?.name || o.name, 
        distance: o.distance,
        hasDistance: o.distance !== undefined && o.distance !== 999999
      })));
      
      let transformedBusinesses = [];
      
      if (offerings.length > 0) {
        transformedBusinesses = offerings.map(offering => {
          const business = offering.businesses;
          
          // Get primary image or fallback
          const primaryImage = offering.offering_images?.find(img => img.is_primary && img.approved);
          const fallbackImage = offering.offering_images?.find(img => img.approved);
          const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';
          
          return {
            id: business.id,
            name: business.name,
            category: business.category,
            description: business.description,
            short_description: business.short_description,
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
            distance: offering.distance, // Include distance from offering service
            rating: {
              thumbsUp: business.thumbs_up || 0,
              thumbsDown: business.thumbs_down || 0,
              sentimentScore: business.sentiment_score || 0
            },
            image: imageUrl,
            isOpen: isBusinessOpen(business), // Use actual business hours
            hours: business.hours || 'Hours unavailable',
            address: business.address || business.location || '',
            reviews: [], // Will be fetched separately if needed
            isPlatformBusiness: true, // All offerings are platform businesses
            tags: business.tags || [],
            // Add offering-specific data
            offeringId: offering.id,
            offeringTitle: offering.title,
            offeringDescription: offering.description,
            serviceType: offering.service_type,
            priceCents: offering.price_cents,
            currency: offering.currency,
            offering_images: offering.offering_images
          };
        });
        
        // Fetch review counts for all offerings
        const offeringIds = transformedBusinesses.map(b => b.offeringId).filter(Boolean);
        if (offeringIds.length > 0) {
          try {
            const reviewCounts: Record<string, number> = {};
            
            // Fetch reviews for all offerings concurrently
            const reviewPromises = offeringIds.map(async (offeringId) => {
              try {
                const reviews = await ReviewService.getReviewsForOffering(offeringId);
                reviewCounts[offeringId] = reviews.length;
              } catch (error) {
                console.error(`Error fetching reviews for offering ${offeringId}:`, error);
                reviewCounts[offeringId] = 0;
              }
            });
            
            await Promise.all(reviewPromises);
            setOfferingReviewCounts(reviewCounts);
          } catch (error) {
            console.error('Error fetching offering review counts:', error);
          }
        }
      }
      
      setBusinesses(transformedBusinesses);
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

  const handleOpenOfferingReviews = (offering: any, businessName: string) => {
    setSelectedOfferingForReviews({
      id: offering.offeringId,
      title: offering.offeringTitle,
      businessName: businessName
    });
    setIsOfferingReviewsModalOpen(true);
  };

  // Handle favoriting platform businesses
  const handleFavoritePlatformBusiness = async (business: Business, offeringId?: string) => {
    if (!currentUser) {
      // Dispatch custom event to open auth modal
      const event = new CustomEvent('open-auth-modal', {
        detail: { mode: 'signup' }
      });
      document.dispatchEvent(event);
      return;
    }

    try {
      let success = false;
      
      if (offeringId) {
        // Save platform offering to favorites
        success = await BusinessService.saveFavoritedOffering(offeringId, currentUser.id);
      } else {
        // Fallback to old method for businesses without offering ID
        const businessData = {
          name: business.name,
          address: business.address || business.location || 'Address not available',
          location: business.location || business.address || 'Location not available',
          category: business.category || 'Platform Business',
          description: business.description || business.short_description || `Platform business: ${business.name}`,
          image: business.image,
          shortDescription: business.short_description || business.description,
          rating: 5,
          hours: business.hours,
          isOpen: true,
          reviews: business.reviews || [],
          isPlatformBusiness: true,
          tags: business.tags || [],
          similarity: 0.9
        };

        success = await BusinessService.saveAIRecommendation(businessData, currentUser.id);
      }
      
      if (success) {
        const itemName = business.offeringTitle || business.name;
        alert(`${itemName} has been added to your favorites!`);
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
    <section className="bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <span className="font-lora text-sm text-neutral-600">
            Discover new businesses by offerings
          </span>
        </div>

        {/* Platform Offering Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            // Loading skeletons
            [...Array(6)].map((_, index) => (
              <div key={index} className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 animate-pulse">
                <div className="aspect-square mb-3 rounded-lg bg-neutral-200"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                  <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
                  <div className="h-3 bg-neutral-200 rounded w-full"></div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="h-6 bg-neutral-200 rounded w-16"></div>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 bg-neutral-200 rounded-lg"></div>
                      <div className="h-8 w-8 bg-neutral-200 rounded-lg"></div>
                      <div className="h-8 w-8 bg-neutral-200 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            // Actual offering cards
            businesses.map((offering) => {
              // 'offering' here is already the transformed business object from loadNearbyBusinesses
              const business = offering;
              
              // Get the primary image from offering_images (from original Supabase query), fallback to business image
              const primaryImage = offering.offering_images?.find(img => img.is_primary && img.approved);
              const fallbackImage = offering.offering_images?.find(img => img.approved);
              const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';

              return (
                <div key={offering.offeringId} className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 hover:shadow-sm transition-all duration-200">
                  {/* Offering Image */}
                  <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-neutral-100">
                    <img
                      src={imageUrl}
                      alt={offering.offeringTitle}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Open/Closed Overlay - Bottom Left */}
                    <div className="absolute bottom-2 left-2">
                      <div className={`px-2 py-1 rounded-full text-white text-xs font-poppins font-bold ${
                        business.isOpen ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {business.isOpen ? 'OPEN' : 'CLOSED'}
                      </div>
                    </div>
                    
                    {/* Rating Overlay - Bottom Right */}
                    <div className="absolute bottom-2 right-2">
                      <div className="px-2 py-1 rounded-full bg-neutral-500 text-white text-xs font-poppins font-bold flex items-center">
                        <span>No ratings</span>
                      </div>
                    </div>
                    
                    {/* Favorite Button - Top Right */}
                    {currentUser && (
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleFavoritePlatformBusiness(offering, offering.offeringId);
                          }}
                          className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-200 group"
                          title="Add to favorites"
                        >
                          <Icons.Heart className="h-3 w-3 text-neutral-600 group-hover:text-red-500 group-hover:fill-current transition-all duration-200" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Offering Details */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <h6 className="font-poppins font-bold text-black text-sm line-clamp-1 flex-1 mr-2">
                        {offering.offeringTitle}
                      </h6>
                      <span className="font-poppins font-bold text-primary-600 text-sm flex-shrink-0">
                        {formatPrice(offering.priceCents, offering.currency)}
                      </span>
                    </div>
                    
                    <p className="font-lora text-xs text-black font-bold line-clamp-1">
                      at {business.name}
                    </p>
                    
                    {offering.offeringDescription && (
                      <p className="font-lora text-xs text-neutral-600 line-clamp-2">
                        {offering.offeringDescription}
                      </p>
                    )}
                    
                    {/* Action Buttons - Phone, Reviews, Directions */}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      {business.phone_number && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${business.phone_number}`, '_self');
                          }}
                          className="p-2 bg-green-100 hover:bg-green-200 text-green-600 hover:text-green-700 rounded-lg transition-all duration-200 flex items-center justify-center"
                          title="Call business"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                      )}
                      
                      {/* Review Icon with Notification Badge */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOfferingReviews(offering, business.name);
                          }}
                          className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 hover:text-purple-700 rounded-lg transition-all duration-200 flex items-center justify-center"
                          title="View reviews"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        {/* Review Count Notification Badge */}
                        {offeringReviewCounts[offering.offeringId] > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                            {offeringReviewCounts[offering.offeringId]}
                          </span>
                        )}
                      </div>
                      
                      {business.address && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            let mapsUrl;
                            if (business.latitude && business.longitude) {
                              mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
                            } else {
                              mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
                            }
                            window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="px-2 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 rounded-lg transition-all duration-200 flex items-center justify-center gap-1"
                          title="Get directions"
                        >
                          {/* Distance Display - Left of Map Icon */}
                          {business.distance && business.distance !== 999999 && (
                            <span className="font-lora text-xs text-blue-700 font-medium">
                              {business.distance.toFixed(1)} mi
                            </span>
                          )}
                          <MapPin className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    {offering.tags && offering.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {offering.tags.slice(0, 2).map((tag, index) => (
                          <span key={index} className="bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full text-xs font-lora">
                            {tag}
                          </span>
                        ))}
                        {offering.tags.length > 2 && (
                          <span className="bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full text-xs font-lora">
                            +{offering.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
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
      
      {/* Offering Reviews Modal */}
      {selectedOfferingForReviews && (
        <OfferingReviewsModal
          isOpen={isOfferingReviewsModalOpen}
          onClose={() => {
            setIsOfferingReviewsModalOpen(false);
            setSelectedOfferingForReviews(null);
          }}
          offeringId={selectedOfferingForReviews.id}
          offeringTitle={selectedOfferingForReviews.title}
          businessName={selectedOfferingForReviews.businessName}
        />
      )}
    </section>
  );
};

export default ExploreArea;