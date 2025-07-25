import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Zap, X, ArrowLeft, Sliders, Info, AlertCircle, Loader2 } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../hooks/useAuth';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { CreditService } from '../services/creditService';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { calculateCompositeScore } from '../utils/similarityUtils';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import CreditInfoTooltip from './CreditInfoTooltip';

// Distance options for the slider - ONLY 10mi and 30mi
const DISTANCE_OPTIONS = [
  { value: 10, label: '10mi' },
  { value: 30, label: '30mi' }
];

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDisplayRadius, setSelectedDisplayRadius] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [lastSearchType, setLastSearchType] = useState<'platform' | 'semantic' | 'ai' | null>(null);
  const [showBackToast, setShowBackToast] = useState(false);
  const [allFetchedBusinesses, setAllFetchedBusinesses] = useState<any[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { latitude, longitude, error: locationError } = useGeolocation();

  // Auto-focus search input when app mode activates
  useEffect(() => {
    if (isAppModeActive && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isAppModeActive]);

  // Handle back gesture in app mode
  useEffect(() => {
    if (!isAppModeActive) return;

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      if (searchResults.length > 0) {
        // Clear search results first
        setSearchResults([]);
        setCurrentCardIndex(0);
        setLastSearchQuery('');
        setLastSearchType(null);
        setAllFetchedBusinesses([]);
        setShowBackToast(true);
        setTimeout(() => setShowBackToast(false), 2000);
      } else {
        // Exit app mode
        setIsAppModeActive(false);
      }
    };

    // Push a state when entering app mode
    window.history.pushState({ appMode: true }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAppModeActive, searchResults.length, setIsAppModeActive]);

  // Swipe handlers for card navigation
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
    trackTouch: true,
    preventScrollOnSwipe: true
  });

  // Apply dynamic search algorithm to filter and sort businesses
  const applyDynamicSearchAlgorithm = (allBusinesses: any[], maxRadius: number): any[] => {
    console.log('🔍 DEBUG: Calling applyDynamicSearchAlgorithm with maxRadius:', maxRadius, 'type:', typeof maxRadius);
    console.log('🔍 DEBUG: allFetchedBusinesses before filtering:');
    allBusinesses.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}: distance=${business.distance} (${typeof business.distance}), distanceType: ${typeof business.distance}`);
    });

    console.log('🔍 DEBUG: selectedDisplayRadius value:', selectedDisplayRadius, 'type:', typeof selectedDisplayRadius);

    // Apply distance filtering based on the selected radius
    let filteredBusinesses;
    if (maxRadius === 10) {
      // For 10mi setting: show businesses 0-10 miles away
      filteredBusinesses = allBusinesses.filter(business => {
        const distance = business.distance;
        const isWithinRange = distance !== undefined && distance <= 10;
        console.log(`🔍 DEBUG: Business ${business.name} - distance: ${distance}, within 0-10 miles: ${isWithinRange}`);
        return isWithinRange;
      });
    } else if (maxRadius === 30) {
      // For 30mi setting: show businesses 10-30 miles away (no overlap with 10mi setting)
      filteredBusinesses = allBusinesses.filter(business => {
        const distance = business.distance;
        const isWithinRange = distance !== undefined && distance > 10 && distance <= 30;
        console.log(`🔍 DEBUG: Business ${business.name} - distance: ${distance}, within 10-30 miles: ${isWithinRange}`);
        return isWithinRange;
      });
    } else {
      // Fallback: show all businesses within the specified radius
      filteredBusinesses = allBusinesses.filter(business => {
        const distance = business.distance;
        const isWithinRange = distance !== undefined && distance <= maxRadius;
        console.log(`🔍 DEBUG: Business ${business.name} - distance: ${distance}, within ${maxRadius} miles: ${isWithinRange}`);
        return isWithinRange;
      });
    }

    console.log(`🔍 DEBUG: Filtering businesses for ${maxRadius} mile radius:`);
    console.log(`🔍 DEBUG: Filtered businesses count: ${filteredBusinesses.length}`);
    filteredBusinesses.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}: distance=${business.distance} miles`);
    });

    // Calculate composite scores for ranking
    const businessesWithScores = filteredBusinesses.map(business => ({
      ...business,
      compositeScore: calculateCompositeScore({
        similarity: business.similarity,
        distance: business.distance,
        isOpen: business.isOpen,
        isPlatformBusiness: business.isPlatformBusiness
      })
    }));

    // Sort by composite score (highest first)
    businessesWithScores.sort((a, b) => b.compositeScore - a.compositeScore);

    // Return top 10 businesses for the selected distance range
    const topBusinesses = businessesWithScores.slice(0, 10);
    
    console.log(`🔍 DEBUG: Returning top ${topBusinesses.length} businesses for ${maxRadius} mile radius`);
    topBusinesses.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}: distance=${business.distance}mi, score=${business.compositeScore}`);
    });

    return topBusinesses;
  };

  // Handle search execution
  const handleSearch = async (query: string = searchQuery) => {
    if (!query.trim()) return;

    // Check authentication for credit-based searches
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setLastSearchQuery(query);

    try {
      console.log('🔍 Starting search for:', query);
      console.log('📍 User location:', { latitude, longitude });

      let allBusinesses: any[] = [];
      let searchType: 'platform' | 'semantic' | 'ai' = 'platform';

      // Step 1: Try platform-only search first (1 credit)
      console.log('🔍 Step 1: Trying platform-only search...');
      const hasCreditsForPlatform = await CreditService.hasEnoughCreditsForSearch(user.id, 'platform');
      
      if (!hasCreditsForPlatform) {
        throw new Error('Insufficient credits for search. Please purchase more credits or wait for your monthly refill.');
      }

      const platformBusinesses = await BusinessService.getBusinesses({
        search: query,
        userLatitude: latitude || undefined,
        userLongitude: longitude || undefined
      });

      console.log('✅ Platform search returned:', platformBusinesses.length, 'businesses');
      allBusinesses = [...platformBusinesses];

      // Deduct 1 credit for platform search
      await CreditService.deductSearchCredits(user.id, 'platform');
      searchType = 'platform';

      // Step 2: If platform search returns < 6 results, try semantic search (5 credits)
      if (allBusinesses.length < 6) {
        console.log('🧠 Step 2: Platform search returned < 6 results, trying semantic search...');
        
        const hasCreditsForSemantic = await CreditService.hasEnoughCreditsForSearch(user.id, 'semantic');
        
        if (hasCreditsForSemantic) {
          const semanticResult = await SemanticSearchService.searchByVibe(query, {
            latitude: latitude || undefined,
            longitude: longitude || undefined,
            matchThreshold: 0.3,
            matchCount: 50
          });

          if (semanticResult.success && semanticResult.results.length > 0) {
            console.log('✅ Semantic search returned:', semanticResult.results.length, 'businesses');
            
            // Merge semantic results with platform results (avoid duplicates)
            const existingIds = new Set(allBusinesses.map(b => b.id));
            const newSemanticBusinesses = semanticResult.results.filter(b => !existingIds.has(b.id));
            allBusinesses = [...allBusinesses, ...newSemanticBusinesses];
            
            // Deduct 5 credits for semantic search
            await CreditService.deductSearchCredits(user.id, 'semantic');
            searchType = 'semantic';
          }
        }
      }

      // Step 3: If still < 6 results, try AI-assisted search (10 credits)
      if (allBusinesses.length < 6) {
        console.log('🤖 Step 3: Still < 6 results, trying AI-assisted search...');
        
        const hasCreditsForAI = await CreditService.hasEnoughCreditsForSearch(user.id, 'ai');
        
        if (hasCreditsForAI) {
          const aiResponse = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: query,
              searchQuery: query,
              existingResultsCount: allBusinesses.length,
              numToGenerate: 50,
              latitude: latitude || undefined,
              longitude: longitude || undefined
            }),
            timeout: 30000
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.results.length > 0) {
              console.log('✅ AI search returned:', aiData.results.length, 'businesses');
              
              // Merge AI results with existing results (avoid duplicates)
              const existingIds = new Set(allBusinesses.map(b => b.id));
              const newAIBusinesses = aiData.results.filter((b: any) => !existingIds.has(b.id));
              allBusinesses = [...allBusinesses, ...newAIBusinesses];
              
              // Deduct 10 credits for AI search
              await CreditService.deductSearchCredits(user.id, 'ai');
              searchType = 'ai';
            }
          }
        }
      }

      console.log('🔍 Total businesses fetched:', allBusinesses.length);
      setAllFetchedBusinesses(allBusinesses);
      setLastSearchType(searchType);

      // Apply dynamic search algorithm to get the final results for display
      const finalResults = applyDynamicSearchAlgorithm(allBusinesses, selectedDisplayRadius);
      
      console.log('🎯 Final results for display:', finalResults.length);
      setSearchResults(finalResults);
      setCurrentCardIndex(0);

      // Activate app mode
      if (!isAppModeActive) {
        setIsAppModeActive(true);
      }

    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle distance slider change
  const handleDistanceChange = (newRadius: number) => {
    console.log('🔍 DEBUG: Distance slider changed to:', newRadius, 'miles');
    setSelectedDisplayRadius(newRadius);
    
    // If we have fetched businesses, re-apply the algorithm with the new radius
    if (allFetchedBusinesses.length > 0) {
      console.log('🔍 DEBUG: Re-applying algorithm with new radius:', newRadius);
      const newResults = applyDynamicSearchAlgorithm(allFetchedBusinesses, newRadius);
      setSearchResults(newResults);
      setCurrentCardIndex(0);
    }
  };

  // Handle business recommendation
  const handleRecommendBusiness = async (business: any) => {
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      const success = await BusinessService.recommendBusiness({
        name: business.name,
        address: business.address,
        location: business.address,
        category: business.category || 'General',
        description: business.shortDescription || business.description,
        image_url: business.image,
        recommended_by: user.id
      });

      if (success) {
        alert(`Thanks! We'll review ${business.name} for addition to our platform.`);
      } else {
        alert('Failed to submit recommendation. Please try again.');
      }
    } catch (error) {
      console.error('Error recommending business:', error);
      alert('Failed to submit recommendation. Please try again.');
    }
  };

  // Handle "Take Me There" action
  const handleTakeMeThere = async (business: any) => {
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    // Record the visit if it's a platform business
    if (business.isPlatformBusiness && business.id) {
      try {
        await BusinessService.recordBusinessVisit(business.id, user.id);
        console.log('✅ Business visit recorded');
      } catch (error) {
        console.error('❌ Failed to record business visit:', error);
      }
    }

    // Open Google Maps
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

  // Handle exit search
  const handleExitSearch = () => {
    setSearchResults([]);
    setCurrentCardIndex(0);
    setIsAppModeActive(false);
    setLastSearchQuery('');
    setLastSearchType(null);
    setAllFetchedBusinesses([]);
  };

  // Handle auth modal opening
  const handleOpenAuthModal = (mode: 'login' | 'signup') => {
    const event = new CustomEvent('open-auth-modal', {
      detail: { mode, forceMode: true }
    });
    document.dispatchEvent(event);
    setShowSignupPrompt(false);
  };

  return (
    <>
      <section className={`relative ${isAppModeActive ? 'fixed inset-0 z-50 bg-black' : 'py-20 bg-gradient-to-br from-primary-50 to-accent-50'}`}>
        {/* Background Image for App Mode */}
        {isAppModeActive && (
          <div className="absolute inset-0">
            <img
              src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920"
              alt="Background"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-60"></div>
          </div>
        )}

        <div className={`relative z-10 ${isAppModeActive ? 'h-full flex flex-col' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
          {/* Header Content */}
          {!isAppModeActive && (
            <div className="text-center mb-12">
              <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-neutral-900 mb-6">
                All Experiences
                <span className="block text-primary-500">Verified & Reviewed</span>
              </h1>
              <p className="font-lora text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
                Discover amazing places with AI-powered search. Find businesses that match your exact vibe and mood.
              </p>
            </div>
          )}

          {/* Search Interface */}
          <div className={`${isAppModeActive ? 'p-4' : 'max-w-2xl mx-auto'}`}>
            {/* Search Bar */}
            <div className={`${isAppModeActive ? 'search-bar-fixed' : ''} bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 mb-6`}>
              <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Describe the vibe you're looking for... (e.g., 'cozy coffee shop with wifi')"
                    className="w-full pl-12 pr-4 py-4 border border-neutral-200 rounded-xl font-lora text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={isSearching}
                  />
                </div>

                {/* Distance Slider */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-neutral-500" />
                    <span className="font-poppins text-sm font-medium text-neutral-700">
                      Within {selectedDisplayRadius} miles
                    </span>
                    <CreditInfoTooltip placement="top" />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {DISTANCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleDistanceChange(option.value)}
                        className={`px-3 py-1 rounded-full text-sm font-poppins font-medium transition-colors duration-200 ${
                          selectedDisplayRadius === option.value
                            ? 'bg-primary-500 text-white'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Button */}
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="w-full bg-gradient-to-r from-primary-500 to-accent-500 text-white py-4 px-6 rounded-xl font-poppins font-semibold text-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5 mr-2" />
                      Find My Vibe
                    </>
                  )}
                </button>
              </form>

              {/* Location Status */}
              {locationError && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                    <p className="font-lora text-sm text-yellow-700">
                      Location access denied. Using default location for search.
                    </p>
                  </div>
                </div>
              )}

              {/* Search Error */}
              {searchError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <p className="font-lora text-sm text-red-700">{searchError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Search Results in App Mode */}
            {isAppModeActive && searchResults.length > 0 && (
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-4 text-white">
                  <div>
                    <h2 className="font-poppins text-lg font-semibold">
                      Results for "{lastSearchQuery}"
                    </h2>
                    <p className="font-lora text-sm opacity-90">
                      {searchResults.length} businesses • {lastSearchType} search • Within {selectedDisplayRadius} miles
                    </p>
                  </div>
                  <button
                    onClick={handleExitSearch}
                    className="p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition-colors duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Card Navigation */}
                <div className="relative h-full pb-20" {...swipeHandlers}>
                  <div className="h-full overflow-hidden">
                    {searchResults.map((business, index) => (
                      <div
                        key={business.id}
                        className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
                          index === currentCardIndex
                            ? 'translate-x-0'
                            : index < currentCardIndex
                            ? '-translate-x-full'
                            : 'translate-x-full'
                        }`}
                      >
                        <div className="h-full overflow-y-auto px-4">
                          {business.isPlatformBusiness ? (
                            <PlatformBusinessCard
                              business={business}
                              onRecommend={handleRecommendBusiness}
                              onTakeMeThere={handleTakeMeThere}
                            />
                          ) : (
                            <AIBusinessCard
                              business={business}
                              onRecommend={handleRecommendBusiness}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Card Indicators */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                    {searchResults.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentCardIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                          index === currentCardIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* No Results Message in App Mode */}
            {isAppModeActive && searchResults.length === 0 && lastSearchQuery && !isSearching && (
              <div className="flex-1 flex items-center justify-center text-white text-center">
                <div>
                  <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="font-poppins text-xl font-semibold mb-2">
                    No businesses found
                  </h3>
                  <p className="font-lora opacity-90 mb-4">
                    Try adjusting your search or distance settings
                  </p>
                  <button
                    onClick={() => setSelectedDisplayRadius(selectedDisplayRadius === 10 ? 30 : 10)}
                    className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg hover:bg-opacity-30 transition-colors duration-200"
                  >
                    Try {selectedDisplayRadius === 10 ? '30' : '10'} miles
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Toast */}
        {showBackToast && (
          <div className="back-toast">
            Tap back again to exit search
          </div>
        )}
      </section>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
          onSignup={() => handleOpenAuthModal('signup')}
          onLogin={() => handleOpenAuthModal('login')}
          onClose={() => setShowSignupPrompt(false)}
        />
      )}
    </>
  );
};

export default AISearchHero;