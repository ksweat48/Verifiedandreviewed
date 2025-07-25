import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Zap, Sparkles, Navigation, X, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useGeolocation } from '../hooks/useGeolocation';
import { UserService } from '../services/userService';
import { CreditService } from '../services/creditService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { calculateCompositeScore } from '../utils/similarityUtils';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import CreditInfoTooltip from './CreditInfoTooltip';
import type { User } from '../types/user';

// Distance options for the slider (only 10 and 30 miles)
const DISTANCE_OPTIONS = [10, 30];

// AI Search Service
class AISearchService {
  static async searchBusinesses(
    prompt: string,
    numToGenerate: number = 50, // Increased from 20 to 50
    latitude?: number,
    longitude?: number
  ) {
    try {
      const response = await fetch('/.netlify/functions/ai-business-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          numToGenerate,
          latitude,
          longitude
        })
      });

      if (!response.ok) {
        throw new Error(`AI search failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('AI Search Service Error:', error);
      throw error;
    }
  }
}

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentBusinessIndex, setCurrentBusinessIndex] = useState(0);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [maxRadius, setMaxRadius] = useState(10);
  const [showDistanceOptions, setShowDistanceOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'platform' | 'semantic' | 'ai'>('platform');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { latitude, longitude, error: locationError } = useGeolocation();

  // Check for current user on component mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await UserService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error checking user:', error);
      }
    };
    
    checkUser();
    
    // Listen for auth state changes
    const handleAuthStateChange = () => {
      checkUser();
    };
    
    window.addEventListener('auth-state-changed', handleAuthStateChange);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, []);

  // Apply dynamic search algorithm with updated distribution logic
  const applyDynamicSearchAlgorithm = (allBusinesses: any[], maxRadius: number) => {
    console.log('🔍 DEBUG: applyDynamicSearchAlgorithm called with:', {
      totalBusinesses: allBusinesses.length,
      maxRadius: maxRadius,
      businessDistances: allBusinesses.map(b => ({ name: b.name, distance: b.distance }))
    });

    // Calculate composite scores for all businesses
    const businessesWithScores = allBusinesses.map(business => ({
      ...business,
      compositeScore: calculateCompositeScore({
        similarity: business.similarity,
        distance: business.distance,
        isOpen: business.isOpen,
        isPlatformBusiness: business.isPlatformBusiness
      })
    }));

    // Sort all businesses by composite score (highest first)
    businessesWithScores.sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0));

    let finalBusinesses: any[] = [];

    if (maxRadius === 10) {
      // For 10mi setting: Show only businesses within 0-10 miles (top 10)
      const within10Miles = businessesWithScores.filter(business => 
        business.distance !== undefined && business.distance <= 10
      );
      
      finalBusinesses = within10Miles.slice(0, 10);
      
      console.log('🎯 DEBUG: 10mi setting - businesses within 0-10 miles:', {
        totalWithin10: within10Miles.length,
        selected: finalBusinesses.length,
        selectedNames: finalBusinesses.map(b => `${b.name} (${b.distance}mi)`)
      });
      
    } else if (maxRadius === 30) {
      // For 30mi setting: Show only businesses within 10-30 miles (top 10)
      const between10And30Miles = businessesWithScores.filter(business => 
        business.distance !== undefined && business.distance > 10 && business.distance <= 30
      );
      
      finalBusinesses = between10And30Miles.slice(0, 10);
      
      console.log('🎯 DEBUG: 30mi setting - businesses within 10-30 miles:', {
        totalBetween10And30: between10And30Miles.length,
        selected: finalBusinesses.length,
        selectedNames: finalBusinesses.map(b => `${b.name} (${b.distance}mi)`)
      });
    }

    console.log('🎯 DEBUG: Final businesses selected:', {
      count: finalBusinesses.length,
      averageDistance: finalBusinesses.length > 0 
        ? (finalBusinesses.reduce((sum, b) => sum + (b.distance || 0), 0) / finalBusinesses.length).toFixed(1)
        : 0,
      averageCompositeScore: finalBusinesses.length > 0
        ? (finalBusinesses.reduce((sum, b) => sum + (b.compositeScore || 0), 0) / finalBusinesses.length).toFixed(3)
        : 0
    });

    return finalBusinesses;
  };

  // Handle search with improved error handling and user feedback
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const query = searchQuery.trim();
    if (!query) return;

    setError(null);
    setIsSearching(true);
    setIsAppModeActive(true);
    setCurrentBusinessIndex(0);

    try {
      console.log('🔍 Starting search for:', query);
      console.log('📍 User location:', { latitude, longitude });
      console.log('📏 Max radius:', maxRadius, 'miles');

      let allBusinesses: any[] = [];
      let usedSemanticSearch = false;
      let usedAISearch = false;
      let searchTypeUsed = 'platform';

      // Step 1: Try semantic search first (if user is authenticated)
      if (currentUser) {
        console.log('🧠 Attempting semantic search...');
        
        // Check if user has enough credits for semantic search
        const hasSemanticCredits = await CreditService.hasEnoughCreditsForSearch(currentUser.id, 'semantic');
        
        if (hasSemanticCredits) {
          try {
            const semanticResults = await SemanticSearchService.searchByVibe(query, {
              latitude,
              longitude,
              matchThreshold: 0.3,
              matchCount: 50 // Increased from 20 to 50
            });

            if (semanticResults.success && semanticResults.results.length > 0) {
              console.log('✅ Semantic search successful:', semanticResults.results.length, 'results');
              allBusinesses = [...allBusinesses, ...semanticResults.results];
              usedSemanticSearch = true;
              searchTypeUsed = 'semantic';
              
              // Deduct credits for semantic search
              await CreditService.deductSearchCredits(currentUser.id, 'semantic');
            } else {
              console.log('⚠️ Semantic search returned no results');
            }
          } catch (semanticError) {
            console.warn('⚠️ Semantic search failed:', semanticError);
          }
        } else {
          console.log('💳 Insufficient credits for semantic search');
        }
      }

      // Step 2: If we don't have enough results, try AI-assisted search
      if (allBusinesses.length < 6) {
        console.log('🤖 Attempting AI-assisted search...');
        
        // Check if user has enough credits for AI search
        const hasAICredits = currentUser 
          ? await CreditService.hasEnoughCreditsForSearch(currentUser.id, 'ai')
          : false;

        if (!currentUser) {
          // Show signup prompt for non-authenticated users
          setShowSignupPrompt(true);
          setIsSearching(false);
          return;
        }

        if (hasAICredits) {
          try {
            const aiResponse = await AISearchService.searchBusinesses(
              query,
              50, // Increased from 20 to 50
              latitude,
              longitude
            );

            if (aiResponse.success && aiResponse.results.length > 0) {
              console.log('✅ AI search successful:', aiResponse.results.length, 'results');
              allBusinesses = [...allBusinesses, ...aiResponse.results];
              usedAISearch = true;
              searchTypeUsed = 'ai';
              
              // Deduct credits for AI search
              await CreditService.deductSearchCredits(currentUser.id, 'ai');
            } else {
              console.log('⚠️ AI search returned no results');
            }
          } catch (aiError) {
            console.warn('⚠️ AI search failed:', aiError);
          }
        } else {
          console.log('💳 Insufficient credits for AI search');
          setError('Insufficient credits for AI-powered search. Please add more credits or try a simpler search.');
          setIsSearching(false);
          return;
        }
      }

      // Step 3: Apply dynamic search algorithm with new distribution logic
      const finalBusinesses = applyDynamicSearchAlgorithm(allBusinesses, maxRadius);

      console.log('🎯 Final search results:', {
        totalFetched: allBusinesses.length,
        finalCount: finalBusinesses.length,
        searchType: searchTypeUsed,
        usedSemantic: usedSemanticSearch,
        usedAI: usedAISearch,
        maxRadius: maxRadius
      });

      setBusinesses(finalBusinesses);
      setSearchResults({
        query,
        totalResults: finalBusinesses.length,
        usedSemanticSearch,
        usedAISearch,
        searchType: searchTypeUsed
      });
      setSearchType(searchTypeUsed);

      // If no results found, show helpful message
      if (finalBusinesses.length === 0) {
        setError(`No businesses found within ${maxRadius === 10 ? '0-10' : '10-30'} miles. Try ${maxRadius === 10 ? 'expanding to 30mi' : 'switching to 10mi'} or using different keywords.`);
      }

    } catch (error) {
      console.error('❌ Search error:', error);
      setError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle business recommendation
  const handleRecommendBusiness = (business: any) => {
    if (!currentUser) {
      setShowSignupPrompt(true);
      return;
    }
    
    // In a real app, this would call an API to submit the recommendation
    alert(`Thanks! We'll review ${business.name} for addition to our platform.`);
  };

  // Handle "Take Me There" action
  const handleTakeMeThere = (business: any) => {
    // Record the visit if user is authenticated
    if (currentUser && business.isPlatformBusiness) {
      // In a real app, this would call BusinessService.recordBusinessVisit
      console.log('Recording visit for business:', business.id);
    }

    // Open Google Maps
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

  // Swipe handlers for business navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentBusinessIndex < businesses.length - 1) {
        setCurrentBusinessIndex(prev => prev + 1);
      }
    },
    onSwipedRight: () => {
      if (currentBusinessIndex > 0) {
        setCurrentBusinessIndex(prev => prev - 1);
      }
    },
    trackMouse: true
  });

  // Handle exit app mode
  const handleExitAppMode = () => {
    setIsAppModeActive(false);
    setBusinesses([]);
    setSearchResults(null);
    setCurrentBusinessIndex(0);
    setSearchQuery('');
    setError(null);
  };

  // Handle auth success
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setShowAuthModal(false);
    setShowSignupPrompt(false);
  };

  // Get distance option label
  const getDistanceLabel = (distance: number) => {
    return `within ${distance}mi`;
  };

  // Get search type display info
  const getSearchTypeInfo = () => {
    switch (searchType) {
      case 'semantic':
        return {
          icon: <Sparkles className="h-4 w-4" />,
          label: 'Semantic Search',
          description: 'Understanding your vibe',
          credits: 5
        };
      case 'ai':
        return {
          icon: <Zap className="h-4 w-4" />,
          label: 'AI-Powered Search',
          description: 'Enhanced with Google Places',
          credits: 10
        };
      default:
        return {
          icon: <Search className="h-4 w-4" />,
          label: 'Platform Search',
          description: 'Our verified businesses',
          credits: 1
        };
    }
  };

  const searchTypeInfo = getSearchTypeInfo();

  return (
    <div className={`relative ${isAppModeActive ? 'h-screen overflow-hidden' : ''}`}>
      {/* Hero Section */}
      <section className={`relative ${isAppModeActive ? 'h-full' : 'min-h-[70vh]'} bg-gradient-to-br from-primary-500 via-primary-600 to-accent-600 flex items-center justify-center overflow-hidden`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] bg-repeat"></div>
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {!isAppModeActive ? (
            // Initial Hero State
            <div className="text-center text-white">
              <h1 className="font-cinzel text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Find Your Perfect
                <span className="block text-accent-200">Experience</span>
              </h1>
              <p className="font-lora text-xl md:text-2xl mb-8 text-white/90 max-w-2xl mx-auto leading-relaxed">
                Discover businesses that match your vibe using AI-powered search
              </p>

              {/* Search Form */}
              <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-6 w-6 text-neutral-400" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Describe the vibe you're looking for... (e.g., 'cozy coffee shop with good wifi')"
                    className="w-full pl-12 pr-32 py-4 text-lg font-lora bg-white/95 backdrop-blur-sm border-0 rounded-2xl shadow-2xl focus:ring-4 focus:ring-white/30 focus:outline-none placeholder-neutral-500"
                    disabled={isSearching}
                  />
                  
                  {/* Distance Selector */}
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowDistanceOptions(!showDistanceOptions)}
                        className="flex items-center bg-primary-500 text-white px-4 py-2 rounded-xl font-poppins font-semibold hover:bg-primary-600 transition-colors duration-200"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        {getDistanceLabel(maxRadius)}
                        {showDistanceOptions ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                      </button>
                      
                      {showDistanceOptions && (
                        <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-50 min-w-[140px]">
                          {DISTANCE_OPTIONS.map((distance) => (
                            <button
                              key={distance}
                              type="button"
                              onClick={() => {
                                setMaxRadius(distance);
                                setShowDistanceOptions(false);
                              }}
                              className={`w-full text-left px-4 py-2 font-poppins transition-colors duration-200 ${
                                maxRadius === distance
                                  ? 'bg-primary-50 text-primary-600 font-semibold'
                                  : 'text-neutral-700 hover:bg-neutral-50'
                              }`}
                            >
                              {getDistanceLabel(distance)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search Button */}
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className={`mt-6 font-poppins px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                    isSearching || !searchQuery.trim()
                      ? 'bg-white/30 text-white/60 cursor-not-allowed'
                      : 'bg-white text-primary-600 hover:bg-white/90 hover:shadow-2xl hover:scale-105'
                  }`}
                >
                  {isSearching ? (
                    <span className="flex items-center">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Searching...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Sparkles className="h-5 w-5 mr-2" />
                      Find My Vibe
                    </span>
                  )}
                </button>
              </form>

              {/* Credit Info */}
              {currentUser && (
                <div className="mt-6 flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center">
                    <Zap className="h-4 w-4 text-yellow-300 mr-2" />
                    <span className="font-poppins text-sm font-semibold text-white mr-2">
                      {currentUser.credits || 0} credits
                    </span>
                    <CreditInfoTooltip />
                  </div>
                </div>
              )}

              {/* Location Status */}
              <div className="mt-4 flex items-center justify-center">
                {locationError ? (
                  <div className="bg-red-500/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-300 mr-2" />
                    <span className="font-lora text-sm text-red-200">
                      Location access denied - using default area
                    </span>
                  </div>
                ) : latitude && longitude ? (
                  <div className="bg-green-500/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center">
                    <MapPin className="h-4 w-4 text-green-300 mr-2" />
                    <span className="font-lora text-sm text-green-200">
                      Location detected - showing nearby results
                    </span>
                  </div>
                ) : (
                  <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center">
                    <MapPin className="h-4 w-4 text-yellow-300 mr-2" />
                    <span className="font-lora text-sm text-yellow-200">
                      Getting your location...
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // App Mode - Search Results
            <div className="h-full flex flex-col">
              {/* Fixed Search Bar */}
              <div className="search-bar-fixed bg-white/95 backdrop-blur-sm p-4 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExitAppMode}
                    className="p-2 rounded-full hover:bg-neutral-100 transition-colors duration-200"
                  >
                    <X className="h-5 w-5 text-neutral-600" />
                  </button>
                  
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search for your vibe..."
                      className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-xl font-lora text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  
                  {/* Distance Selector in App Mode */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDistanceOptions(!showDistanceOptions)}
                      className="flex items-center bg-primary-500 text-white px-3 py-2 rounded-xl font-poppins font-semibold text-sm hover:bg-primary-600 transition-colors duration-200"
                    >
                      {getDistanceLabel(maxRadius)}
                      {showDistanceOptions ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                    </button>
                    
                    {showDistanceOptions && (
                      <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-50 min-w-[120px]">
                        {DISTANCE_OPTIONS.map((distance) => (
                          <button
                            key={distance}
                            onClick={() => {
                              setMaxRadius(distance);
                              setShowDistanceOptions(false);
                              // Re-apply search algorithm with new radius
                              if (businesses.length > 0) {
                                const allBusinesses = [...businesses]; // Use current businesses
                                const filteredBusinesses = applyDynamicSearchAlgorithm(allBusinesses, distance);
                                setBusinesses(filteredBusinesses);
                                setCurrentBusinessIndex(0);
                              }
                            }}
                            className={`w-full text-left px-4 py-2 font-poppins text-sm transition-colors duration-200 ${
                              maxRadius === distance
                                ? 'bg-primary-50 text-primary-600 font-semibold'
                                : 'text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            {getDistanceLabel(distance)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Results Info */}
                {searchResults && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center">
                      {searchTypeInfo.icon}
                      <span className="font-poppins text-sm font-semibold text-neutral-700 ml-2">
                        {searchTypeInfo.label}
                      </span>
                      <span className="font-lora text-xs text-neutral-500 ml-2">
                        {searchTypeInfo.description}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="font-poppins text-sm text-neutral-600">
                        {businesses.length} results {getDistanceLabel(maxRadius)}
                      </span>
                      {currentUser && (
                        <div className="ml-3 bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-poppins font-semibold">
                          -{searchTypeInfo.credits} credits
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Business Cards Container */}
              <div className="flex-1 overflow-hidden pt-4">
                {error ? (
                  <div className="h-full flex items-center justify-center p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 text-center max-w-md">
                      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <h3 className="font-poppins text-lg font-semibold text-red-700 mb-2">
                        Search Error
                      </h3>
                      <p className="font-lora text-red-600 mb-4">
                        {error}
                      </p>
                      <button
                        onClick={() => setError(null)}
                        className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                ) : businesses.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 text-center max-w-md">
                      <Search className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                      <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                        No Results Found
                      </h3>
                      <p className="font-lora text-neutral-600 mb-4">
                        No businesses found within {maxRadius === 10 ? '0-10' : '10-30'} miles. Try {maxRadius === 10 ? 'expanding to 30mi' : 'switching to 10mi'} or different keywords.
                      </p>
                      <button
                        onClick={handleExitAppMode}
                        className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                      >
                        New Search
                      </button>
                    </div>
                  </div>
                ) : (
                  // Business Cards Display
                  <div 
                    {...swipeHandlers}
                    className="h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 gap-4"
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    {businesses.map((business, index) => (
                      <div key={`${business.id}-${index}`} className="flex-shrink-0 w-[85vw] sm:w-[400px] snap-center">
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
                    ))}
                  </div>
                )}
              </div>

              {/* Business Counter */}
              {businesses.length > 0 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full">
                  <span className="font-poppins text-sm">
                    {currentBusinessIndex + 1} of {businesses.length}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Signup Prompt Modal */}
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