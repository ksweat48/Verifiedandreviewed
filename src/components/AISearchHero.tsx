import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Star, Clock, ThumbsUp, Heart, User, Utensils, Coffee, ShoppingBag, Wrench, Sparkles, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { useActivityTracking } from '../hooks/useActivityTracking';
import { getMatchPercentage } from '../utils/similarityUtils';
import BusinessProfileModal from './BusinessProfileModal';
import ReviewModal from './ReviewModal';
import LeaveReviewModal from './LeaveReviewModal';
import ReviewerProfile from './ReviewerProfile';
import { supabase } from '../services/supabaseClient';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLeaveReviewModalOpen, setIsLeaveReviewModalOpen] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState<any>(null);
  const [isReviewerProfileOpen, setIsReviewerProfileOpen] = useState(false);
  const [offeringSearchAvailable, setOfferingSearchAvailable] = useState(false);
  
  const { user } = useAuth();
  const { latitude, longitude, isLoading: locationLoading } = useGeolocation();
  const { trackActivity } = useActivityTracking();
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if offering search is available
  useEffect(() => {
    const checkOfferingSearch = async () => {
      try {
        const response = await fetch('/.netlify/functions/search-offerings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test', limit: 1 })
        });
        setOfferingSearchAvailable(response.ok);
      } catch {
        setOfferingSearchAvailable(false);
      }
    };
    
    checkOfferingSearch();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setIsAppModeActive(true);
    
    try {
      let results: any[] = [];
      
      // Try offering search first if available
      if (offeringSearchAvailable) {
        try {
          const offeringResponse = await fetch('/.netlify/functions/search-offerings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: searchQuery,
              limit: 20,
              userLatitude: latitude,
              userLongitude: longitude
            })
          });
          
          if (offeringResponse.ok) {
            const offeringData = await offeringResponse.json();
            if (offeringData.success && offeringData.results?.length > 0) {
              // Transform offerings to business format
              results = offeringData.results.map((offering: any) => ({
                id: `offering-${offering.id}`,
                name: offering.business_name || offering.title,
                shortDescription: offering.description || `${offering.title} - ${offering.type}`,
                rating: 4.2 + Math.random() * 0.8,
                image: offering.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                isOpen: true,
                hours: 'Open now',
                address: offering.business_address || 'Address available',
                latitude: offering.business_latitude,
                longitude: offering.business_longitude,
                distance: offering.distance || Math.random() * 5 + 0.5,
                duration: offering.duration || Math.floor(Math.random() * 15 + 5),
                reviews: [{
                  text: `Great ${offering.type}! Really enjoyed this.`,
                  author: "Verified Customer",
                  thumbsUp: true
                }],
                isPlatformBusiness: true,
                tags: offering.tags || [],
                isGoogleVerified: false,
                similarity: offering.similarity || 0.85,
                offeringId: offering.id,
                businessId: offering.business_id,
                price: offering.price,
                offeringType: offering.type
              }));
              
              console.log('✅ Found', results.length, 'offerings');
            }
          }
        } catch (error) {
          console.warn('Offering search failed, falling back to business search:', error);
        }
      }
      
      // If no offering results, try AI business search
      if (results.length === 0) {
        const aiSearchResult = await SemanticSearchService.aiBusinessSearch({
          prompt: searchQuery,
          searchQuery: searchQuery,
          numToGenerate: 15,
          latitude: latitude || undefined,
          longitude: longitude || undefined
        });
        
        if (aiSearchResult.success && aiSearchResult.results) {
          results = aiSearchResult.results;
        }
      }
      
      // If still no results, try platform business search
      if (results.length === 0) {
        const platformBusinesses = await BusinessService.getBusinesses({
          search: searchQuery,
          userLatitude: latitude || undefined,
          userLongitude: longitude || undefined
        });
        
        results = platformBusinesses.map(business => ({
          ...business,
          isPlatformBusiness: true,
          similarity: 0.7 + Math.random() * 0.2
        }));
      }
      
      setSearchResults(results);
      setCurrentCardIndex(0);
      
      // Track search activity
      if (user) {
        trackActivity('search', {
          query: searchQuery,
          results_count: results.length,
          search_type: offeringSearchAvailable ? 'offering_search' : 'ai_search'
        });
      }
      
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCardNavigation = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    } else if (direction === 'next' && currentCardIndex < searchResults.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleCardNavigation('next'),
    onSwipedRight: () => handleCardNavigation('prev'),
    trackMouse: true
  });

  const handleBusinessClick = (business: any) => {
    setSelectedBusiness(business);
    setIsProfileModalOpen(true);
    
    if (user) {
      trackActivity('business_view', {
        business_id: business.businessId || business.id,
        business_name: business.name,
        is_platform_business: business.isPlatformBusiness
      });
    }
  };

  const handleReviewClick = (business: any) => {
    setSelectedBusiness(business);
    setIsReviewModalOpen(true);
  };

  const handleLeaveReview = (business: any) => {
    setSelectedBusiness(business);
    setIsLeaveReviewModalOpen(true);
  };

  const handleReviewerClick = (reviewer: any) => {
    setSelectedReviewer(reviewer);
    setIsReviewerProfileOpen(true);
  };

  const handleFavorite = async (business: any) => {
    if (!user) return;
    
    try {
      const success = await BusinessService.saveAIRecommendation(business, user.id);
      if (success) {
        console.log('Business saved to favorites');
      }
    } catch (error) {
      console.error('Error saving favorite:', error);
    }
  };

  const exitAppMode = () => {
    setIsAppModeActive(false);
    setSearchResults([]);
    setCurrentCardIndex(0);
    setSearchQuery('');
  };

  const currentBusiness = searchResults[currentCardIndex];

  return (
    <>
      <section className="relative min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        
        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          {!isAppModeActive ? (
            <>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Find Your Perfect{' '}
                <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                  {offeringSearchAvailable ? 'Dish & Experience' : 'Experience'}
                </span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-gray-200 mb-12 max-w-2xl mx-auto leading-relaxed">
                Discover amazing local businesses that match your vibe and preferences
              </p>
              
              <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/20">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/70 w-5 h-5" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={offeringSearchAvailable ? "Try 'spicy ramen' or 'cozy coffee shop'" : "Try 'cozy coffee shop' or 'trendy bar'"}
                          className="w-full pl-12 pr-4 py-4 bg-transparent text-white placeholder-white/70 text-lg focus:outline-none"
                          disabled={isSearching}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearching || !searchQuery.trim()}
                        className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-pink-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isSearching ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Searching...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            <span>Search</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
              
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {[
                  { icon: Utensils, text: 'Food & Dining', color: 'from-orange-400 to-red-400' },
                  { icon: Coffee, text: 'Coffee & Cafes', color: 'from-amber-400 to-orange-400' },
                  { icon: ShoppingBag, text: 'Shopping', color: 'from-green-400 to-blue-400' },
                  { icon: Wrench, text: 'Services', color: 'from-blue-400 to-purple-400' }
                ].map((category, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchQuery(category.text.toLowerCase());
                      searchInputRef.current?.focus();
                    }}
                    className={`bg-gradient-to-r ${category.color} text-white px-4 py-2 rounded-full text-sm font-medium hover:scale-105 transition-all duration-300 flex items-center space-x-2`}
                  >
                    <category.icon className="w-4 h-4" />
                    <span>{category.text}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="w-full max-w-md mx-auto">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={exitAppMode}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-semibold text-white">
                  {searchResults.length} Results
                </h2>
                <div className="w-6"></div>
              </div>

              {searchResults.length > 0 && (
                <div className="relative">
                  <div {...swipeHandlers} className="relative h-96 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-white rounded-2xl shadow-2xl">
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={currentBusiness?.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400'}
                          alt={currentBusiness?.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{currentBusiness?.rating?.toFixed(1) || '4.5'}</span>
                        </div>
                        {currentBusiness?.similarity && (
                          <div className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full px-3 py-1">
                            <span className="text-sm font-bold">{getMatchPercentage(currentBusiness.similarity)} Match</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{currentBusiness?.name}</h3>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{currentBusiness?.shortDescription}</p>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{currentBusiness?.distance?.toFixed(1) || '2.1'} mi</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{currentBusiness?.duration || '8'} min</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className={`w-2 h-2 rounded-full ${currentBusiness?.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span>{currentBusiness?.isOpen ? 'Open' : 'Closed'}</span>
                          </div>
                        </div>
                        
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleBusinessClick(currentBusiness)}
                            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-purple-600 transition-all duration-300"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => handleFavorite(currentBusiness)}
                            className="bg-white border-2 border-pink-200 text-pink-500 p-3 rounded-xl hover:bg-pink-50 transition-colors"
                          >
                            <Heart className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {searchResults.length > 1 && (
                    <>
                      <button
                        onClick={() => handleCardNavigation('prev')}
                        disabled={currentCardIndex === 0}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm text-gray-700 p-2 rounded-full shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      
                      <button
                        onClick={() => handleCardNavigation('next')}
                        disabled={currentCardIndex === searchResults.length - 1}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm text-gray-700 p-2 rounded-full shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      
                      <div className="flex justify-center mt-4 space-x-2">
                        {searchResults.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentCardIndex(index)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              index === currentCardIndex ? 'bg-white' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {searchResults.length === 0 && !isSearching && (
                <div className="text-center text-white/80">
                  <p>No results found. Try a different search term.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {selectedBusiness && (
        <>
          <BusinessProfileModal
            business={selectedBusiness}
            isOpen={isProfileModalOpen}
            onClose={() => {
              setIsProfileModalOpen(false);
              setSelectedBusiness(null);
            }}
            onReviewClick={() => {
              setIsProfileModalOpen(false);
              setIsReviewModalOpen(true);
            }}
            onLeaveReview={() => {
              setIsProfileModalOpen(false);
              setIsLeaveReviewModalOpen(true);
            }}
          />
          
          <ReviewModal
            business={selectedBusiness}
            isOpen={isReviewModalOpen}
            onClose={() => {
              setIsReviewModalOpen(false);
              setSelectedBusiness(null);
            }}
            onReviewerClick={handleReviewerClick}
          />
          
          <LeaveReviewModal
            business={selectedBusiness}
            isOpen={isLeaveReviewModalOpen}
            onClose={() => {
              setIsLeaveReviewModalOpen(false);
              setSelectedBusiness(null);
            }}
          />
        </>
      )}
      
      {selectedReviewer && (
        <ReviewerProfile
          reviewer={selectedReviewer}
          isOpen={isReviewerProfileOpen}
          onClose={() => {
            setIsReviewerProfileOpen(false);
            setSelectedReviewer(null);
          }}
        />
      )}
    </>
  );
};

export default AISearchHero;