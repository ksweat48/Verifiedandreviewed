import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Zap, X, ArrowLeft, Filter, MapPin, Navigation, Heart, Star, Clock, ThumbsUp } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { CreditService } from '../services/creditService';
import { ActivityService } from '../services/activityService';
import { UserService } from '../services/userService';
import { useGeolocation } from '../hooks/useGeolocation';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import CreditInfoTooltip from './CreditInfoTooltip';
import { calculateCompositeScore } from '../utils/similarityUtils';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

interface BusinessCard {
  id: string;
  name: string;
  address: string;
  image: string;
  shortDescription?: string;
  rating: number;
  hours?: string;
  isOpen?: boolean;
  reviews: Array<{
    text: string;
    author: string;
    images?: Array<{url: string; alt?: string}>;
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
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BusinessCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [searchType, setSearchType] = useState<'platform' | 'ai' | 'semantic'>('platform');
  const [showBackToast, setShowBackToast] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [lastSearchType, setLastSearchType] = useState<'platform' | 'ai' | 'semantic'>('platform');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { latitude, longitude, error: locationError } = useGeolocation();

  // Load user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await UserService.getCurrentUser();
        setUser(userData);
        setUserCredits(userData?.credits || 0);
      } catch (error) {
        console.debug('User not logged in or error fetching user data');
      }
    };
    
    loadUserData();
    
    // Listen for auth state changes
    const handleAuthStateChange = () => {
      loadUserData();
    };
    
    window.addEventListener('auth-state-changed', handleAuthStateChange);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, []);

  // Focus search input when app mode becomes active
  useEffect(() => {
    if (isAppModeActive && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isAppModeActive]);

  // Handle back button behavior in app mode
  useEffect(() => {
    if (!isAppModeActive) return;

    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      
      if (hasSearched) {
        // Clear search results and go back to search input
        setSearchResults([]);
        setCurrentCardIndex(0);
        setHasSearched(false);
        setSearchQuery('');
        setSearchError('');
        
        // Show toast
        setShowBackToast(true);
        setTimeout(() => setShowBackToast(false), 2000);
        
        // Focus search input
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      } else {
        // Exit app mode
        setIsAppModeActive(false);
        window.history.pushState(null, '', '/');
      }
    };

    // Push a state when entering app mode or after search
    if (hasSearched) {
      window.history.pushState({ appMode: true, hasSearched: true }, '', '/#app-mode');
    } else {
      window.history.pushState({ appMode: true }, '', '/#app-mode');
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAppModeActive, hasSearched, setIsAppModeActive]);

  const handleSearch = async (query: string = searchQuery, type: 'platform' | 'ai' | 'semantic' = searchType) => {
    if (!query.trim()) return;

    // Check if user is authenticated for credit-based searches
    if ((type === 'ai' || type === 'semantic') && !user) {
      setShowSignupPrompt(true);
      return;
    }

    // Check if user has enough credits
    if (user && (type === 'ai' || type === 'semantic')) {
      const hasEnoughCredits = await CreditService.hasEnoughCreditsForSearch(user.id, type);
      if (!hasEnoughCredits) {
        alert(`Not enough credits for ${type} search. You need ${type === 'semantic' ? '5' : '10'} credits.`);
        return;
      }
    }

    setIsSearching(true);
    setSearchError('');
    setLastSearchQuery(query);
    setLastSearchType(type);

    try {
      let results: BusinessCard[] = [];
      let platformResults: any[] = [];
      let aiResults: any[] = [];

      console.log(`🔍 Starting ${type} search for: "${query}"`);

      // Step 1: Always search platform businesses first
      try {
        console.log('🔍 Searching platform businesses...');
        platformResults = await BusinessService.getBusinesses({
          search: query,
          userLatitude: latitude || undefined,
          userLongitude: longitude || undefined
        });
        console.log(`✅ Found ${platformResults.length} platform businesses`);
      } catch (error) {
        console.error('❌ Platform search failed:', error);
        platformResults = [];
      }

      // Transform platform results to BusinessCard format
      const transformedPlatformResults: BusinessCard[] = platformResults.map(business => ({
        id: business.id,
        name: business.name,
        address: business.address || business.location || 'Address not available',
        image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
        shortDescription: business.short_description || business.description || 'No description available',
        rating: business.sentiment_score ? (business.sentiment_score / 20) : 4.5,
        hours: business.hours || 'Hours not available',
        isOpen: true,
        reviews: business.reviews || [],
        isPlatformBusiness: true,
        distance: business.distance,
        duration: business.duration,
        similarity: business.similarity,
        latitude: business.latitude,
        longitude: business.longitude
      }));

      results = [...transformedPlatformResults];

      // Step 2: If semantic search and we have platform results, use them
      if (type === 'semantic' && transformedPlatformResults.length > 0) {
        console.log('🧠 Using semantic search on platform businesses');
        
        try {
          const semanticResults = await SemanticSearchService.searchByVibe(query, {
            latitude: latitude || undefined,
            longitude: longitude || undefined,
            matchThreshold: 0.3,
            matchCount: 20
          });

          if (semanticResults.success && semanticResults.results.length > 0) {
            console.log(`✅ Semantic search found ${semanticResults.results.length} matches`);
            
            // Transform semantic results
            const transformedSemanticResults: BusinessCard[] = semanticResults.results.map(business => ({
              id: business.id,
              name: business.name,
              address: business.address || business.location || 'Address not available',
              image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              shortDescription: business.short_description || business.description || 'No description available',
              rating: business.sentiment_score ? (business.sentiment_score / 20) : 4.5,
              hours: business.hours || 'Hours not available',
              isOpen: true,
              reviews: business.reviews || [],
              isPlatformBusiness: true,
              distance: business.distance,
              duration: business.duration,
              similarity: business.similarity,
              latitude: business.latitude,
              longitude: business.longitude
            }));

            results = transformedSemanticResults;
            
            // Deduct semantic search credits
            if (user) {
              await CreditService.deductSearchCredits(user.id, 'semantic');
              setUserCredits(prev => prev - 5);
            }
          }
        } catch (semanticError) {
          console.warn('⚠️ Semantic search failed, using platform results:', semanticError);
        }
      }
      // Step 3: If AI search or insufficient platform results, use AI
      else if (type === 'ai' || (type === 'platform' && results.length < 6)) {
        console.log(`🤖 Using AI search (${type === 'ai' ? 'requested' : 'insufficient platform results'})`);
        
        try {
          const aiResponse = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: query,
              searchQuery: query,
              existingResultsCount: results.length,
              numToGenerate: Math.max(20 - results.length, 10),
              latitude: latitude || undefined,
              longitude: longitude || undefined
            }),
            timeout: 30000
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.results) {
              console.log(`✅ AI search found ${aiData.results.length} businesses`);
              
              // Transform AI results to BusinessCard format
              const transformedAIResults: BusinessCard[] = aiData.results.map((business: any) => ({
                id: business.id,
                name: business.name,
                address: business.address || 'Address not available',
                image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                shortDescription: business.shortDescription || 'AI-generated business recommendation',
                rating: business.rating || 4.5,
                hours: business.hours || 'Hours not available',
                isOpen: business.isOpen !== undefined ? business.isOpen : true,
                reviews: business.reviews || [],
                isPlatformBusiness: false,
                distance: business.distance,
                duration: business.duration,
                isGoogleVerified: business.isGoogleVerified || false,
                placeId: business.placeId,
                similarity: business.similarity,
                latitude: business.latitude,
                longitude: business.longitude
              }));

              aiResults = transformedAIResults;
              results = [...results, ...transformedAIResults];
              
              // Deduct AI search credits
              if (user && type === 'ai') {
                await CreditService.deductSearchCredits(user.id, 'ai');
                setUserCredits(prev => prev - 10);
              }
            }
          }
        } catch (aiError) {
          console.warn('⚠️ AI search failed:', aiError);
        }
      }

      // Step 4: If platform-only search, deduct 1 credit
      if (type === 'platform' && user) {
        await CreditService.deductSearchCredits(user.id, 'platform');
        setUserCredits(prev => prev - 1);
      }

      // Step 5: Calculate composite scores and sort
      const resultsWithScores = results.map(business => ({
        ...business,
        compositeScore: calculateCompositeScore(business)
      }));

      // Sort by composite score (highest first)
      resultsWithScores.sort((a, b) => b.compositeScore - a.compositeScore);

      console.log(`📊 Final results: ${resultsWithScores.length} businesses`);
      console.log(`📊 Platform: ${transformedPlatformResults.length}, AI: ${aiResults.length}`);

      setSearchResults(resultsWithScores);
      setCurrentCardIndex(0);
      setHasSearched(true);

      // Log search activity
      if (user) {
        ActivityService.logSearch(user.id, query, type);
      }

    } catch (error) {
      console.error('❌ Search failed:', error);
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCardSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right' && currentCardIndex < searchResults.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    } else if (direction === 'left' && currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleCardSwipe('right'),
    onSwipedRight: () => handleCardSwipe('left'),
    trackMouse: true,
    preventScrollOnSwipe: true
  });

  const handleTakeMeThere = (business: BusinessCard) => {
    console.log('🗺️ Take me there clicked for:', business.name);
    
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

  const handleRecommend = async (business: BusinessCard) => {
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      const success = await BusinessService.saveAIRecommendation(business, user.id);
      if (success) {
        alert(`${business.name} has been saved to your favorites!`);
      } else {
        alert('Failed to save business. Please try again.');
      }
    } catch (error) {
      console.error('Error saving business:', error);
      alert('Failed to save business. Please try again.');
    }
  };

  const handleExitSearch = () => {
    setSearchResults([]);
    setCurrentCardIndex(0);
    setHasSearched(false);
    setSearchQuery('');
    setSearchError('');
    setIsAppModeActive(false);
    window.history.pushState(null, '', '/');
  };

  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    setUserCredits(userData.credits || 0);
    setShowSignupPrompt(false);
  };

  const currentBusiness = searchResults[currentCardIndex];

  return (
    <>
      <section className={`relative ${isAppModeActive ? 'fixed inset-0 z-50 bg-white' : 'py-20 bg-gradient-to-br from-primary-50 to-accent-50'}`}>
        {/* Background Image - Only show when not in app mode */}
        {!isAppModeActive && (
          <div className="absolute inset-0 overflow-hidden">
            <img
              src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920"
              alt="Background"
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-primary-50/80 to-accent-50/80 hero-background-blur"></div>
          </div>
        )}

        <div className={`relative z-10 ${isAppModeActive ? 'h-full flex flex-col' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
          {/* Header - Only show when not in app mode */}
          {!isAppModeActive && (
            <div className="text-center mb-12">
              <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-neutral-900 mb-6">
                Find Your Perfect Experience
              </h1>
              <p className="font-lora text-xl text-neutral-600 max-w-2xl mx-auto mb-8">
                Discover verified businesses and hidden gems with AI-powered search
              </p>
            </div>
          )}

          {/* Search Bar */}
          <div className={`${isAppModeActive ? 'search-bar-fixed p-4 bg-white shadow-sm' : 'max-w-2xl mx-auto'}`}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-neutral-400" />
              </div>
              
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for restaurants, cafes, wellness centers..."
                className={`w-full pl-12 pr-32 py-4 text-lg font-lora border-2 border-neutral-200 rounded-2xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 ${
                  isAppModeActive ? 'bg-white' : 'bg-white/90 backdrop-blur-sm'
                }`}
                disabled={isSearching}
              />
              
              <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                {user && (
                  <div className="flex items-center mr-2">
                    <Zap className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="font-poppins text-sm font-semibold text-neutral-700">
                      {userCredits}
                    </span>
                    <CreditInfoTooltip />
                  </div>
                )}
                
                <button
                  onClick={() => handleSearch()}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-6 py-2 rounded-xl font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSearching ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Sparkles className="h-5 w-5 mr-2" />
                  )}
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {/* Search Type Selector - Only show when not searching */}
            {!isSearching && (
              <div className="flex justify-center mt-4 gap-2">
                <button
                  onClick={() => setSearchType('platform')}
                  className={`px-3 py-1 rounded-full text-xs font-poppins font-semibold transition-colors duration-200 ${
                    searchType === 'platform'
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Platform (1 credit)
                </button>
                <button
                  onClick={() => setSearchType('semantic')}
                  className={`px-3 py-1 rounded-full text-xs font-poppins font-semibold transition-colors duration-200 ${
                    searchType === 'semantic'
                      ? 'bg-purple-500 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  Vibe Search (5 credits)
                </button>
                <button
                  onClick={() => setSearchType('ai')}
                  className={`px-3 py-1 rounded-full text-xs font-poppins font-semibold transition-colors duration-200 ${
                    searchType === 'ai'
                      ? 'bg-accent-500 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  AI Powered (10 credits)
                </button>
              </div>
            )}
          </div>

          {/* Search Results - App Mode */}
          {isAppModeActive && hasSearched && (
            <div className="flex-1 overflow-hidden">
              {searchError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-red-500 mb-4">
                      <X className="h-16 w-16 mx-auto" />
                    </div>
                    <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                      Search Failed
                    </h3>
                    <p className="font-lora text-neutral-600 mb-4">{searchError}</p>
                    <button
                      onClick={() => handleSearch(lastSearchQuery, lastSearchType)}
                      className="bg-primary-500 text-white px-6 py-3 rounded-lg font-poppins font-semibold hover:bg-primary-600 transition-colors duration-200"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-neutral-400 mb-4">
                      <Search className="h-16 w-16 mx-auto" />
                    </div>
                    <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                      No Results Found
                    </h3>
                    <p className="font-lora text-neutral-600 mb-4">
                      Try a different search term or search type
                    </p>
                    <button
                      onClick={() => {
                        setHasSearched(false);
                        setSearchQuery('');
                        setTimeout(() => searchInputRef.current?.focus(), 100);
                      }}
                      className="bg-primary-500 text-white px-6 py-3 rounded-lg font-poppins font-semibold hover:bg-primary-600 transition-colors duration-200"
                    >
                      New Search
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Results Header */}
                  <div className="p-4 bg-white border-b border-neutral-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-poppins text-lg font-semibold text-neutral-900">
                          Search Results
                        </h3>
                        <p className="font-lora text-sm text-neutral-600">
                          {searchResults.length} businesses found for "{lastSearchQuery}"
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-poppins text-sm text-neutral-600">
                          {currentCardIndex + 1} of {searchResults.length}
                        </span>
                        <button
                          onClick={handleExitSearch}
                          className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors duration-200"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Display */}
                  <div className="flex-1 overflow-hidden relative" {...swipeHandlers}>
                    <div 
                      className="flex transition-transform duration-300 ease-in-out h-full"
                      style={{ transform: `translateX(-${currentCardIndex * 100}%)` }}
                    >
                      {searchResults.map((business, index) => (
                        <div key={business.id} className="w-full flex-shrink-0 p-4 overflow-y-auto">
                          {business.isPlatformBusiness ? (
                            <PlatformBusinessCard
                              business={business}
                              onRecommend={handleRecommend}
                              onTakeMeThere={handleTakeMeThere}
                            />
                          ) : (
                            <AIBusinessCard
                              business={business}
                              onRecommend={handleRecommend}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Navigation Dots */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
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
                  </div>

                  {/* Exit Button */}
                  <div className="p-4 bg-white border-t border-neutral-200">
                    <button
                      onClick={handleExitSearch}
                      className="w-full bg-neutral-100 text-neutral-700 py-3 px-4 rounded-lg font-poppins font-semibold hover:bg-neutral-200 transition-colors duration-200 flex items-center justify-center"
                    >
                      <ArrowLeft className="h-5 w-5 mr-2" />
                      Exit Search
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Search Suggestions - Only show when not in app mode */}
          {!isAppModeActive && (
            <div className="mt-8 text-center">
              <p className="font-lora text-neutral-600 mb-4">Popular searches:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  'cozy coffee shops',
                  'healthy restaurants',
                  'yoga studios',
                  'organic markets',
                  'romantic dinner'
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setIsAppModeActive(true);
                      setTimeout(() => handleSearch(suggestion), 100);
                    }}
                    className="bg-white/80 backdrop-blur-sm text-neutral-700 px-4 py-2 rounded-full font-lora text-sm hover:bg-white hover:shadow-md transition-all duration-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Back Toast */}
        {showBackToast && (
          <div className="back-toast">
            Returned to search
          </div>
        )}
      </section>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
          onSignup={() => {
            document.dispatchEvent(new CustomEvent('open-auth-modal', { 
              detail: { mode: 'signup', forceMode: true } 
            }));
            setShowSignupPrompt(false);
          }}
          onLogin={() => {
            document.dispatchEvent(new CustomEvent('open-auth-modal', { 
              detail: { mode: 'login', forceMode: true } 
            }));
            setShowSignupPrompt(false);
          }}
          onClose={() => setShowSignupPrompt(false)}
        />
      )}
    </>
  );
};

export default AISearchHero;