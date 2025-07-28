import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, X, Zap, MapPin, Navigation, Heart, ThumbsUp, RefreshCw, AlertCircle } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useGeolocation } from '../hooks/useGeolocation';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { CreditService } from '../services/creditService';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';
import { useAuth } from '../hooks/useAuth';
import { calculateCompositeScore } from '../utils/similarityUtils';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import CreditInfoTooltip from './CreditInfoTooltip';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showBackToast, setShowBackToast] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchTerm, setLastSearchTerm] = useState('');
  const [searchStats, setSearchStats] = useState<{
    platformCount: number;
    aiCount: number;
    totalResults: number;
    searchType: string;
    usedSemanticSearch: boolean;
    usedAI: boolean;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user, isAuthenticated } = useAuth();
  const { latitude, longitude, error: locationError } = useGeolocation();

  // Focus search input when app mode becomes active
  useEffect(() => {
    if (isAppModeActive && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isAppModeActive]);

  // Swipe handlers for card navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => nextCard(),
    onSwipedRight: () => prevCard(),
    trackMouse: true,
    preventScrollOnSwipe: true
  });

  const nextCard = () => {
    if (searchResults.length > 1) {
      setCurrentCardIndex((prev) => (prev + 1) % searchResults.length);
    }
  };

  const prevCard = () => {
    if (searchResults.length > 1) {
      setCurrentCardIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    }
  };

  // Handle back gesture (swipe down)
  const handleBackGesture = () => {
    if (isAppModeActive) {
      setIsAppModeActive(false);
      setShowBackToast(true);
      setTimeout(() => setShowBackToast(false), 2000);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    console.log('🔍 Starting comprehensive search for:', searchTerm);
    setIsSearching(true);
    setSearchError(null);
    setLastSearchTerm(searchTerm);
    setCurrentCardIndex(0);
    
    try {
      // Step 1: Comprehensive Platform Business Search
      // This ensures ALL relevant platform businesses are found, regardless of conversational phrasing
      console.log('🏢 Step 1: Comprehensive platform business search...');
      let platformBusinesses: any[] = [];
      
      try {
        // Use the existing getBusinesses function with search parameter
        // This searches across name, description, category, tags, location, etc.
        const comprehensivePlatformResults = await BusinessService.getBusinesses({
          search: searchTerm.trim(),
          userLatitude: latitude || undefined,
          userLongitude: longitude || undefined
        });
        
        console.log('✅ Found', comprehensivePlatformResults.length, 'platform businesses via comprehensive search');
        
        // Mark all as platform businesses and add to results
        platformBusinesses = comprehensivePlatformResults.map(business => ({
          ...business,
          isPlatformBusiness: true,
          isExactMatch: false // Will be updated below if exact match found
        }));
        
      } catch (error) {
        console.error('❌ Error in comprehensive platform search:', error);
        // Continue with other search methods even if this fails
      }

      // Step 2: Check for Exact Match (for special priority)
      console.log('🎯 Step 2: Checking for exact match...');
      let exactMatchBusiness = null;
      
      try {
        exactMatchBusiness = await BusinessService.getBusinessByName(searchTerm);
        
        if (exactMatchBusiness) {
          console.log('✅ [EXACT MATCH] Found business:', exactMatchBusiness.name);
          
          // Update the exact match business in platformBusinesses array
          const exactMatchIndex = platformBusinesses.findIndex(b => b.id === exactMatchBusiness.id);
          if (exactMatchIndex >= 0) {
            // Update existing entry
            platformBusinesses[exactMatchIndex] = {
              ...platformBusinesses[exactMatchIndex],
              isExactMatch: true
            };
          } else {
            // Add as new entry if not found in comprehensive search
            platformBusinesses.unshift({
              ...exactMatchBusiness,
              isPlatformBusiness: true,
              isExactMatch: true
            });
          }
        }
      } catch (error) {
        console.error('❌ Error checking exact match:', error);
      }

      // Step 3: Semantic Search for additional platform businesses
      console.log('🧠 Step 3: Semantic search for platform businesses...');
      
      try {
        const semanticResults = await SemanticSearchService.searchByVibe(searchTerm, {
          latitude: latitude || undefined,
          longitude: longitude || undefined,
          matchThreshold: 0.3,
          matchCount: 10
        });
        
        if (semanticResults.success && semanticResults.results.length > 0) {
          console.log('✅ Found', semanticResults.results.length, 'businesses via semantic search');
          
          // Add semantic results to platform businesses (deduplicate by ID)
          const existingIds = new Set(platformBusinesses.map(b => b.id));
          
          semanticResults.results.forEach(business => {
            if (!existingIds.has(business.id)) {
              platformBusinesses.push({
                ...business,
                isPlatformBusiness: true,
                isExactMatch: false
              });
            }
          });
        }
      } catch (error) {
        console.error('❌ Error in semantic search:', error);
      }

      console.log('📊 Total platform businesses found:', platformBusinesses.length);

      // Step 4: Fetch reviews for platform businesses
      console.log('📝 Step 4: Fetching reviews for platform businesses...');
      const platformBusinessesWithReviews = await Promise.all(
        platformBusinesses.map(async (business) => {
          try {
            const { ReviewService } = await import('../services/reviewService');
            const reviews = await ReviewService.getBusinessReviews(business.id);
            
            const formattedReviews = reviews.map(review => ({
              text: review.review_text || 'Great experience!',
              author: review.profiles?.name || 'Anonymous',
              authorImage: review.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100',
              images: (review.image_urls || []).map(url => ({ url })),
              thumbsUp: review.rating >= 4
            }));
            
            return {
              ...business,
              image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              rating: {
                thumbsUp: business.thumbs_up || 0,
                thumbsDown: business.thumbs_down || 0,
                sentimentScore: business.sentiment_score || 0
              },
              isOpen: true,
              reviews: formattedReviews,
              distance: business.distance || 999999,
              duration: business.duration || 999999
            };
          } catch (error) {
            console.error(`Error fetching reviews for business ${business.id}:`, error);
            return {
              ...business,
              image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              rating: {
                thumbsUp: business.thumbs_up || 0,
                thumbsDown: business.thumbs_down || 0,
                sentimentScore: business.sentiment_score || 0
              },
              isOpen: true,
              reviews: [],
              distance: business.distance || 999999,
              duration: business.duration || 999999
            };
          }
        })
      );

      console.log('✅ Platform businesses with reviews loaded');

      // Step 5: Determine if AI augmentation is needed
      const platformBusinessesWithinRadius = platformBusinessesWithReviews.filter(business => 
        business.distance <= 10
      );
      
      console.log('📍 Platform businesses within 10 miles:', platformBusinessesWithinRadius.length);

      let allBusinesses = [...platformBusinessesWithinRadius];
      let usedAI = false;

      // Only use AI if we have fewer than 6 platform businesses within radius
      if (platformBusinessesWithinRadius.length < 6) {
        console.log('🤖 Step 5: Augmenting with AI businesses (need more results)...');
        
        try {
          // Check if user has enough credits for AI search
          const hasCredits = user ? await CreditService.hasEnoughCreditsForSearch(user.id, 'ai') : false;
          
          if (!user || !hasCredits) {
            console.log('⚠️ User not authenticated or insufficient credits for AI search');
            if (!user) {
              setShowSignupPrompt(true);
            }
          } else {
            // Deduct credits for AI search
            const creditDeducted = await CreditService.deductSearchCredits(user.id, 'ai');
            
            if (creditDeducted) {
              // Log AI search activity
              ActivityService.logSearch(user.id, searchTerm, 'ai');
              
              const aiResponse = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: searchTerm,
                  searchQuery: searchTerm,
                  existingResultsCount: platformBusinessesWithinRadius.length,
                  numToGenerate: Math.max(1, 6 - platformBusinessesWithinRadius.length),
                  latitude: latitude || undefined,
                  longitude: longitude || undefined
                }),
                timeout: 25000
              });

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                if (aiData.success && aiData.results) {
                  console.log('✅ AI search returned', aiData.results.length, 'businesses');
                  
                  const aiBusinesses = aiData.results
                    .filter((business: any) => business.distance <= 10)
                    .map((business: any) => ({
                      ...business,
                      isPlatformBusiness: false
                    }));
                  
                  allBusinesses = [...allBusinesses, ...aiBusinesses];
                  usedAI = true;
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ Error in AI search:', error);
        }
      }

      // Step 6: Apply Dynamic Search Algorithm for final ranking
      console.log('🏆 Step 6: Applying dynamic search algorithm...');
      
      const rankedBusinesses = allBusinesses.map(business => {
        let compositeScore;
        
        if (business.isExactMatch) {
          // Exact matches get the highest priority
          compositeScore = 2;
          console.log(`🎯 [EXACT MATCH] ${business.name} (score: ${compositeScore})`);
        } else {
          // Calculate composite score for all other businesses
          compositeScore = calculateCompositeScore({
            similarity: business.similarity,
            distance: business.distance,
            isOpen: business.isOpen,
            isPlatformBusiness: business.isPlatformBusiness
          });
          
          console.log(`📊 ${business.name} [${business.isPlatformBusiness ? 'PLATFORM' : 'AI'}] (score: ${compositeScore.toFixed(3)}, similarity: ${business.similarity ? Math.round(business.similarity * 100) + '%' : 'N/A'}, ${business.distance?.toFixed(1)}mi)`);
        }
        
        return {
          ...business,
          compositeScore
        };
      });

      // Sort by composite score (highest first)
      rankedBusinesses.sort((a, b) => b.compositeScore - a.compositeScore);
      
      console.log('🏆 Final ranking:');
      rankedBusinesses.forEach((business, index) => {
        console.log(`${index + 1}. ${business.name} [${business.isPlatformBusiness ? 'PLATFORM' : 'AI'}] (score: ${business.compositeScore.toFixed(3)}, ${business.distance?.toFixed(1)}mi)`);
      });

      setSearchResults(rankedBusinesses);
      
      // Update search stats
      const platformCount = rankedBusinesses.filter(b => b.isPlatformBusiness).length;
      const aiCount = rankedBusinesses.filter(b => !b.isPlatformBusiness).length;
      
      setSearchStats({
        platformCount,
        aiCount,
        totalResults: rankedBusinesses.length,
        searchType: platformCount > 0 ? (usedAI ? 'hybrid' : 'platform-only') : 'ai-only',
        usedSemanticSearch: true,
        usedAI
      });

      // Activate app mode if not already active
      if (!isAppModeActive) {
        setIsAppModeActive(true);
      }

    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
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
        alert(`${business.name} has been saved to your favorites!`);
      } else {
        alert('Failed to save recommendation. Please try again.');
      }
    } catch (error) {
      console.error('Error saving recommendation:', error);
      alert('Failed to save recommendation. Please try again.');
    }
  };

  const handleTakeMeThere = async (business: any) => {
    if (user) {
      try {
        await BusinessService.recordBusinessVisit(business.id, user.id);
      } catch (error) {
        console.error('Error recording business visit:', error);
      }
    }

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

  const handleExitSearch = () => {
    setIsAppModeActive(false);
    setSearchResults([]);
    setCurrentCardIndex(0);
    setSearchStats(null);
    setSearchError(null);
  };

  const handleAuthSuccess = (user: any) => {
    setShowSignupPrompt(false);
    setShowAuthModal(false);
  };

  if (!isAppModeActive) {
    return (
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920')`,
          }}
        >
          <div className="absolute inset-0 hero-background-blur"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-8">
            <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-white mb-6 text-shadow">
              All Experiences
              <br />
              <span className="text-primary-400">Verified & Reviewed</span>
            </h1>
            <p className="font-lora text-xl md:text-2xl text-white/90 max-w-2xl mx-auto text-shadow">
              Discover amazing places with AI-powered search and verified reviews
            </p>
          </div>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-neutral-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Find cozy coffee shops, romantic dinners, energetic workouts..."
                className="w-full pl-12 pr-20 py-4 bg-white/95 backdrop-blur-sm border border-white/20 rounded-2xl font-lora text-lg text-neutral-800 placeholder-neutral-500 focus:ring-4 focus:ring-primary-500/30 focus:border-primary-500 focus:outline-none shadow-2xl"
                disabled={isSearching}
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  type="button"
                  className="p-3 text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
                  aria-label="Voice search"
                >
                  <Mic className="h-5 w-5" />
                </button>
                <button
                  type="submit"
                  disabled={isSearching || !searchTerm.trim()}
                  className="mr-2 p-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Search"
                >
                  {isSearching ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Search className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-center">
            <CreditInfoTooltip />
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden">
      {/* Fixed Search Bar */}
      <div className="search-bar-fixed">
        <div className="px-4 py-3">
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-neutral-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for businesses..."
              className="w-full pl-10 pr-20 py-3 border border-neutral-200 rounded-xl font-lora text-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
              disabled={isSearching}
            />
            <div className="absolute inset-y-0 right-0 flex items-center">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isSearching || !searchTerm.trim()}
                className="mr-2 p-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50"
              >
                {isSearching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Search Results */}
      <div className="pt-20 h-full overflow-hidden">
        {isSearching ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white">
              <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-primary-400" />
              <h3 className="font-poppins text-xl font-semibold mb-2">Searching...</h3>
              <p className="font-lora text-white/80">Finding the best matches for "{lastSearchTerm}"</p>
            </div>
          </div>
        ) : searchError ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center text-white max-w-md">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <h3 className="font-poppins text-xl font-semibold mb-2">Search Error</h3>
              <p className="font-lora text-white/80 mb-4">{searchError}</p>
              <button
                onClick={() => setSearchError(null)}
                className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center text-white max-w-md">
              <Search className="h-12 w-12 mx-auto mb-4 text-white/60" />
              <h3 className="font-poppins text-xl font-semibold mb-2">No Results Found</h3>
              <p className="font-lora text-white/80">Try a different search term or check your location settings.</p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Search Stats */}
            {searchStats && (
              <div className="px-4 py-2 bg-black/50 text-white">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-lora">
                    {searchStats.totalResults} results • {searchStats.platformCount} platform • {searchStats.aiCount} AI
                  </span>
                  <span className="font-poppins text-xs opacity-75">
                    {searchStats.searchType}
                  </span>
                </div>
              </div>
            )}

            {/* Cards Container */}
            <div className="flex-1 relative" {...swipeHandlers}>
              <div className="absolute inset-0 px-4 py-4">
                {searchResults.map((business, index) => (
                  <div
                    key={business.id}
                    className={`absolute inset-0 transition-transform duration-300 ${
                      index === currentCardIndex
                        ? 'transform translate-x-0'
                        : index < currentCardIndex
                        ? 'transform -translate-x-full'
                        : 'transform translate-x-full'
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

            {/* Navigation Dots */}
            {searchResults.length > 1 && (
              <div className="flex justify-center py-4 space-x-2">
                {searchResults.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentCardIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                      index === currentCardIndex ? 'bg-white' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Exit Button */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <button
                onClick={handleExitSearch}
                className="bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full font-poppins font-semibold hover:bg-white/30 transition-all duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Exit Search
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Back Toast */}
      {showBackToast && (
        <div className="back-toast">
          Swipe down to exit search
        </div>
      )}

      {/* Signup Prompt */}
      {showSignupPrompt && (
        <SignupPrompt
          onSignup={() => {
            setShowSignupPrompt(false);
            setAuthMode('signup');
            setShowAuthModal(true);
          }}
          onLogin={() => {
            setShowSignupPrompt(false);
            setAuthMode('login');
            setShowAuthModal(true);
          }}
          onClose={() => setShowSignupPrompt(false)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default AISearchHero;