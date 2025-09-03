import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, ThumbsUp, MapPin, Navigation, Phone, Edit, Package } from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNavigate } from 'react-router-dom';
import BusinessProfileModal from './BusinessProfileModal';
import LeaveReviewModal from './LeaveReviewModal';
import OfferingCard from './OfferingCard';
import { BusinessService } from '../services/businessService';
import { ReviewService } from '../services/reviewService';
import { OfferingService } from '../services/offeringService';
import { UserService } from '../services/userService';
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
      // Fetch optimized number of platform offerings for explore section
      const offerings = await OfferingService.getExploreOfferings(20, latitude, longitude);
      
      console.log('📦 DEBUG: Received offerings from service:', offerings.length, 'items');
      console.log('📊 DEBUG: First offering data:', offerings[0]);
      console.log('🗺️ DEBUG: Distance values in offerings:', offerings.map(o => ({ 
        name: o.businesses?.name || o.name, 
        distance: o.distance 
      })));
      
      if (offerings.length === 0) {
        console.log('📦 DEBUG: No offerings returned from service');
        setBusinesses([]);
        return;
      }
      
      // Transform offerings into business objects for the UI
      let transformedBusinesses = offerings.map(offering => {
        const business = offering.businesses;
        
        if (!business) {
          console.warn('⚠️ Offering missing business data:', offering);
          return null;
        }
        
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
          image: imageUrl, // Keep this for the offering card display
          image_url: business.image_url, // Business's main image for the modal
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
      }).filter(Boolean); // Remove null entries
      
      // Add preferred radius flag for sorting
      if (latitude && longitude) {
        const PREFERRED_RADIUS_MILES = 10;
        transformedBusinesses = transformedBusinesses.map(business => {
          const distance = business.distance || 999999;
          return {
            ...business,
            isWithinPreferredRadius: distance <= PREFERRED_RADIUS_MILES
          };
        });
        
        // Sort by preferred radius first, then by distance
        transformedBusinesses.sort((a, b) => {
          // Primary sort: preferred radius (within 10 miles first)
          if (a.isWithinPreferredRadius !== b.isWithinPreferredRadius) {
            return b.isWithinPreferredRadius ? 1 : -1;
          }
          
          // Secondary sort: distance (closer first)
          const aDistance = a.distance || 999999;
          const bDistance = b.distance || 999999;
          return aDistance - bDistance;
        });
        
        const withinRadius = transformedBusinesses.filter(b => b.isWithinPreferredRadius).length;
        console.log(`📏 Prioritized offerings: ${withinRadius} within ${PREFERRED_RADIUS_MILES} miles, ${transformedBusinesses.length - withinRadius} beyond radius`);
      } else {
        // No user location - just sort by creation date for variety
        transformedBusinesses.sort(() => Math.random() - 0.5);
      }
      
      // Randomly shuffle the filtered businesses
      // Remove random shuffling since we now have distance-based sorting
      
      // Select the first 10 (or fewer if not enough available)
      const DISPLAY_COUNT = 10;
      transformedBusinesses = transformedBusinesses.slice(0, DISPLAY_COUNT);
      
      console.log(`🎯 Selected ${transformedBusinesses.length} businesses for display (prioritized by distance)`);
      
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
      console.error('🗺️ DEBUG: No valid location data found for business');
      showError('Unable to get directions - no location data available');
      return;
    }
    
    console.log('🗺️ DEBUG: Final maps URL:', mapsUrl);
    window.open(mapsUrl, '_blank');
  };

  const handleRecommendBusiness = async (business: Business, offeringId?: string) => {
    if (!currentUser) {
      // Show signup prompt for unauthenticated users
      return;
    }

    try {
      let success = false;
      
      if (offeringId && business.isPlatformBusiness) {
        // Save platform offering to favorites
        success = await BusinessService.saveFavoritedOffering(offeringId, currentUser.id);
      } else if (business.isAIGenerated) {
        // Save AI business to favorites
        const { error } = await supabase
          .from('business_recommendations')
          .insert({
            name: business.name,
            address: business.address || business.location || 'Address not available',
            location: business.location || business.address || 'Location not available',
            category: business.category || 'AI Generated',
            description: `AI-generated business. ${business.description || business.short_description || ''}`,
            image_url: business.image || '/verified and reviewed logo-coral copy copy.png',
            recommended_by: currentUser.id,
            status: 'pending',
            created_at: new Date().toISOString()
          });
        
        success = !error;
      }
      
      if (success) {
        const itemName = business.offeringTitle || business.name;
        showSuccess(`${itemName} has been saved to your favorites!`);
      } else {
        showError('Failed to save to favorites. Please try again.');
      }
    } catch (error) {
      console.error('Error saving to favorites:', error);
      showError('Failed to save to favorites. Please try again.');
    }
  };

  const handleOpenOfferingReviews = (business: Business) => {
    // Only open for platform businesses with offering IDs
    if (business.isPlatformBusiness && (business.offeringId || business.id)) {
      setSelectedOfferingForReviews({
        id: business.offeringId || business.id,
        title: business.offeringTitle || business.name,
        businessName: business.name
      });
      setIsOfferingReviewsModalOpen(true);
    }
  };

  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="h-8 w-48 bg-neutral-200 rounded mx-auto mb-4 animate-pulse"></div>
            <div className="h-4 w-64 bg-neutral-200 rounded mx-auto animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200 animate-pulse">
                <div className="aspect-square bg-neutral-200 rounded-lg mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                  <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
                  <div className="h-3 bg-neutral-200 rounded w-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <div className="text-center w-full">
            <h2 className="font-cinzel text-xl font-bold text-neutral-900 mb-1">
              Discover local businesses by the menu
            </h2>
          </div>
        </div>

        {businesses.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="h-10 w-10 text-neutral-400" />
            </div>
            <h3 className="font-poppins text-xl font-semibold text-neutral-700 mb-2">
              No offerings found
            </h3>
            <p className="font-lora text-neutral-600 mb-6">
              {locationError 
                ? 'Unable to get your location. Please enable location services to see nearby offerings.'
                : 'No local offerings available at the moment. Try refreshing or check back later.'
              }
            </p>
            <button
              onClick={handleRefresh}
              className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {businesses.map((business) => (
              <OfferingCard
                key={business.id}
                business={business}
                onRecommend={handleRecommendBusiness}
                onTakeMeThere={handleTakeMeThere}
                onOpenOfferingReviews={handleOpenOfferingReviews}
                offeringReviewCounts={offeringReviewCounts}
              />
            ))}
          </div>
        )}
      </div>

      {/* Business Profile Modal */}
      <BusinessProfileModal
        isOpen={businessProfileOpen}
        onClose={() => setBusinessProfileOpen(false)}
        business={selectedBusinessForProfile}
      />

      {/* Leave Review Modal */}
      <LeaveReviewModal
        isOpen={leaveReviewModalOpen}
        onClose={() => setLeaveReviewModalOpen(false)}
        business={selectedBusinessForReview}
        onSubmitReview={() => {}}
      />

      {/* Offering Reviews Modal */}
      <OfferingReviewsModal
        isOpen={isOfferingReviewsModalOpen}
        onClose={() => {
          setIsOfferingReviewsModalOpen(false);
          setSelectedOfferingForReviews(null);
        }}
        offeringId={selectedOfferingForReviews?.id || ''}
        offeringTitle={selectedOfferingForReviews?.title || ''}
        businessName={selectedOfferingForReviews?.businessName || ''}
      />
    </section>
  );
};

export default ExploreArea;