import React, { useState, useEffect, useRef } from 'react';
import { Search, Zap, MapPin, Navigation, Heart, X, ChevronLeft, ChevronRight, Loader2, AlertCircle, Info } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { useGeolocation } from '../hooks/useGeolocation';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { UserService } from '../services/userService';
import { CreditService } from '../services/creditService';
import { ActivityService } from '../services/activityService';
import AIBusinessCard from './AIBusinessCard';
import PlatformBusinessCard from './PlatformBusinessCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import CreditInfoTooltip from './CreditInfoTooltip';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { calculateCompositeScore } from '../utils/similarityUtils';

interface SearchResult {
  id: string;
  name: string;
  address: string;
  image: string;
  shortDescription?: string;
  rating: number | { thumbsUp: number; thumbsDown?: number; sentimentScore: number };
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
  tags?: string[];
  compositeScore?: number;
}

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchError, setSearchError] = useState<string>('');
  const [showBackToast, setShowBackToast] = useState(false);
  const [lastSearchType, setLastSearchType] = useState<'platform' | 'ai' | 'semantic'>('platform');
  const [searchStats, setSearchStats] = useState({
    platformResults: 0,
    aiResults: 0,
    totalResults: 0,
    usedAI: false,
    usedSemantic: false
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { latitude, longitude, error: locationError } = useGeolocation();

  // Check for existing user session on component mount
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const user = await UserService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.debug('No user session found');
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

  // Focus search input when app mode is activated
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

    const handleBackGesture = () => {
      if (searchResults.length > 0) {
        // Clear search results first
        setSearchResults([]);
        setCurrentCardIndex(0);
        setSearchQuery('');
        setShowBackToast(true);
        setTimeout(() => setShowBackToast(false), 2000);
      } else {
        // Exit app mode
        setIsAppModeActive(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBackGesture();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
    onSwipedDown: () => {
      if (searchResults.length > 0) {
        setSearchResults([]);
        setCurrentCardIndex(0);
        setSearchQuery('');
      } else {
        setIsAppModeActive(false);
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    // Check if user is authenticated for credit-based searches
    if (!currentUser) {
      setShowSignupPrompt(true);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setIsAppModeActive(true);
    
    try {
      console.log('🔍 Starting search for:', searchQuery);
      
      // Step 1: Search platform businesses first
      console.log('🔍 Step 1: Searching platform businesses...');
      const platformBusinesses = await BusinessService.getBusinesses({
        search: searchQuery,
        userLatitude: latitude || undefined,
        userLongitude: longitude || undefined
      });
      
      console.log('✅ Platform search completed:', platformBusinesses.length, 'results');
      
      // Filter platform businesses within 10 miles if location is available
      let nearbyPlatformBusinesses = platformBusinesses;
      if (latitude && longitude) {
        nearbyPlatformBusinesses = platformBusinesses.filter(business => {
          if (!business.distance || business.distance === 999999) return false;
          return business.distance <= 10;
        });
        console.log('📏 Filtered to businesses within 10 miles:', nearbyPlatformBusinesses.length);
      }
      
      // Determine search strategy based on platform results
      let finalResults: SearchResult[] = [];
      let searchType: 'platform' | 'ai' | 'semantic' = 'platform';
      let usedAI = false;
      let usedSemantic = false;
      
      if (nearbyPlatformBusinesses.length >= 6) {
        // Sufficient platform results - use platform-only search (1 credit)
        console.log('✅ Sufficient platform results, using platform-only search');
        searchType = 'platform';
        
        // Check credits for platform search
        const hasCredits = await CreditService.hasEnoughCreditsForSearch(currentUser.id, 'platform');
        if (!hasCredits) {
          setSearchError('Insufficient credits for search. You need 1 credit for platform searches.');
          setIsSearching(false);
          return;
        }
        
        // Deduct credits for platform search
        const creditDeducted = await CreditService.deductSearchCredits(currentUser.id, 'platform');
        if (!creditDeducted) {
          setSearchError('Failed to process search credits. Please try again.');
          setIsSearching(false);
          return;
        }
        
        // Standardize platform businesses for PlatformBusinessCard
        finalResults = nearbyPlatformBusinesses.slice(0, 20).map(business => ({
          ...business,
          // Map image_url to image for platform businesses
          image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
          // Create rating object for platform businesses
          rating: {
            thumbsUp: business.thumbs_up || 0,
            thumbsDown: business.thumbs_down || 0,
            sentimentScore: business.sentiment_score || 0
          },
          isPlatformBusiness: true,
          reviews: business.reviews || [],
          tags: business.tags || [],
          compositeScore: calculateCompositeScore({
            similarity: 0.8, // High similarity for exact matches
            distance: business.distance,
            isOpen: business.isOpen !== false,
            isPlatformBusiness: true
          })
        }));
        
      } else {
        // Insufficient platform results - check for semantic search first
        console.log('⚠️ Insufficient platform results, checking semantic search...');
        
        // Try semantic search first (5 credits)
        const hasSemanticCredits = await CreditService.hasEnoughCreditsForSearch(currentUser.id, 'semantic');
        
        if (hasSemanticCredits) {
          console.log('🧠 Attempting semantic search...');
          
          try {
            const semanticResults = await SemanticSearchService.searchByVibe(searchQuery, {
              latitude: latitude || undefined,
              longitude: longitude || undefined,
              matchThreshold: 0.3,
              matchCount: 15
            });
            
            if (semanticResults.success && semanticResults.results.length > 0) {
              console.log('✅ Semantic search successful:', semanticResults.results.length, 'results');
              searchType = 'semantic';
              usedSemantic = true;
              
              // Deduct credits for semantic search
              const creditDeducted = await CreditService.deductSearchCredits(currentUser.id, 'semantic');
              if (!creditDeducted) {
                setSearchError('Failed to process search credits. Please try again.');
                setIsSearching(false);
                return;
              }
              
              // Combine platform and semantic results
              const platformResults = nearbyPlatformBusinesses.map(business => ({
                ...business,
                // Map image_url to image for platform businesses
                image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                // Create rating object for platform businesses
                rating: {
                  thumbsUp: business.thumbs_up || 0,
                  thumbsDown: business.thumbs_down || 0,
                  sentimentScore: business.sentiment_score || 0
                },
                isPlatformBusiness: true,
                reviews: business.reviews || [],
                tags: business.tags || [],
                compositeScore: calculateCompositeScore({
                  similarity: 0.9, // Very high for platform matches
                  distance: business.distance,
                  isOpen: business.isOpen !== false,
                  isPlatformBusiness: true
                })
              }));
              
              const semanticResults_mapped = semanticResults.results.map(business => ({
                ...business,
                // Ensure image property exists for platform businesses
                image: business.image_url || business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                // Create rating object for platform businesses
                rating: {
                  thumbsUp: business.thumbs_up || 0,
                  thumbsDown: business.thumbs_down || 0,
                  sentimentScore: business.sentiment_score || 0
                },
                isPlatformBusiness: true,
                reviews: business.reviews || [],
                tags: business.tags || [],
                compositeScore: calculateCompositeScore({
                  similarity: business.similarity || 0.7,
                  distance: business.distance,
                  isOpen: business.isOpen !== false,
                  isPlatformBusiness: true
                })
              }));
              
              // Combine and sort by composite score
              finalResults = [...platformResults, ...semanticResults_mapped]
                .sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0))
                .slice(0, 20);
                
            } else {
              throw new Error('Semantic search returned no results');
            }
          } catch (semanticError) {
            console.warn('⚠️ Semantic search failed, falling back to AI search:', semanticError);
            // Fall back to AI search
          }
        }
        
        // If semantic search failed or no credits, try AI search
        if (!usedSemantic) {
          console.log('🤖 Attempting AI search...');
          
          // Check credits for AI search
          const hasAICredits = await CreditService.hasEnoughCreditsForSearch(currentUser.id, 'ai');
          if (!hasAICredits) {
            setSearchError('Insufficient credits for AI search. You need 10 credits for AI-assisted searches.');
            setIsSearching(false);
            return;
          }
          
          searchType = 'ai';
          usedAI = true;
          
          // Deduct credits for AI search
          const creditDeducted = await CreditService.deductSearchCredits(currentUser.id, 'ai');
          if (!creditDeducted) {
            setSearchError('Failed to process search credits. Please try again.');
            setIsSearching(false);
            return;
          }
          
          // Call AI business search
          const aiResponse = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: searchQuery,
              searchQuery: searchQuery,
              existingResultsCount: nearbyPlatformBusinesses.length,
              numToGenerate: Math.max(6 - nearbyPlatformBusinesses.length, 10),
              latitude: latitude || undefined,
              longitude: longitude || undefined
            }),
            timeout: 30000
          });
          
          if (!aiResponse.ok) {
            throw new Error(`AI search failed: ${aiResponse.status}`);
          }
          
          const aiData = await aiResponse.json();
          
          if (!aiData.success) {
            throw new Error(aiData.message || 'AI search failed');
          }
          
          console.log('✅ AI search completed:', aiData.results?.length || 0, 'results');
          
          // Standardize platform businesses for PlatformBusinessCard
          const platformResults = nearbyPlatformBusinesses.map(business => ({
            ...business,
            // Map image_url to image for platform businesses
            image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
            // Create rating object for platform businesses
            rating: {
              thumbsUp: business.thumbs_up || 0,
              thumbsDown: business.thumbs_down || 0,
              sentimentScore: business.sentiment_score || 0
            },
            isPlatformBusiness: true,
            reviews: business.reviews || [],
            tags: business.tags || [],
            compositeScore: calculateCompositeScore({
              similarity: 0.9, // Very high for platform matches
              distance: business.distance,
              isOpen: business.isOpen !== false,
              isPlatformBusiness: true
            })
          }));
          
          // Standardize AI businesses for AIBusinessCard
          const aiResults = (aiData.results || []).map((business: any) => ({
            ...business,
            // Keep rating as number for AI businesses (so toFixed works)
            rating: business.rating || 4.5,
            // Ensure image property exists
            image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
            isPlatformBusiness: false,
            reviews: business.reviews || [],
            tags: business.tags || [],
            compositeScore: calculateCompositeScore({
              similarity: business.similarity || 0.8,
              distance: business.distance,
              isOpen: business.isOpen !== false,
              isPlatformBusiness: false
            })
          }));
          
          // Combine platform and AI results, sort by composite score
          finalResults = [...platformResults, ...aiResults]
            .sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0))
            .slice(0, 20);
        }
      }
      
      // Log search activity
      if (currentUser) {
        ActivityService.logSearch(currentUser.id, searchQuery, searchType);
      }
      
      // Update search stats
      setSearchStats({
        platformResults: nearbyPlatformBusinesses.length,
        aiResults: finalResults.length - nearbyPlatformBusinesses.length,
        totalResults: finalResults.length,
        usedAI,
        usedSemantic
      });
      
      setLastSearchType(searchType);
      setSearchResults(finalResults);
      setCurrentCardIndex(0);
      
      console.log('🎯 Search completed successfully:', {
        query: searchQuery,
        type: searchType,
        platformResults: nearbyPlatformBusinesses.length,
        totalResults: finalResults.length,
        usedAI,
        usedSemantic
      });
      
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecommendBusiness = async (business: SearchResult) => {
    if (!currentUser) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      if (business.isPlatformBusiness) {
        // For platform businesses, just show a message
        alert(`Thanks! ${business.name} is already on our platform.`);
      } else {
        // For AI businesses, save to favorites
        const success = await BusinessService.saveAIRecommendation(business, currentUser.id);
        if (success) {
          alert(`${business.name} has been added to your favorites!`);
        } else {
          alert('Failed to save business. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error recommending business:', error);
      alert('Failed to save business. Please try again.');
    }
  };

  const handleTakeMeThere = async (business: SearchResult) => {
    // Record business visit if user is logged in
    if (currentUser && business.isPlatformBusiness) {
      try {
        await BusinessService.recordBusinessVisit(business.id, currentUser.id);
      } catch (error) {
        console.debug('Failed to record business visit:', error);
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

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
    setShowSignupPrompt(false);
    setShowAuthModal(false);
  };

  const nextCard = () => {
    if (currentCardIndex < searchResults.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    }
  };

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  const clearSearch = () => {
    setSearchResults([]);
    setCurrentCardIndex(0);
    setSearchQuery('');
    setSearchError('');
    if (isAppModeActive) {
      setIsAppModeActive(false);
    }
  };

  const getCreditCost = () => {
    if (lastSearchType === 'semantic') return 5;
    if (lastSearchType === 'ai') return 10;
    return 1;
  };

  const getSearchTypeLabel = () => {
    if (lastSearchType === 'semantic') return 'Semantic Search';
    if (lastSearchType === 'ai') return 'AI Search';
    return 'Platform Search';
  };

  return (
    <>
      {/* Hero Section - Hidden in App Mode */}
      {!isAppModeActive && (
        <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1920"
              alt="Restaurant interior"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
            <h1 className="font-cinzel text-4xl md:text-6xl font-bold mb-6 text-shadow">
              All Experiences
              <br />
              <span className="text-primary-400">Verified & Reviewed</span>
            </h1>
            
            <p className="font-lora text-xl md:text-2xl mb-8 text-shadow max-w-2xl mx-auto">
              Discover amazing places with AI-powered search and verified reviews from real experiences
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
                  placeholder="Find your vibe... 'cozy coffee shop' or 'romantic dinner'"
                  className="w-full pl-12 pr-32 py-4 text-lg font-lora text-neutral-900 bg-white rounded-2xl shadow-lg focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 focus:outline-none"
                  disabled={isSearching}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-6 py-2 rounded-xl font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSearching ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="h-5 w-5 mr-2" />
                        Search
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Credit Info */}
            <div className="mt-4 flex items-center justify-center">
              <div className="bg-black bg-opacity-30 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center">
                <span className="font-lora text-sm text-white mr-2">
                  Search costs 1-10 credits
                </span>
                <CreditInfoTooltip />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* App Mode - Full Screen Search Interface */}
      {isAppModeActive && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col" {...swipeHandlers}>
          {/* Fixed Search Bar */}
          <div className="search-bar-fixed p-4 border-b border-neutral-200">
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find your vibe... 'cozy coffee shop' or 'romantic dinner'"
                  className="w-full pl-12 pr-24 py-3 font-lora text-neutral-900 bg-neutral-50 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  disabled={isSearching}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  {searchResults.length > 0 && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors duration-200 mr-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 py-2 rounded-lg font-poppins font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Search Results or Loading */}
          <div className="flex-1 overflow-hidden">
            {isSearching ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-spin" />
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                    Finding your perfect match...
                  </h3>
                  <p className="font-lora text-neutral-600">
                    Searching platform businesses and AI recommendations
                  </p>
                </div>
              </div>
            ) : searchError ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                    Search Error
                  </h3>
                  <p className="font-lora text-neutral-600 mb-4">
                    {searchError}
                  </p>
                  <button
                    onClick={() => setSearchError('')}
                    className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              <>
                {/* Results Header */}
                <div className="p-4 border-b border-neutral-100 bg-neutral-50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900">
                      {searchStats.totalResults} results for "{searchQuery}"
                    </h3>
                    <div className="flex items-center text-sm text-neutral-600">
                      <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                      <span className="font-poppins font-semibold">
                        {getCreditCost()} credits • {getSearchTypeLabel()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Search Stats */}
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="font-lora">
                      {searchStats.platformResults} platform • {searchStats.aiResults} AI
                    </span>
                    {searchStats.usedSemantic && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-poppins font-semibold">
                        Semantic Search
                      </span>
                    )}
                    {searchStats.usedAI && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-poppins font-semibold">
                        AI Enhanced
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Navigation */}
                <div className="flex-1 relative">
                  {/* Current Card */}
                  <div className="absolute inset-0 p-4 flex items-center justify-center">
                    <div className="w-full max-w-sm">
                      {searchResults[currentCardIndex] && (
                        searchResults[currentCardIndex].isPlatformBusiness ? (
                          <PlatformBusinessCard
                            key={searchResults[currentCardIndex].id}
                            business={searchResults[currentCardIndex]}
                            onRecommend={handleRecommendBusiness}
                            onTakeMeThere={handleTakeMeThere}
                          />
                        ) : (
                          <AIBusinessCard
                            key={searchResults[currentCardIndex].id}
                            business={searchResults[currentCardIndex]}
                            onRecommend={handleRecommendBusiness}
                          />
                        )
                      )}
                    </div>
                  </div>

                  {/* Navigation Arrows */}
                  {searchResults.length > 1 && (
                    <>
                      <button
                        onClick={prevCard}
                        disabled={currentCardIndex === 0}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-white rounded-full shadow-lg border border-neutral-200 text-neutral-600 hover:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      
                      <button
                        onClick={nextCard}
                        disabled={currentCardIndex === searchResults.length - 1}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-white rounded-full shadow-lg border border-neutral-200 text-neutral-600 hover:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}
                </div>

                {/* Card Counter */}
                <div className="p-4 text-center border-t border-neutral-100">
                  <div className="flex items-center justify-center gap-2 mb-2">
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
                  <p className="font-lora text-sm text-neutral-600">
                    {currentCardIndex + 1} of {searchResults.length}
                  </p>
                  <p className="font-lora text-xs text-neutral-500 mt-1">
                    Swipe left/right to browse • Swipe down to go back
                  </p>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center">
                  <Search className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                    Ready to explore?
                  </h3>
                  <p className="font-lora text-neutral-600 mb-6">
                    Search for businesses by vibe, mood, or specific needs
                  </p>
                  <div className="space-y-2">
                    <p className="font-lora text-sm text-neutral-500">Try searching for:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {['cozy coffee shop', 'romantic dinner', 'healthy lunch', 'trendy bar'].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setSearchQuery(suggestion)}
                          className="bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full text-sm font-lora hover:bg-neutral-200 transition-colors duration-200"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Back Toast */}
          {showBackToast && (
            <div className="back-toast">
              Swipe down again to exit
            </div>
          )}
        </div>
      )}

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
    </>
  );
};

export default AISearchHero;