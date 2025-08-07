import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Zap, X, Loader2, Heart, Navigation, Globe, Phone } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { CreditService } from '../services/creditService';
import { ActivityService } from '../services/activityService';
import { UserService } from '../services/userService';
import AIBusinessCard from './AIBusinessCard';
import PlatformBusinessCard from './PlatformBusinessCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import CreditInfoTooltip from './CreditInfoTooltip';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { calculateCompositeScore } from '../utils/similarityUtils';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const { user } = useAuth();
  const { latitude, longitude, error: locationError } = useGeolocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // New state variables for search status display
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'noResults'>('idle');
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [currentResultsCount, setCurrentResultsCount] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus search input when app mode becomes active
  useEffect(() => {
    if (isAppModeActive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isAppModeActive]);

  // Handle search functionality
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const query = searchTerm.trim();
    if (!query) return;

    setLoading(true);
    setSearchError(null);
    setHasSearched(true);
    setCurrentIndex(0);
    
    // Set search status to searching and update current query
    setSearchStatus('searching');
    setCurrentSearchQuery(query);

    try {
      // Check if user has enough credits
      if (user) {
        const hasCredits = await CreditService.hasEnoughCreditsForSearch(user.id, 'platform');
        if (!hasCredits) {
          setSearchError('Insufficient credits. You need 2 credits to search.');
          setLoading(false);
          setSearchStatus('idle');
          return;
        }
      }

      let allResults: any[] = [];
      let usedSemanticSearch = false;
      let usedAISearch = false;

      // Step 1: Search platform businesses first
      console.log('🔍 Step 1: Searching platform businesses...');
      const platformResults = await BusinessService.getBusinesses({
        search: query,
        userLatitude: latitude || undefined,
        userLongitude: longitude || undefined
      });

      console.log('✅ Platform search found', platformResults.length, 'businesses');

      if (platformResults.length > 0) {
        // Transform platform businesses to match expected format
        const transformedPlatformResults = platformResults.map(business => ({
          ...business,
          image: business.image_url || '/verified and reviewed logo-coral copy copy.png',
          rating: business.rating || {
            thumbsUp: business.thumbs_up || 0,
            thumbsDown: business.thumbs_down || 0,
            sentimentScore: business.sentiment_score || 0
          },
          reviews: business.reviews || [],
          isPlatformBusiness: true,
          isOpen: true,
          hours: business.hours || 'Hours not available',
          tags: business.tags || [],
          similarity: 0.9 // High similarity for platform matches
        }));

        allResults.push(...transformedPlatformResults);
      }

      // Step 2: If we have fewer than 10 results, use semantic search
      if (allResults.length < 10) {
        console.log('🧠 Step 2: Using semantic search to find more results...');
        
        try {
          const semanticResults = await SemanticSearchService.searchByVibe(query, {
            latitude: latitude || undefined,
            longitude: longitude || undefined,
            matchThreshold: 0.3,
            matchCount: 10 - allResults.length
          });

          if (semanticResults.success && semanticResults.results.length > 0) {
            console.log('✅ Semantic search found', semanticResults.results.length, 'additional businesses');
            allResults.push(...semanticResults.results);
            usedSemanticSearch = true;
          }
        } catch (semanticError) {
          console.warn('⚠️ Semantic search failed, continuing with platform results only:', semanticError);
        }
      }

      // Step 3: If we still have fewer than 7 results, use AI search
      if (allResults.length < 7) {
        console.log('🤖 Step 3: Using AI search to generate more results...');
        
        try {
          const aiResponse = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: query,
              searchQuery: query,
              existingResultsCount: allResults.length,
              numToGenerate: 7 - allResults.length,
              latitude: latitude || undefined,
              longitude: longitude || undefined
            }),
            timeout: 25000
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.results.length > 0) {
              console.log('✅ AI search found', aiData.results.length, 'additional businesses');
              allResults.push(...aiData.results);
              usedAISearch = true;
            }
          }
        } catch (aiError) {
          console.warn('⚠️ AI search failed, continuing with existing results:', aiError);
        }
      }

      // Calculate accurate distances if user location is available
      if (allResults.length > 0 && latitude && longitude) {
        try {
          const updatedResults = await BusinessService.calculateBusinessDistances(
            allResults,
            latitude,
            longitude
          );
          allResults = updatedResults;
        } catch (distanceError) {
          console.warn('⚠️ Distance calculation failed, using fallback values:', distanceError);
        }
      }

      // Sort results by composite score
      const sortedResults = allResults
        .map(business => ({
          ...business,
          compositeScore: calculateCompositeScore(business)
        }))
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, 15); // Limit to 15 results

      setBusinesses(sortedResults);

      // Deduct credits after successful search
      if (user) {
        const searchType = usedAISearch ? 'ai' : usedSemanticSearch ? 'semantic' : 'platform';
        await CreditService.deductSearchCredits(user.id, searchType);
        await ActivityService.logSearch(user.id, query, searchType);
        
        // Trigger auth state change to refresh credits display
        window.dispatchEvent(new Event('auth-state-changed'));
      }

      // Update search status based on results
      if (sortedResults.length > 0) {
        setSearchStatus('found');
        setCurrentResultsCount(sortedResults.length);
      } else {
        setSearchStatus('noResults');
        setCurrentResultsCount(0);
      }

      // Auto-clear the search status after 3 seconds
      setTimeout(() => {
        setSearchStatus('idle');
        setCurrentSearchQuery('');
        setCurrentResultsCount(0);
      }, 3000);

    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Search failed. Please try again.');
      setSearchStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  // Clear search and exit app mode
  const clearSearch = () => {
    setSearchTerm('');
    setBusinesses([]);
    setHasSearched(false);
    setSearchError(null);
    setCurrentIndex(0);
    setIsAppModeActive(false);
    setSearchStatus('idle');
    setCurrentSearchQuery('');
    setCurrentResultsCount(0);
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
      if (currentIndex < businesses.length - 1) {
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

  return (
    <div className={`relative transition-all duration-500 ${
      isAppModeActive 
        ? 'min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
        : 'min-h-[60vh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
    }`}>
      
      {/* Search Bar */}
      <div className={`${isAppModeActive ? 'search-bar-fixed' : ''} bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 sm:px-6 lg:px-8 ${isAppModeActive ? 'py-4' : 'py-16'}`}>
        <div className="max-w-4xl mx-auto">
          {!isAppModeActive && (
            <div className="text-center mb-8">
              <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-white mb-4">
                Find Your Vibe
              </h1>
              <p className="font-lora text-xl text-white/80 max-w-2xl mx-auto">
                Discover businesses that match your mood and preferences with AI-powered search
              </p>
            </div>
          )}

          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-white/60" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="What vibe are you looking for? (e.g., cozy coffee spot, energetic workout)"
                className="w-full pl-12 pr-20 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white placeholder-white/60 font-lora text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={loading}
              />
              
              {/* Clear button */}
              {(searchTerm || hasSearched) && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-12 top-1/2 transform -translate-y-1/2 p-2 text-white/60 hover:text-white transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              
              {/* Search button */}
              <button
                type="submit"
                disabled={loading || !searchTerm.trim()}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary-500 text-white p-3 rounded-xl hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>
            </div>
          </form>

          {/* Search Status Display with Coral Color */}
          <div className="mt-4 text-center min-h-[24px]">
            {searchStatus === 'searching' && (
              <p className="font-lora text-white/80 text-sm">
                <span className="text-white/80">searched: "</span>
                <span className="text-primary-500">{currentSearchQuery}</span>
                <span className="text-white/80">"</span>
              </p>
            )}
            {searchStatus === 'found' && (
              <p className="font-lora text-white/80 text-sm">
                <span className="text-white/80">searched: "</span>
                <span className="text-primary-500">{currentSearchQuery}</span>
                <span className="text-white/80">" ({currentResultsCount} results)</span>
              </p>
            )}
            {searchStatus === 'noResults' && (
              <p className="font-lora text-white/80 text-sm">
                <span className="text-white/80">searched: "</span>
                <span className="text-primary-500">{currentSearchQuery}</span>
                <span className="text-white/80">" (no results)</span>
              </p>
            )}
          </div>

          {/* Location and Credits Info */}
          <div className="flex items-center justify-center gap-4 mt-4">
            {latitude && longitude ? (
              <div className="flex items-center text-white/60 text-sm">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="font-lora">Location detected</span>
              </div>
            ) : (
              <div className="flex items-center text-white/60 text-sm">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="font-lora">Enable location for better results</span>
              </div>
            )}
            
            {user && (
              <div className="flex items-center text-white/60 text-sm">
                <Zap className="h-4 w-4 mr-1" />
                <span className="font-lora">{user.credits} credits</span>
                <CreditInfoTooltip placement="bottom" />
              </div>
            )}
          </div>

          {/* Search Error */}
          {searchError && (
            <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-center">
              <p className="font-lora text-red-200 text-sm">{searchError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div 
          ref={resultsContainerRef}
          className={`${isAppModeActive ? 'flex-1 overflow-hidden' : 'py-8'} bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900`}
          {...(isAppModeActive ? swipeHandlers : {})}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-spin" />
                <h3 className="font-poppins text-xl font-semibold text-white mb-2">
                  Finding your vibe...
                </h3>
                <p className="font-lora text-white/80">
                  Searching platform businesses and generating AI recommendations
                </p>
              </div>
            ) : businesses.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-white/60" />
                </div>
                <h3 className="font-poppins text-xl font-semibold text-white mb-2">
                  No businesses found
                </h3>
                <p className="font-lora text-white/80 mb-4">
                  Try a different search term or check your location settings
                </p>
                <button
                  onClick={clearSearch}
                  className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                >
                  Try Another Search
                </button>
              </div>
            ) : (
              <>
                {/* Desktop: Grid Layout */}
                <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {businesses.map((business, index) => (
                    business.isPlatformBusiness ? (
                      <PlatformBusinessCard
                        key={`${business.id}-${index}`}
                        business={business}
                        onRecommend={handleRecommend}
                        onTakeMeThere={handleTakeMeThere}
                      />
                    ) : (
                      <AIBusinessCard
                        key={`${business.id}-${index}`}
                        business={business}
                        onRecommend={handleRecommend}
                      />
                    )
                  ))}
                </div>

                {/* Mobile: Swipeable Cards */}
                <div className="md:hidden">
                  {businesses.length > 0 && (
                    <div className="relative">
                      <div className="overflow-hidden">
                        <div 
                          className="flex transition-transform duration-300 ease-out"
                          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                        >
                          {businesses.map((business, index) => (
                            <div key={`${business.id}-${index}`} className="w-full flex-shrink-0 px-4">
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

                      {/* Mobile Navigation Dots */}
                      <div className="flex justify-center mt-6 gap-2">
                        {businesses.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                              index === currentIndex ? 'bg-primary-500' : 'bg-white/30'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Mobile Card Counter */}
                      <div className="text-center mt-4">
                        <span className="font-lora text-white/60 text-sm">
                          {currentIndex + 1} of {businesses.length}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
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
          onClose={() => setShowSignupPrompt(false)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onAuthSuccess={() => {
          setAuthModalOpen(false);
          window.dispatchEvent(new Event('auth-state-changed'));
        }}
      />
    </div>
  );
};

export default AISearchHero;