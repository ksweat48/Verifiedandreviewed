import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Sparkles, Loader2, X, ChevronLeft, ChevronRight, ThumbsUp, Navigation, Heart, Clock } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../hooks/useGeolocation';
import { CreditService } from '../services/creditService';
import { UserService } from '../services/userService';
import { BusinessService } from '../services/businessService';
import { ActivityService } from '../services/activityService';
import { useAuth } from '../hooks/useAuth';
import SignupPrompt from './SignupPrompt';
import BusinessProfileModal from './BusinessProfileModal';
import LeaveReviewModal from './LeaveReviewModal';
import ReviewerProfile from './ReviewerProfile';
import ImageGalleryPopup from './ImageGalleryPopup';
import PlatformBusinessCard from './PlatformBusinessCard';
import CreditInfoTooltip from './CreditInfoTooltip';
import { SemanticSearchService } from '../services/semanticSearchService';
import { getMatchPercentage } from '../utils/similarityUtils';

interface ReviewImage {
  url: string;
  alt?: string;
}

interface Business {
  id: string;
  name: string;
  category?: string;
  description?: string;
  short_description?: string;
  address: string;
  location?: string;
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
  is_virtual?: boolean;
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
  tags: string[];
  distance?: number;
  duration?: number;
  similarity?: number;
  isExactMatch?: boolean;
}

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Business[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);
  const [leaveReviewModalOpen, setLeaveReviewModalOpen] = useState(false);
  const [selectedBusinessForReview, setSelectedBusinessForReview] = useState<Business | null>(null);
  const [reviewerProfileOpen, setReviewerProfileOpen] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<any>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ReviewImage[]>([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [backToastVisible, setBackToastVisible] = useState(false);
  const [offeringSearchAvailable, setOfferingSearchAvailable] = useState(false);
  
  const { latitude, longitude, error: locationError } = useGeolocation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if offering search is available
  useEffect(() => {
    const checkOfferingSearch = async () => {
      try {
        const available = await SemanticSearchService.isOfferingSearchAvailable();
        setOfferingSearchAvailable(available);
      } catch (error) {
        console.error('Error checking offering search availability:', error);
        setOfferingSearchAvailable(false);
      }
    };
    
    checkOfferingSearch();
  }, []);

  // Swipe handlers for mobile navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => nextCard(),
    onSwipedRight: () => prevCard(),
    trackMouse: false,
    preventScrollOnSwipe: true,
    delta: 50
  });

  // Handle back gesture in app mode
  useEffect(() => {
    if (isAppModeActive) {
      const handlePopState = (event: PopStateEvent) => {
        event.preventDefault();
        setIsAppModeActive(false);
        setHasSearched(false);
        setSearchResults([]);
        setCurrentCardIndex(0);
        setSearchQuery('');
        
        // Show back toast
        setBackToastVisible(true);
        setTimeout(() => setBackToastVisible(false), 2000);
      };

      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isAppModeActive, setIsAppModeActive]);

  const nextCard = () => {
    if (searchResults.length > 0) {
      setCurrentCardIndex((prev) => (prev + 1) % searchResults.length);
    }
  };

  const prevCard = () => {
    if (searchResults.length > 0) {
      setCurrentCardIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    // Check if user has enough credits
    if (currentUser) {
      const hasEnoughCredits = await CreditService.hasEnoughCreditsForSearch(currentUser.id, 'semantic');
      if (!hasEnoughCredits) {
        alert('You need 2 credits to search. Please purchase more credits or earn them by leaving reviews.');
        return;
      }
    }
    
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setIsAppModeActive(true);
    
    try {
      // Log search activity
      if (currentUser) {
        await ActivityService.logSearch(currentUser.id, searchQuery.trim(), 'semantic');
      }

      let results: Business[] = [];

      // Try offering search first if available
      if (offeringSearchAvailable) {
        try {
          console.log('🔍 Searching offerings for:', searchQuery);
          const offeringResults = await SemanticSearchService.searchOfferingsByVibe(
            searchQuery.trim(),
            latitude,
            longitude
          );
          
          if (offeringResults && offeringResults.length > 0) {
            // Transform offering results to Business format
            results = offeringResults.map(offering => ({
              id: offering.businessId,
              name: offering.businessName,
              category: offering.offeringType,
              description: offering.offeringDescription,
              short_description: offering.offeringTitle,
              address: offering.businessAddress || '',
              location: offering.businessAddress || '',
              image: offering.offeringImageUrl,
              gallery_urls: [],
              hours: 'Hours not available',
              rating: {
                thumbsUp: 0,
                thumbsDown: 0,
                sentimentScore: 0
              },
              isOpen: offering.isOpen !== false,
              reviews: [],
              isPlatformBusiness: true,
              tags: [],
              distance: offering.distance,
              duration: offering.duration,
              similarity: offering.similarity
            }));
            console.log('✅ Found', results.length, 'offering results');
          }
        } catch (offeringError) {
          console.error('Offering search failed:', offeringError);
        }
      }

      // Fallback to business search if no offering results
      if (results.length === 0) {
        try {
          console.log('🔍 Falling back to business search for:', searchQuery);
          const businessResults = await SemanticSearchService.searchBusinessesByVibe(
            searchQuery.trim(),
            latitude,
            longitude
          );
          
          if (businessResults && businessResults.length > 0) {
            results = businessResults;
            console.log('✅ Found', results.length, 'business results');
          }
        } catch (businessError) {
          console.error('Business search failed:', businessError);
          throw businessError;
        }
      }

      // Deduct credits after successful search
      if (currentUser && results.length > 0) {
        await CreditService.deductSearchCredits(currentUser.id, 'semantic');
      }

      setSearchResults(results);
      setCurrentCardIndex(0);
      
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError('Search failed. Please try again.');
      setSearchResults([]);
      setIsAppModeActive(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTakeMeThere = (business: Business) => {
    console.log('🗺️ Taking user to business:', business.name);
    
    // Record business visit if user is logged in
    if (currentUser) {
      BusinessService.recordBusinessVisit(business.id, currentUser.id);
    }
    
    let mapsUrl;
    if (business.latitude && business.longitude) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
    } else if (business.address) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name)}`;
    }
    
    window.open(mapsUrl, '_blank');
  };

  const handleRecommend = async (business: Business) => {
    if (!currentUser) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      const success = await BusinessService.saveAIRecommendation(business, currentUser.id);
      if (success) {
        alert(`${business.name} has been added to your favorites!`);
      } else {
        alert('Failed to add to favorites. Please try again.');
      }
    } catch (error) {
      console.error('Error adding to favorites:', error);
      alert('Failed to add to favorites. Please try again.');
    }
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
    setLeaveReviewModalOpen(false);
    setSelectedBusinessForReview(null);
  };

  const openReviewerProfile = (business: Business, reviewIndex: number) => {
    if (!business.reviews || business.reviews.length === 0) return;
    
    const review = business.reviews[reviewIndex];
    const reviewer = {
      name: review.author,
      image: review.authorImage || "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100",
      level: Math.floor(Math.random() * 5) + 1,
      reviewCount: Math.floor(Math.random() * 50) + 1,
      joinDate: '2023-' + (Math.floor(Math.random() * 12) + 1) + '-' + (Math.floor(Math.random() * 28) + 1),
      bio: `Food enthusiast and travel blogger. I love discovering hidden gems and sharing honest reviews about my experiences.`,
      reviews: [{
        businessName: business.name,
        location: business.address,
        date: new Date().toLocaleDateString(),
        rating: review.thumbsUp ? 'thumbsUp' as const : 'thumbsDown' as const,
        text: review.text
      }]
    };
    
    setSelectedReviewer(reviewer);
    setReviewerProfileOpen(true);
  };

  const openImageGallery = (business: Business, reviewIndex: number, imageIndex: number = 0) => {
    if (!business.reviews || business.reviews[reviewIndex]?.images) return;
    
    setGalleryImages(business.reviews[reviewIndex].images || []);
    setGalleryInitialIndex(imageIndex);
    setGalleryOpen(true);
  };

  const handleAuthSuccess = (user: any) => {
    setShowSignupPrompt(false);
  };

  const handleCloseSignupPrompt = () => {
    setShowSignupPrompt(false);
  };

  const handleOpenAuthModal = (mode: 'login' | 'signup') => {
    const event = new CustomEvent('open-auth-modal', {
      detail: { mode }
    });
    document.dispatchEvent(event);
  };

  if (isAppModeActive && hasSearched) {
    return (
      <div className="fixed inset-0 bg-white z-40 overflow-hidden">
        {/* Fixed Search Bar */}
        <div className="search-bar-fixed bg-white p-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsAppModeActive(false);
                setHasSearched(false);
                setSearchResults([]);
                setCurrentCardIndex(0);
                setSearchQuery('');
              }}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors duration-200"
            >
              <X className="h-5 w-5 text-neutral-600" />
            </button>
            
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={offeringSearchAvailable 
                    ? "Try 'brown stew fish', 'custom birthday cake', or 'shoe repair'..."
                    : "Describe the vibe you're looking for..."
                  }
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={isSearching}
                />
              </div>
            </form>
            
            {currentUser && (
              <CreditInfoTooltip placement="bottom" />
            )}
          </div>
        </div>

        {/* Search Results */}
        <div className="pt-20 pb-4 h-full overflow-hidden">
          {isSearching ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-spin" />
                <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                  Finding perfect matches...
                </h3>
                <p className="font-lora text-neutral-600">
                  {offeringSearchAvailable 
                    ? "Searching for dishes, products, and services"
                    : "Using AI to find businesses that match your vibe"
                  }
                </p>
              </div>
            </div>
          ) : searchError ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="font-poppins text-lg font-semibold text-red-700 mb-2">
                  Search Error
                </h3>
                <p className="font-lora text-red-600 mb-4">
                  {searchError}
                </p>
                <button
                  onClick={() => {
                    setSearchError(null);
                    setHasSearched(false);
                  }}
                  className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center max-w-md">
                <Search className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                  No Results Found
                </h3>
                <p className="font-lora text-neutral-600">
                  {offeringSearchAvailable 
                    ? "We couldn't find any dishes, products, or services matching your search. Try different keywords."
                    : "We couldn't find any businesses matching your search. Try different keywords."
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Card Navigation */}
              <div className="flex-1 relative" {...swipeHandlers}>
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full max-w-sm">
                    <PlatformBusinessCard
                      business={searchResults[currentCardIndex]}
                      onRecommend={handleRecommend}
                      onTakeMeThere={handleTakeMeThere}
                    />
                  </div>
                </div>

                {/* Navigation Arrows */}
                {searchResults.length > 1 && (
                  <>
                    <button
                      onClick={prevCard}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white shadow-lg rounded-full p-3 hover:bg-neutral-50 transition-colors duration-200 z-10"
                    >
                      <ChevronLeft className="h-6 w-6 text-neutral-600" />
                    </button>
                    
                    <button
                      onClick={nextCard}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white shadow-lg rounded-full p-3 hover:bg-neutral-50 transition-colors duration-200 z-10"
                    >
                      <ChevronRight className="h-6 w-6 text-neutral-600" />
                    </button>
                  </>
                )}
              </div>

              {/* Card Counter */}
              {searchResults.length > 1 && (
                <div className="flex justify-center pb-4">
                  <div className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-full">
                    <span className="font-poppins text-sm">
                      {currentCardIndex + 1} of {searchResults.length}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Back Toast */}
        {backToastVisible && (
          <div className="back-toast">
            Returned to search
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <section className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-accent-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Hero Content */}
          <div className="mb-12">
            <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-white mb-6">
              Find Your Perfect
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400 block">
                {offeringSearchAvailable ? "Dish & Experience" : "Vibe Match"}
              </span>
            </h1>
            
            <p className="font-lora text-xl text-white/80 max-w-3xl mx-auto mb-8">
              {offeringSearchAvailable 
                ? "Search for specific dishes, services, and products using natural language. Find exactly what you're craving."
                : "Discover amazing businesses that match your vibe using AI-powered search."
              }
            </p>

            {/* Location Status */}
            {latitude && longitude && (
              <div className="flex items-center justify-center text-white/60 mb-8">
                <MapPin className="h-4 w-4 mr-2" />
                <span className="font-lora text-sm">
                  Searching near your location
                </span>
              </div>
            )}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-neutral-400" />
              </div>
              
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={offeringSearchAvailable 
                  ? "Try 'brown stew fish', 'custom birthday cake', or 'shoe repair'..."
                  : "Describe the vibe you're looking for..."
                }
                className="w-full pl-16 pr-32 py-6 text-lg font-lora border-2 border-white/20 rounded-2xl focus:border-primary-400 focus:ring-0 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 shadow-2xl"
                disabled={isSearching}
              />
              
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="absolute inset-y-0 right-0 mr-2 px-8 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Credit Info */}
          {currentUser && (
            <div className="mt-6 flex items-center justify-center text-white/70">
              <Sparkles className="h-4 w-4 mr-2" />
              <span className="font-lora text-sm">
                2 credits per search • You have {currentUser.credits || 0} credits
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
          onSignup={() => handleOpenAuthModal('signup')}
          onLogin={() => handleOpenAuthModal('login')}
          onClose={handleCloseSignupPrompt}
          title="Save Your Favorites"
          message="Create an account to save AI-generated businesses to your favorites."
          signupButtonText="Sign Up Free For 200 Credits"
          loginButtonText="Already have an account? Log in"
        />
      )}

      {/* Business Profile Modal */}
      {selectedBusinessForProfile && (
        <BusinessProfileModal
          isOpen={businessProfileOpen}
          onClose={() => setBusinessProfileOpen(false)}
          business={{
            id: selectedBusinessForProfile.id,
            name: selectedBusinessForProfile.name,
            category: selectedBusinessForProfile.category,
            description: selectedBusinessForProfile.description,
            short_description: selectedBusinessForProfile.short_description,
            address: selectedBusinessForProfile.address,
            location: selectedBusinessForProfile.location || selectedBusinessForProfile.address,
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
            updated_at: selectedBusinessForProfile.updated_at,
            is_mobile_business: selectedBusinessForProfile.is_mobile_business,
            is_virtual: selectedBusinessForProfile.is_virtual
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
            image: selectedBusinessForReview.image,
            address: selectedBusinessForReview.address,
            visitDate: new Date().toISOString().split('T')
          }}
          onSubmitReview={handleReviewSubmit}
        />
      )}

      {/* Reviewer Profile Modal */}
      {reviewerProfileOpen && selectedReviewer && (
        <ReviewerProfile
          isOpen={reviewerProfileOpen}
          onClose={() => setReviewerProfileOpen(false)}
          reviewer={selectedReviewer}
        />
      )}

      {/* Image Gallery Popup */}
      <ImageGalleryPopup
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        images={galleryImages}
        initialIndex={galleryInitialIndex}
      />
    </>
  );
};

export default AISearchHero;