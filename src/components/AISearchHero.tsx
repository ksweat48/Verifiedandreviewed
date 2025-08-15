import React, { useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import * as Icons from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../hooks/useAuth';
import { CreditService } from '../services/creditService';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';
import AIBusinessCard from './AIBusinessCard';
import PlatformBusinessCard from './PlatformBusinessCard';
import CreditInfoTooltip from './CreditInfoTooltip';
import CreditUsageInfo from './CreditUsageInfo';
import SignupPrompt from './SignupPrompt';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchType, setSearchType] = useState<'platform' | 'ai' | 'semantic'>('platform');
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  
  const { latitude, longitude, error: locationError } = useGeolocation();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Handle search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated before allowing search
    if (!isAuthenticated) {
      setShowSignupPrompt(true);
      return; // Stop execution here
    }
    
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentIndex(0);

    try {
      // Check if user has enough credits for search
      const hasEnoughCredits = await CreditService.hasEnoughCreditsForSearch(user?.id || '', 'platform');
      
      if (!hasEnoughCredits) {
        setShowSignupPrompt(true);
        setLoading(false);
        return;
      }

      // Deduct credits for search
      if (user?.id) {
        const deductionSuccess = await CreditService.deductSearchCredits(user.id, 'platform');
        if (!deductionSuccess) {
          setError('Failed to process search. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Log search activity
      if (user?.id) {
        ActivityService.logSearch(user.id, searchQuery, 'platform');
      }

      // First, try platform businesses
      console.log('🔍 Step 1: Searching platform businesses...');
      const platformBusinesses = await BusinessService.getBusinesses({
        search: searchQuery,
        userLatitude: latitude || undefined,
        userLongitude: longitude || undefined
      });

      console.log('✅ Platform search found', platformBusinesses.length, 'businesses');

      // Calculate accurate distances for platform businesses if we have user location
      let platformBusinessesWithDistances = platformBusinesses;
      if (platformBusinesses.length > 0 && latitude && longitude) {
        try {
          platformBusinessesWithDistances = await BusinessService.calculateBusinessDistances(
            platformBusinesses,
            latitude,
            longitude
          );
          console.log('✅ Updated platform businesses with accurate distances');
        } catch (distanceError) {
          console.warn('⚠️ Distance calculation failed, using placeholder values:', distanceError);
        }
      }

      // Transform platform businesses to match expected format
      const formattedPlatformBusinesses = platformBusinessesWithDistances.map(business => ({
        ...business,
        image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
        rating: business.sentiment_score ? business.sentiment_score / 20 : 4.5,
        shortDescription: business.short_description || business.description || `${business.name} is a ${business.category} located in ${business.location || business.address}`,
        isOpen: true,
        hours: business.hours || 'Hours not available',
        reviews: [],
        isPlatformBusiness: true,
        tags: business.tags || [],
        isExactMatch: business.name.toLowerCase().includes(searchQuery.toLowerCase()),
        similarity: 0.9
      }));

      // If we have 10+ platform results, use only platform businesses
      if (formattedPlatformBusinesses.length >= 10) {
        console.log('✅ Found sufficient platform businesses, using platform-only results');
        setSearchResults(formattedPlatformBusinesses.slice(0, 15));
        setSearchType('platform');
        setLoading(false);
        return;
      }

      // If we have some platform businesses but less than 10, try semantic search
      if (formattedPlatformBusinesses.length > 0 && formattedPlatformBusinesses.length < 10) {
        console.log('🧠 Step 2: Trying semantic search to supplement platform results...');
        
        try {
          const semanticResult = await SemanticSearchService.searchByVibe(searchQuery, {
            latitude: latitude || undefined,
            longitude: longitude || undefined,
            matchThreshold: 0.3,
            matchCount: 15 - formattedPlatformBusinesses.length
          });

          if (semanticResult.success && semanticResult.results.length > 0) {
            console.log('✅ Semantic search found', semanticResult.results.length, 'additional businesses');
            
            // Combine platform and semantic results
            const combinedResults = [
              ...formattedPlatformBusinesses,
              ...semanticResult.results
            ];
            
            setSearchResults(combinedResults.slice(0, 15));
            setSearchType('semantic');
            setLoading(false);
            return;
          }
        } catch (semanticError) {
          console.warn('⚠️ Semantic search failed, proceeding with AI search:', semanticError);
        }
      }

      // If we have fewer than 10 total results, use AI search
      console.log('🤖 Step 3: Using AI search for comprehensive results...');
      
      const response = await fetch('/.netlify/functions/ai-business-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('wp_token') || ''}`
        },
        body: JSON.stringify({
          prompt: searchQuery,
          searchQuery: searchQuery,
          existingResultsCount: formattedPlatformBusinesses.length,
          numToGenerate: 15 - formattedPlatformBusinesses.length,
          latitude: latitude || undefined,
          longitude: longitude || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'AI search failed');
      }

      const aiData = await response.json();
      
      if (aiData.success && aiData.results) {
        console.log('✅ AI search found', aiData.results.length, 'businesses');
        
        // Combine platform and AI results
        const combinedResults = [
          ...formattedPlatformBusinesses,
          ...aiData.results
        ];
        
        setSearchResults(combinedResults.slice(0, 15));
        setSearchType('ai');
      } else {
        throw new Error(aiData.message || 'No results found');
      }

    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle business recommendation
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

  // Handle "Take Me There" for platform businesses
  const handleTakeMeThere = (business: any) => {
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    // Record business visit
    if (user.id && business.id) {
      BusinessService.recordBusinessVisit(business.id, user.id);
    }

    // Navigate to business
    let mapsUrl;
    if (business.latitude && business.longitude) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
    } else if (business.address) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name)}`;
    }
    
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  // Swipe handlers for mobile navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex < searchResults.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    },
    onSwipedRight: () => {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true
  });

  // Navigation functions
  const goToNext = () => {
    if (currentIndex < searchResults.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Handle app mode toggle
  const handleAppModeToggle = () => {
    if (!isAppModeActive && hasSearched) {
      setIsAppModeActive(true);
    } else if (isAppModeActive) {
      setIsAppModeActive(false);
    }
  };

  // Handle signup/login from prompt
  const handleSignupFromPrompt = () => {
    const event = new CustomEvent('open-auth-modal', {
      detail: { mode: 'signup' }
    });
    document.dispatchEvent(event);
    setShowSignupPrompt(false);
  };

  const handleLoginFromPrompt = () => {
    const event = new CustomEvent('open-auth-modal', {
      detail: { mode: 'login' }
    });
    document.dispatchEvent(event);
    setShowSignupPrompt(false);
  };

  return (
    <>
      <section className={`relative transition-all duration-500 ${
        isAppModeActive 
          ? 'h-screen overflow-hidden' 
          : 'min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
      }`}>
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920"
            alt="Restaurant background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/70 to-slate-900/80"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Search Bar - Fixed at top in app mode */}
          <div className={`${isAppModeActive ? 'search-bar-fixed bg-gradient-to-r from-slate-900/95 via-purple-900/95 to-slate-900/95 backdrop-blur-sm' : 'flex-shrink-0'}`}>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {!isAppModeActive && (
                <div className="text-center mb-8">
                  <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-white mb-4">
                    Find Your Vibe
                  </h1>
                  <p className="font-lora text-xl md:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                    Discover businesses that match your mood and energy
                  </p>
                </div>
              )}

              {/* Search Form */}
              <form onSubmit={handleSearch} className="relative">
                <div className="relative">
                  <Icons.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="What vibe are you looking for? (e.g., cozy coffee shop, energetic workout)"
                    className="w-full pl-12 pr-32 py-4 bg-white/95 backdrop-blur-sm border border-white/20 rounded-2xl font-lora text-lg text-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-lg"
                  />
                  <button
                    type="submit"
                    disabled={loading || !searchQuery.trim()}
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 rounded-xl font-poppins font-semibold transition-all duration-200 ${
                      loading || !searchQuery.trim()
                        ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:shadow-lg hover:scale-105'
                    }`}
                  >
                    {loading ? (
                      <Icons.Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Search'
                    )}
                  </button>
                </div>
              </form>

              {/* Credit Info */}
              {user && (
                <div className="flex items-center justify-center mt-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center">
                    <Icons.Zap className="h-4 w-4 text-yellow-400 mr-2" />
                    <span className="font-poppins text-sm text-white mr-2">
                      {user.credits} credits
                    </span>
                    <CreditInfoTooltip placement="bottom" />
                  </div>
                </div>
              )}

              {/* Location Status */}
              {locationError && (
                <div className="mt-4 text-center">
                  <p className="font-lora text-sm text-white/70">
                    📍 Location access denied - showing general results
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Results Section */}
          {hasSearched && (
            <div className={`flex-1 ${isAppModeActive ? 'overflow-hidden' : ''}`}>
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Icons.Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
                    <p className="font-lora text-white text-lg">Finding your perfect vibe...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-md mx-auto px-4">
                    <Icons.AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <p className="font-lora text-white text-lg mb-4">{error}</p>
                    <button
                      onClick={() => {
                        setError(null);
                        setHasSearched(false);
                      }}
                      className="font-poppins bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors duration-200"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-md mx-auto px-4">
                    <Icons.Search className="h-12 w-12 text-white/60 mx-auto mb-4" />
                    <p className="font-lora text-white text-lg mb-4">
                      No businesses found matching "{searchQuery}"
                    </p>
                    <p className="font-lora text-white/70 text-sm mb-6">
                      Try a different search term or check your spelling
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setHasSearched(false);
                      }}
                      className="font-poppins bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors duration-200"
                    >
                      New Search
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative h-full">
                  {/* Desktop: Grid View */}
                  <div className={`hidden md:block ${isAppModeActive ? 'h-full overflow-y-auto' : ''}`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="font-cinzel text-2xl font-bold text-white mb-2">
                            Found {searchResults.length} matches for "{searchQuery}"
                          </h2>
                          <div className="flex items-center gap-4">
                            <span className="font-lora text-white/80">
                              Search type: {searchType === 'platform' ? 'Platform businesses' : searchType === 'semantic' ? 'Semantic + Platform' : 'AI + Platform'}
                            </span>
                            {latitude && longitude && (
                              <span className="font-lora text-white/80">
                                📍 Near your location
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {isAppModeActive && (
                          <button
                            onClick={() => setIsAppModeActive(false)}
                            className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors duration-200"
                          >
                            <Icons.X className="h-5 w-5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

                  {/* Mobile: Swipeable Cards */}
                  <div className={`md:hidden ${isAppModeActive ? 'h-full' : ''}`}>
                    <div className="relative h-full" {...swipeHandlers} ref={searchContainerRef}>
                      {/* Header */}
                      <div className="px-4 py-4 text-center">
                        <h2 className="font-cinzel text-xl font-bold text-white mb-1">
                          {searchResults.length} matches for "{searchQuery}"
                        </h2>
                        <p className="font-lora text-white/80 text-sm">
                          Swipe to explore • {currentIndex + 1} of {searchResults.length}
                        </p>
                      </div>

                      {/* Card Container */}
                      <div className="relative flex-1 px-4 pb-20">
                        <div className="relative h-full">
                          {searchResults.map((business, index) => (
                            <div
                              key={business.id || index}
                              className={`absolute inset-0 transition-transform duration-300 ${
                                index === currentIndex 
                                  ? 'translate-x-0 z-10' 
                                  : index < currentIndex 
                                    ? '-translate-x-full z-0' 
                                    : 'translate-x-full z-0'
                              }`}
                            >
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

                      {/* Navigation Buttons */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
                        <button
                          onClick={goToPrev}
                          disabled={currentIndex === 0}
                          className={`p-3 rounded-full transition-all duration-200 ${
                            currentIndex === 0
                              ? 'bg-white/20 text-white/50 cursor-not-allowed'
                              : 'bg-white/30 text-white hover:bg-white/40 active:scale-95'
                          }`}
                        >
                          <Icons.ChevronLeft className="h-6 w-6" />
                        </button>

                        <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                          <span className="font-poppins text-white font-semibold">
                            {currentIndex + 1} / {searchResults.length}
                          </span>
                        </div>

                        <button
                          onClick={goToNext}
                          disabled={currentIndex === searchResults.length - 1}
                          className={`p-3 rounded-full transition-all duration-200 ${
                            currentIndex === searchResults.length - 1
                              ? 'bg-white/20 text-white/50 cursor-not-allowed'
                              : 'bg-white/30 text-white hover:bg-white/40 active:scale-95'
                          }`}
                        >
                          <Icons.ChevronRight className="h-6 w-6" />
                        </button>
                      </div>

                      {/* App Mode Toggle */}
                      {hasSearched && !isAppModeActive && (
                        <button
                          onClick={handleAppModeToggle}
                          className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors duration-200"
                        >
                          <Icons.Maximize className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Credit Usage Info - Only show when not in app mode and user is logged in */}
          {!isAppModeActive && !hasSearched && user && (
            <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
              <CreditUsageInfo />
            </div>
          )}
        </div>
      </section>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
          onSignup={handleSignupFromPrompt}
          onLogin={handleLoginFromPrompt}
          onClose={() => setShowSignupPrompt(false)}
          title="Sign Up to Search"
          message="Create an account to discover businesses that match your vibe and mood."
          signupButtonText="Sign Up Free For 200 Credits"
          loginButtonText="Already have an account? Log in"
          benefits={[
            "200 free credits instantly",
            "50 free credits every month",
            "AI-powered vibe matching",
            "Save favorite businesses",
            "Earn credits for reviews"
          ]}
        />
      )}
    </>
  );
};

export default AISearchHero;