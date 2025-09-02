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
      const offerings = await OfferingService.getExploreOfferings(10, latitude, longitude);
      
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
      
      // Filter by 10-mile radius if user location is available
      if (latitude && longitude) {
        const MAX_DISTANCE_MILES = 10;
        transformedBusinesses = transformedBusinesses.filter(business => {
          return typeof business.distance === 'number' && business.distance <= MAX_DISTANCE_MILES;
        });
        console.log(`📏 Businesses within ${MAX_DISTANCE_MILES} miles: ${transformedBusinesses.length}`);
      }
      
      // Randomly shuffle the filtered businesses
      for (let i = transformedBusinesses.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [transformedBusinesses[i], transformedBusinesses[j]] = [transformedBusinesses[j], transformedBusinesses[i]];
      }
      
      // Select the first 10 (or fewer if not enough available)
      const DISPLAY_COUNT = 10;
      transformedBusinesses = transformedBusinesses.slice(0, DISPLAY_COUNT);
      
      console.log(`🎲 Randomly selected ${transformedBusinesses.length} businesses for display`);
      
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
    }
  }
}