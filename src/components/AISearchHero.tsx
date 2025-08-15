import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, MapPin, Zap, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../hooks/useAuth';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { CreditService } from '../services/creditService';
import { ActivityService } from '../services/activityService';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { getMatchPercentage, calculateCompositeScore } from '../utils/similarityUtils';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import CreditInfoTooltip from './CreditInfoTooltip';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [searchType, setSearchType] = useState<'platform' | 'semantic' | 'ai'>('platform');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [semanticThreshold, setSemanticThreshold] = useState(0.5);
  const [maxResults, setMaxResults] = useState(10);
  const [backToastVisible, setBackToastVisible] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { latitude, longitude, error: locationError, loading: locationLoading } = useGeolocation();

  // Auto-focus search input when app mode becomes active
  useEffect(() => {
    if (isAppModeActive && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isAppModeActive]);

  // Handle browser back button in app mode
  useEffect(() => {
    if (isAppModeActive) {
      const handlePopState = () => {
        setIsAppModeActive(false);
        setHasSearched(false);
        setSearchResults([]);
        setCurrentCardIndex(0);
        
        // Show back toast
        setBackToastVisible(true);
        setTimeout(() => setBackToastVisible(false), 2000);
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isAppModeActive, setIsAppModeActive]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!searchQuery.trim()) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      setShowSignupPrompt(true);
      return;
    }

    // Check if user has enough credits
    const hasEnoughCredits = await CreditService.hasEnoughCreditsForSearch(user?.id || '', 'platform');
    if (!hasEnoughCredits) {
      setShowSignupPrompt(true);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
    setCurrentCardIndex(0);
    
    // Enter app mode
    setIsAppModeActive(true);
    
    // Push state for browser back button
    window.history.pushState(null, '', window.location.href);

    try {
      // Log search activity
      if (user) {
        ActivityService.logSearch(user.id, searchQuery, 'platform');
      }

      // Step 1: Search platform businesses first
      console.log('🔍 Step 1: Searching platform businesses...');
      
      const platformBusinesses = await BusinessService.getBusinesses({
        search: searchQuery,
        userLatitude: latitude || undefined,
        userLongitude: longitude || undefined
      });

      console.log('✅ Found', platformBusinesses.length, 'platform businesses');

      // Calculate accurate distances for platform businesses
      let platformBusinessesWithDistances = platformBusinesses;
      if (latitude && longitude && platformBusinesses.length > 0) {
        try {
          platformBusinessesWithDistances = await BusinessService.calculateBusinessDistances(
            platformBusinesses,
            latitude,
            longitude
          );
          console.log('✅ Updated platform businesses with accurate distances');
        } catch (distanceError) {
          console.warn('⚠️ Distance calculation failed for platform businesses:', distanceError);
        }
      }

      // Transform platform businesses to match card format
      const formattedPlatformBusinesses = platformBusinessesWithDistances.map(business => ({
        ...business,
        image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
        rating: {
          thumbsUp: business.thumbs_up || 0,
          thumbsDown: business.thumbs_down || 0,
          sentimentScore: business.sentiment_score || 0
        },
        isPlatformBusiness: true,
        isOpen: true,
        reviews: business.reviews || [],
        similarity: 0.9 // High similarity for exact matches
      }));

      let allResults = [...formattedPlatformBusinesses];

      // Step 2: If we have fewer than 10 platform results, use semantic search
      if (allResults.length < 10) {
        console.log('🧠 Step 2: Using semantic search to find more results...');
        
        try {
          const semanticResults = await SemanticSearchService.searchByVibe(searchQuery, {
            latitude,
            longitude,
            matchThreshold: semanticThreshold,
            matchCount: 15 - allResults.length
          });

          if (semanticResults.success && semanticResults.results.length > 0) {
            console.log('✅ Semantic search found', semanticResults.results.length, 'additional results');
            
            // Filter out businesses already in platform results
            const platformBusinessIds = new Set(allResults.map(b => b.id));
            const newSemanticResults = semanticResults.results.filter(
              business => !platformBusinessIds.has(business.id)
            );
            
            allResults = [...allResults, ...newSemanticResults];
            console.log('✅ Added', newSemanticResults.length, 'new semantic results');
          }
        } catch (semanticError) {
          console.warn('⚠️ Semantic search failed:', semanticError);
        }
      }

      // Step 3: If we still have fewer than 10 results, use AI to generate more
      if (allResults.length < 10) {
        console.log('🤖 Step 3: Using AI to generate additional business suggestions...');
        
        try {
          const aiResponse = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: searchQuery,
              searchQuery: searchQuery,
              existingResultsCount: allResults.length,
              numToGenerate: Math.min(15 - allResults.length, 10),
              latitude,
              longitude
            }),
            timeout: 25000
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.results.length > 0) {
              console.log('✅ AI generated', aiData.results.length, 'additional businesses');
              allResults = [...allResults, ...aiData.results];
            }
          }
        } catch (aiError) {
          console.warn('⚠️ AI business generation failed:', aiError);
        }
      }

      // Sort all results by composite score
      const sortedResults = allResults
        .map(business => ({
          ...business,
          compositeScore: calculateCompositeScore({
            similarity: business.similarity,
            distance: business.distance,
            isOpen: business.isOpen,
            isPlatformBusiness: business.isPlatformBusiness
          })
        }))
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, maxResults);

      console.log('🎯 Final sorted results:', sortedResults.length, 'businesses');

      setSearchResults(sortedResults);

      // Deduct credits after successful search
      if (user && sortedResults.length > 0) {
        const searchTypeForCredit = allResults.some(b => b.isPlatformBusiness) ? 'platform' : 
                                   allResults.some(b => b.similarity) ? 'semantic' : 'ai';
        
        CreditService.deductSearchCredits(user.id, searchTypeForCredit);
      }

    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecommend = async (business: any) => {
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      const success = await BusinessService.saveAIRecommendation(business, user.id);
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

  const handleTakeMeThere = (business: any) => {
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    // Record business visit
    BusinessService.recordBusinessVisit(business.id, user.id);

    // Navigate to business
    let mapsUrl;
    if (business.placeId) {
      const businessName = business.name || 'business';
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessName)}&query_place_id=${business.placeId}`;
    } else if (business.latitude && business.longitude) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
    } else if (business.address) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name)}`;
    }
    
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSignupPromptSignup = () => {
    setShowSignupPrompt(false);
    // Dispatch custom event to open auth modal in signup mode
    const event = new CustomEvent('open-auth-modal', {
      detail: { mode: 'signup' }
    });
    document.dispatchEvent(event);
  };

  const handleSignupPromptLogin = () => {
    setShowSignupPrompt(false);
    // Dispatch custom event to open auth modal in login mode
    const event = new CustomEvent('open-auth-modal', {
      detail: { mode: 'login' }
    });
    document.dispatchEvent(event);
  };

  // Swipe handlers for mobile navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentCardIndex < searchResults.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
      }
    },
    onSwipedRight: () => {
      if (currentCardIndex > 0) {
        setCurrentCardIndex(prev => prev - 1);
      }
    },
    trackMouse: false,
    trackTouch: true
  });

  return (
    <>
      <section className={`relative transition-all duration-500 ${
        isAppModeActive 
          ? 'h-screen overflow-hidden' 
          : 'py-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
      }`}>
        {/* Background Image */}
        {!isAppModeActive && (
          <div className="absolute inset-0">
            <img 
              src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920" 
              alt="Restaurant background" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-60"></div>
          </div>
        )}

        <div className={`relative z-10 ${
          isAppModeActive 
            ? 'h-full flex flex-col' 
            : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'
        }`}>
          {/* Header Section */}
          <div className={`${
            isAppModeActive 
              ? 'search-bar-fixed bg-gradient-to-r from-slate-800 to-purple-800 p-4 header-shadow' 
              : 'mb-12'
          }`}>
            {!isAppModeActive && (
              <>
                <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-white mb-6">
                  Find Your Perfect Vibe
                </h1>
                <p className="font-lora text-xl md:text-2xl text-white text-opacity-90 mb-8 max-w-2xl mx-auto">
                  Discover businesses that match your mood with AI-powered search
                </p>
              </>
            )}

            {/* Search Form */}
            <form onSubmit={handleSearch} className={`${
              isAppModeActive 
                ? 'flex items-center gap-3' 
                : 'max-w-2xl mx-auto'
            }`}>
              <div className={`relative ${isAppModeActive ? 'flex-1' : 'w-full'}`}>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="I'm looking for a cozy coffee shop..."
                  className={`w-full pl-12 pr-4 py-4 bg-white border border-neutral-200 rounded-xl font-lora text-neutral-700 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    isAppModeActive ? 'text-base' : 'text-lg'
                  }`}
                />
              </div>
              
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className={`bg-gradient-to-r from-primary-500 to-accent-500 text-white font-poppins font-semibold rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                  isAppModeActive ? 'px-6 py-4' : 'px-8 py-4 w-full mt-4'
                }`}
              >
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    {isAppModeActive ? 'Search' : 'Find My Vibe'}
                  </>
                )}
              </button>
            </form>

            {/* Advanced Options */}
            {!isAppModeActive && (
              <div className="mt-6">
                <button
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="text-white text-opacity-80 hover:text-opacity-100 font-lora text-sm flex items-center mx-auto transition-colors duration-200"
                >
                  Advanced Options
                  {showAdvancedOptions ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </button>
                
                {showAdvancedOptions && (
                  <div className="mt-4 bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4 max-w-md mx-auto">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-white text-sm font-poppins mb-2">
                          Semantic Match Threshold: {Math.round(semanticThreshold * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.3"
                          max="0.8"
                          step="0.1"
                          value={semanticThreshold}
                          onChange={(e) => setSemanticThreshold(parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-white text-sm font-poppins mb-2">
                          Max Results: {maxResults}
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="20"
                          step="5"
                          value={maxResults}
                          onChange={(e) => setMaxResults(parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Credit Info */}
            {isAppModeActive && user && (
              <div className="flex items-center justify-between mt-3 text-white text-opacity-80">
                <div className="flex items-center text-sm">
                  <Zap className="h-4 w-4 mr-1 text-yellow-400" />
                  <span className="font-poppins">{user.credits} credits</span>
                  <CreditInfoTooltip placement="bottom" />
                </div>
                <div className="text-xs font-lora">
                  {searchResults.length} results
                </div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {isAppModeActive && hasSearched && (
            <div className="flex-1 overflow-hidden pt-4">
              {isSearching ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-spin" />
                    <p className="font-lora text-neutral-600">Finding your perfect vibe...</p>
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Search className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                      No Results Found
                    </h3>
                    <p className="font-lora text-neutral-600">
                      Try a different search term or adjust your criteria
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-hidden">
                  {/* Mobile: Swipeable Cards */}
                  <div className="md:hidden h-full">
                    <div 
                      {...swipeHandlers}
                      className="h-full px-4 pb-4 overflow-hidden"
                    >
                      {searchResults[currentCardIndex] && (
                        <div className="h-full">
                          {searchResults[currentCardIndex].isPlatformBusiness ? (
                            <PlatformBusinessCard
                              business={searchResults[currentCardIndex]}
                              onRecommend={handleRecommend}
                              onTakeMeThere={handleTakeMeThere}
                            />
                          ) : (
                            <AIBusinessCard
                              business={searchResults[currentCardIndex]}
                              onRecommend={handleRecommend}
                            />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Mobile Navigation Dots */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                      {searchResults.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentCardIndex(index)}
                          className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                            index === currentCardIndex ? 'bg-primary-500' : 'bg-white bg-opacity-50'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Desktop: Grid Layout */}
                  <div className="hidden md:block h-full overflow-y-auto px-4 pb-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {searchResults.map((business, index) => (
                        <div key={business.id || index}>
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
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Location Prompt */}
          {!isAppModeActive && showLocationPrompt && (
            <div className="mt-8 bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 max-w-md mx-auto">
              <div className="flex items-center mb-4">
                <MapPin className="h-6 w-6 text-white mr-3" />
                <h3 className="font-poppins text-lg font-semibold text-white">
                  Enable Location
                </h3>
              </div>
              <p className="font-lora text-white text-opacity-90 mb-4">
                Allow location access to find businesses near you with accurate distances and travel times.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLocationPrompt(false)}
                  className="flex-1 bg-white bg-opacity-20 text-white font-poppins font-semibold py-2 px-4 rounded-lg hover:bg-opacity-30 transition-colors duration-200"
                >
                  Maybe Later
                </button>
                <button
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition(() => {
                      setShowLocationPrompt(false);
                    });
                  }}
                  className="flex-1 bg-primary-500 text-white font-poppins font-semibold py-2 px-4 rounded-lg hover:bg-primary-600 transition-colors duration-200"
                >
                  Enable Location
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Back Toast */}
        {backToastVisible && (
          <div className="back-toast">
            Returned to homepage
          </div>
        )}
      </section>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
          onSignup={handleSignupPromptSignup}
          onLogin={handleSignupPromptLogin}
          onClose={() => setShowSignupPrompt(false)}
          title="Search Requires Account"
          message="Create a free account to search for businesses and get personalized recommendations."
          signupButtonText="Sign Up Free For 200 Credits"
          loginButtonText="Already have an account? Log in"
        />
      )}
    </>
  );
};

export default AISearchHero;