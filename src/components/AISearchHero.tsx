import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Zap, X, ArrowLeft, Heart, Navigation, Star, ThumbsUp, Filter, RefreshCw } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useGeolocation } from '../hooks/useGeolocation';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { CreditService } from '../services/creditService';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { calculateCompositeScore, getMatchPercentage } from '../utils/similarityUtils';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import CreditInfoTooltip from './CreditInfoTooltip';
import type { User } from '../types/user';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

interface SearchResult {
  id: string;
  name: string;
  image: string;
  rating: number | { thumbsUp: number; thumbsDown?: number; sentimentScore: number };
  address: string;
  shortDescription?: string;
  hours?: string;
  isOpen?: boolean;
  reviews: Array<{
    text: string;
    author: string;
    authorImage?: string;
    images?: Array<{ url: string; alt?: string }>;
    thumbsUp: boolean;
  }>;
  isPlatformBusiness: boolean;
  distance?: number;
  duration?: number;
  isGoogleVerified?: boolean;
  placeId?: string;
  similarity?: number;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  category?: string;
  description?: string;
  short_description?: string;
  location?: string;
  gallery_urls?: string[];
  days_closed?: string;
  phone_number?: string;
  website_url?: string;
  social_media?: string[];
  price_range?: string;
  service_area?: string;
  owner_user_id?: string;
  created_at?: string;
  updated_at?: string;
  is_verified?: boolean;
  thumbs_up?: number;
  thumbs_down?: number;
  sentiment_score?: number;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [searchType, setSearchType] = useState<'platform' | 'ai' | 'semantic'>('platform');
  const [lastSearchType, setLastSearchType] = useState<'platform' | 'ai' | 'semantic'>('platform');
  const [showBackToast, setShowBackToast] = useState(false);
  const [searchStats, setSearchStats] = useState({
    platformResults: 0,
    aiResults: 0,
    semanticResults: 0,
    totalResults: 0,
    usedSemanticSearch: false,
    usedAI: false
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { latitude, longitude, error: locationError } = useGeolocation();

  // Check for existing user session on component mount
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const user = await UserService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          setUserCredits(user.credits || 0);
        }
      } catch (error) {
        console.error('Error checking user session:', error);
      }
    };

    checkUserSession();

    // Listen for auth state changes
    const handleAuthStateChange = () => {
      checkUserSession();
    };

    window.addEventListener('auth-state-changed', handleAuthStateChange);

    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, []);

  // Handle authentication success
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setUserCredits(user.credits || 0);
    setShowSignupPrompt(false);
    setAuthModalOpen(false);
  };

  // Handle swipe gestures for card navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => nextCard(),
    onSwipedRight: () => prevCard(),
    trackMouse: true,
    preventScrollOnSwipe: true
  });

  // Navigation functions
  const nextCard = useCallback(() => {
    if (searchResults.length > 0) {
      setCurrentCardIndex((prev) => (prev + 1) % searchResults.length);
    }
  }, [searchResults.length]);

  const prevCard = useCallback(() => {
    if (searchResults.length > 0) {
      setCurrentCardIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    }
  }, [searchResults.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAppModeActive) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          prevCard();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextCard();
          break;
        case 'Escape':
          e.preventDefault();
          handleBackToSearch();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAppModeActive, nextCard, prevCard]);

  // Handle back navigation
  const handleBackToSearch = () => {
    setIsAppModeActive(false);
    setSearchResults([]);
    setCurrentCardIndex(0);
    setSearchError(null);
    
    // Show back toast
    setShowBackToast(true);
    setTimeout(() => setShowBackToast(false), 2000);
    
    // Focus search input after a brief delay
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Determine search type based on results and user preferences
  const determineSearchType = async (platformCount: number, query: string): Promise<'platform' | 'ai' | 'semantic'> => {
    // If we have 6+ platform results, use platform-only
    if (platformCount >= 6) {
      return 'platform';
    }

    // Check if user has enough credits for semantic search
    if (currentUser) {
      const hasSemanticCredits = await CreditService.hasEnoughCreditsForSearch(currentUser.id, 'semantic');
      if (hasSemanticCredits) {
        return 'semantic';
      }
    }

    // Check if user has enough credits for AI search
    if (currentUser) {
      const hasAICredits = await CreditService.hasEnoughCreditsForSearch(currentUser.id, 'ai');
      if (hasAICredits) {
        return 'ai';
      }
    }

    // Fallback to platform-only
    return 'platform';
  };

  // Main search function
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setCurrentCardIndex(0);

    try {
      console.log('🔍 Starting search for:', searchQuery);

      // Step 1: Search platform businesses first
      console.log('🏢 Searching platform businesses...');
      const platformBusinesses = await BusinessService.getBusinesses({
        search: searchQuery.trim(),
        userLatitude: latitude || undefined,
        userLongitude: longitude || undefined
      });

      console.log('✅ Platform search completed:', platformBusinesses.length, 'results');

      // Filter platform businesses within 10 miles
      const nearbyPlatformBusinesses = platformBusinesses.filter(business => {
        return !business.distance || business.distance <= 10;
      });

      console.log('📍 Platform businesses within 10 miles:', nearbyPlatformBusinesses.length);

      // Determine search strategy
      const finalSearchType = await determineSearchType(nearbyPlatformBusinesses.length, searchQuery);
      setLastSearchType(finalSearchType);

      let allResults: SearchResult[] = [];
      let usedSemanticSearch = false;
      let usedAI = false;

      // Step 2: Add platform businesses to results
      if (nearbyPlatformBusinesses.length > 0) {
        // Create standardized objects for platform businesses
        const platformResults: SearchResult[] = nearbyPlatformBusinesses.map(business => ({
          ...business,
          // Map image_url to image for platform businesses
          image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
          // Create rating object for platform businesses
          rating: {
            thumbsUp: business.thumbs_up || 0,
            thumbsDown: business.thumbs_down || 0,
            sentimentScore: business.sentiment_score || 0
          },
          address: business.address || business.location || 'Address not available',
          shortDescription: business.short_description || business.description?.substring(0, 100),
          isOpen: true, // Default to open since we don't have real-time status
          reviews: [], // Reviews would be fetched separately if needed
          isPlatformBusiness: true,
          isGoogleVerified: false
        }));

        allResults.push(...platformResults);
      }

      // Step 3: Fill remaining slots with semantic search or AI
      const remainingSlots = Math.max(0, 20 - allResults.length);

      if (remainingSlots > 0 && finalSearchType === 'semantic') {
        console.log('🧠 Using semantic search to fill remaining slots...');
        
        // Deduct credits for semantic search
        if (currentUser) {
          const deductionSuccess = await CreditService.deductSearchCredits(currentUser.id, 'semantic');
          if (deductionSuccess) {
            setUserCredits(prev => Math.max(0, prev - 5));
          }
        }

        try {
          const semanticResults = await SemanticSearchService.searchByVibe(searchQuery, {
            latitude,
            longitude,
            matchThreshold: 0.5,
            matchCount: remainingSlots
          });

          if (semanticResults.success && semanticResults.results.length > 0) {
            console.log('✅ Semantic search completed:', semanticResults.results.length, 'results');
            usedSemanticSearch = true;

            // Create standardized objects for semantic results (they're platform businesses too)
            const semanticBusinessResults: SearchResult[] = semanticResults.results.map(business => ({
              ...business,
              // Map image_url to image for semantic results
              image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              // Create rating object for semantic results
              rating: {
                thumbsUp: business.thumbs_up || 0,
                thumbsDown: business.thumbs_down || 0,
                sentimentScore: business.sentiment_score || 0
              },
              address: business.address || business.location || 'Address not available',
              shortDescription: business.short_description || business.description?.substring(0, 100),
              isOpen: true,
              reviews: [],
              isPlatformBusiness: true,
              isGoogleVerified: false
            }));

            // Filter out duplicates and add to results
            const newSemanticResults = semanticBusinessResults.filter(semanticBusiness => 
              !allResults.some(existing => existing.id === semanticBusiness.id)
            );

            allResults.push(...newSemanticResults);
          }
        } catch (semanticError) {
          console.warn('Semantic search failed, falling back to AI:', semanticError);
        }
      }

      // Step 4: Fill remaining slots with AI if still needed
      const finalRemainingSlots = Math.max(0, 20 - allResults.length);

      if (finalRemainingSlots > 0 && (finalSearchType === 'ai' || (finalSearchType === 'semantic' && !usedSemanticSearch))) {
        console.log('🤖 Using AI search to fill remaining slots...');
        
        // Deduct credits for AI search
        if (currentUser) {
          const deductionSuccess = await CreditService.deductSearchCredits(currentUser.id, 'ai');
          if (deductionSuccess) {
            setUserCredits(prev => Math.max(0, prev - 10));
          }
        }

        try {
          const aiResponse = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: searchQuery,
              searchQuery: searchQuery,
              existingResultsCount: allResults.length,
              numToGenerate: finalRemainingSlots,
              latitude,
              longitude
            }),
            timeout: 25000
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.results.length > 0) {
              console.log('✅ AI search completed:', aiData.results.length, 'results');
              usedAI = true;

              // Create standardized objects for AI businesses
              const aiResults: SearchResult[] = aiData.results.map((business: any) => ({
                ...business,
                // Ensure image property exists for AI businesses
                image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                // Keep rating as number for AI businesses (so toFixed() works)
                rating: business.rating || 4.5,
                address: business.address || 'Address not available',
                shortDescription: business.shortDescription || `Great ${searchQuery} with excellent service.`,
                isOpen: business.isOpen !== undefined ? business.isOpen : true,
                reviews: business.reviews || [],
                isPlatformBusiness: false,
                isGoogleVerified: business.isGoogleVerified || false,
                tags: business.tags || []
              }));

              allResults.push(...aiResults);
            }
          }
        } catch (aiError) {
          console.warn('AI search failed:', aiError);
        }
      }

      // Step 5: Deduct credits for platform search
      if (currentUser && allResults.length > 0) {
        const deductionSuccess = await CreditService.deductSearchCredits(currentUser.id, 'platform');
        if (deductionSuccess) {
          setUserCredits(prev => Math.max(0, prev - 1));
        }
      }

      // Step 6: Log search activity
      if (currentUser) {
        ActivityService.logSearch(currentUser.id, searchQuery, finalSearchType);
      }

      // Step 7: Sort results by composite score for optimal ranking
      const sortedResults = allResults.map(business => ({
        ...business,
        compositeScore: calculateCompositeScore({
          similarity: business.similarity,
          distance: business.distance,
          isOpen: business.isOpen,
          isPlatformBusiness: business.isPlatformBusiness
        })
      })).sort((a, b) => b.compositeScore - a.compositeScore);

      // Update search stats
      setSearchStats({
        platformResults: nearbyPlatformBusinesses.length,
        aiResults: usedAI ? allResults.filter(r => !r.isPlatformBusiness).length : 0,
        semanticResults: usedSemanticSearch ? allResults.filter(r => r.isPlatformBusiness && r.similarity).length : 0,
        totalResults: sortedResults.length,
        usedSemanticSearch,
        usedAI
      });

      setSearchResults(sortedResults);

      if (sortedResults.length === 0) {
        setSearchError('No businesses found matching your search. Try a different term or location.');
      } else {
        setIsAppModeActive(true);
      }

    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle business recommendation
  const handleRecommendBusiness = async (business: SearchResult) => {
    if (!currentUser) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      const success = await BusinessService.saveAIRecommendation(business, currentUser.id);
      if (success) {
        alert(`✅ ${business.name} has been saved to your favorites!`);
      } else {
        alert('Failed to save business. Please try again.');
      }
    } catch (error) {
      console.error('Error saving business:', error);
      alert('Failed to save business. Please try again.');
    }
  };

  // Handle "Take Me There" action
  const handleTakeMeThere = async (business: SearchResult) => {
    // Record business visit if user is logged in
    if (currentUser && business.isPlatformBusiness) {
      try {
        await BusinessService.recordBusinessVisit(business.id, currentUser.id);
        // Dispatch event to update visited businesses list
        window.dispatchEvent(new CustomEvent('visited-businesses-updated'));
      } catch (error) {
        console.error('Error recording business visit:', error);
      }
    }

    // Navigate to business
    let mapsUrl;
    if (business.placeId && typeof business.placeId === 'string' && business.placeId.trim().length > 0) {
      const businessName = business.name && typeof business.name === 'string' ? business.name.trim() : 'business';
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessName)}&query_place_id=${business.placeId.trim()}`;
    } else if (business.latitude && business.longitude) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
    } else if (business.address && typeof business.address === 'string' && business.address.trim().length > 0) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address.trim())}`;
    } else if (business.name && typeof business.name === 'string' && business.name.trim().length > 0) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name.trim())}`;
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=business`;
    }

    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    if (!currentUser) {
      setShowSignupPrompt(true);
      return;
    }
  };

  // Get current business for display
  const currentBusiness = searchResults[currentCardIndex];

  return (
    <>
      {/* Hero Section */}
      <section className={`relative transition-all duration-500 ${
        isAppModeActive 
          ? 'h-screen overflow-hidden' 
          : 'py-20 bg-gradient-to-br from-primary-50 to-accent-50'
      }`}>
        
        {/* Background Image for Non-App Mode */}
        {!isAppModeActive && (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="Restaurant background"
              className="w-full h-full object-cover opacity-20"
            />
          </div>
        )}

        <div className={`relative z-10 ${
          isAppModeActive 
            ? 'h-full flex flex-col' 
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center'
        }`}>
          
          {/* Search Header - Fixed at top in app mode */}
          <div className={`${
            isAppModeActive 
              ? 'search-bar-fixed bg-white shadow-sm p-4' 
              : 'mb-12'
          }`}>
            
            {/* Back Button - Only in app mode */}
            {isAppModeActive && (
              <div className="flex items-center mb-4">
                <button
                  onClick={handleBackToSearch}
                  className="p-2 rounded-full hover:bg-neutral-100 transition-colors duration-200 mr-3"
                  aria-label="Back to search"
                >
                  <ArrowLeft className="h-5 w-5 text-neutral-600" />
                </button>
                
                <div className="flex-1">
                  <h2 className="font-poppins text-lg font-semibold text-neutral-900">
                    "{searchQuery}"
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-neutral-600">
                    <span>{searchStats.totalResults} results</span>
                    {searchStats.usedSemanticSearch && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        Semantic Search
                      </span>
                    )}
                    {searchStats.usedAI && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        AI Enhanced
                      </span>
                    )}
                  </div>
                </div>

                {/* User Credits Display */}
                {currentUser && (
                  <div className="flex items-center bg-primary-100 text-primary-700 px-3 py-1 rounded-lg">
                    <Zap className="h-4 w-4 mr-1" />
                    <span className="font-poppins text-sm font-semibold">
                      {userCredits}
                    </span>
                    <CreditInfoTooltip placement="bottom" />
                  </div>
                )}
              </div>
            )}

            {/* Title and Description - Only in non-app mode */}
            {!isAppModeActive && (
              <>
                <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-neutral-900 mb-6">
                  All Experiences
                  <br />
                  <span className="text-primary-500">Verified & Reviewed</span>
                </h1>
                <p className="font-lora text-xl text-neutral-600 max-w-2xl mx-auto mb-12">
                  Discover amazing places with AI-powered search. Find businesses that match your exact vibe and mood.
                </p>
              </>
            )}

            {/* Search Form */}
            <form onSubmit={handleSearch} className={`${
              isAppModeActive ? 'w-full' : 'max-w-2xl mx-auto'
            }`}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-neutral-400" />
                </div>
                
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  placeholder="Search for 'cozy coffee shop' or 'romantic dinner spot'..."
                  className={`w-full pl-12 pr-16 py-4 bg-white border border-neutral-200 rounded-2xl font-lora text-neutral-700 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-lg ${
                    isAppModeActive ? 'text-base' : 'text-lg'
                  }`}
                  disabled={isSearching}
                />
                
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  {isSearching ? (
                    <div className="p-2">
                      <RefreshCw className="h-5 w-5 text-primary-500 animate-spin" />
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={!searchQuery.trim()}
                      className="bg-primary-500 text-white p-2 rounded-xl hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Location Status */}
            {!isAppModeActive && (
              <div className="mt-6 flex items-center justify-center text-neutral-600">
                <MapPin className="h-4 w-4 mr-2" />
                <span className="font-lora text-sm">
                  {locationError 
                    ? 'Location access denied - showing general results'
                    : latitude && longitude 
                      ? 'Using your location for better results'
                      : 'Getting your location...'
                  }
                </span>
              </div>
            )}
          </div>

          {/* Search Results - App Mode */}
          {isAppModeActive && searchResults.length > 0 && (
            <div className="flex-1 overflow-hidden pt-4">
              <div 
                {...swipeHandlers}
                className="h-full px-4 pb-4 overflow-hidden"
              >
                {/* Card Container */}
                <div className="h-full flex items-center justify-center">
                  <div className="w-full max-w-sm mx-auto">
                    {currentBusiness && (
                      <>
                        {currentBusiness.isPlatformBusiness ? (
                          <PlatformBusinessCard
                            business={currentBusiness}
                            onRecommend={handleRecommendBusiness}
                            onTakeMeThere={handleTakeMeThere}
                          />
                        ) : (
                          <AIBusinessCard
                            business={currentBusiness}
                            onRecommend={handleRecommendBusiness}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Card Navigation */}
                <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center">
                  <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={prevCard}
                        disabled={searchResults.length <= 1}
                        className="p-2 rounded-full hover:bg-neutral-100 transition-colors duration-200 disabled:opacity-50"
                      >
                        <ArrowLeft className="h-5 w-5 text-neutral-600" />
                      </button>
                      
                      <div className="flex items-center gap-2">
                        {searchResults.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentCardIndex(index)}
                            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                              index === currentCardIndex ? 'bg-primary-500' : 'bg-neutral-300'
                            }`}
                          />
                        ))}
                      </div>
                      
                      <button
                        onClick={nextCard}
                        disabled={searchResults.length <= 1}
                        className="p-2 rounded-full hover:bg-neutral-100 transition-colors duration-200 disabled:opacity-50"
                      >
                        <ArrowLeft className="h-5 w-5 text-neutral-600 rotate-180" />
                      </button>
                    </div>
                    
                    <div className="text-center mt-2">
                      <span className="font-poppins text-sm text-neutral-600">
                        {currentCardIndex + 1} of {searchResults.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State - App Mode */}
          {isAppModeActive && searchError && (
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="text-center">
                <Search className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                  No Results Found
                </h3>
                <p className="font-lora text-neutral-600 mb-6">
                  {searchError}
                </p>
                <button
                  onClick={handleBackToSearch}
                  className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                >
                  Try Another Search
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Back Toast */}
      {showBackToast && (
        <div className="back-toast">
          Swipe right or press ESC to go back
        </div>
      )}

      {/* Signup Prompt Modal */}
      <SignupPrompt
        isOpen={showSignupPrompt}
        onClose={() => setShowSignupPrompt(false)}
        onSignup={() => {
          setShowSignupPrompt(false);
          setAuthMode('signup');
          setAuthModalOpen(true);
        }}
        onLogin={() => {
          setShowSignupPrompt(false);
          setAuthMode('login');
          setAuthModalOpen(true);
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
};

export default AISearchHero;