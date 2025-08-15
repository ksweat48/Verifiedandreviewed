import React, { useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../hooks/useAuth';
import { CreditService } from '../services/creditService';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { ActivityService } from '../services/activityService';
import AIBusinessCard from './AIBusinessCard';
import PlatformBusinessCard from './PlatformBusinessCard';
import CreditInfoTooltip from './CreditInfoTooltip';
import SignupPrompt from './SignupPrompt';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface SearchResult {
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
  is_mobile_business?: boolean;
  phone_number?: string;
  latitude?: number;
  longitude?: number;
  // Offering-specific properties
  isOfferingSearch?: boolean;
  offeringId?: string;
  businessId?: string;
  ctaLabel?: string;
  offeringDescription?: string;
  businessAddress?: string;
  businessCategory?: string;
  businessHours?: string;
  businessPhone?: string;
  businessWebsite?: string;
  is_virtual?: boolean;
  website_url?: string;
}

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchType, setSearchType] = useState<'platform' | 'ai' | 'semantic'>('platform');
  const [hasSearched, setHasSearched] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [backToastVisible, setBackToastVisible] = useState(false);
  const [searchMode, setSearchMode] = useState<'business' | 'offering'>('business');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  
  const { latitude, longitude, error: locationError } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000
  });

  // Auto-focus search input when app mode becomes active
  useEffect(() => {
    if (isAppModeActive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isAppModeActive]);

  // Handle browser back button in app mode
  useEffect(() => {
    if (!isAppModeActive) return;

    const handlePopState = (event: PopStateEvent) => {
      if (hasSearched) {
        // Show back toast and clear search
        setBackToastVisible(true);
        setTimeout(() => setBackToastVisible(false), 2000);
        
        setHasSearched(false);
        setSearchResults([]);
        setCurrentIndex(0);
        setError(null);
        
        // Push new state to prevent actual navigation
        window.history.pushState(null, '', window.location.href);
      } else {
        // Exit app mode
        setIsAppModeActive(false);
      }
    };

    // Push initial state when entering app mode
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAppModeActive, hasSearched, setIsAppModeActive]);

  // Swipe handlers for mobile navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (searchResults.length > 0 && currentIndex < searchResults.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    },
    onSwipedRight: () => {
      if (searchResults.length > 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    setLoading(true);
    setError(null);
    setSearchResults([]);
    setCurrentIndex(0);
    setHasSearched(true);

    try {
      // Activate app mode when search starts
      if (!isAppModeActive) {
        setIsAppModeActive(true);
      }

      // Log search activity
      if (user) {
        ActivityService.logSearch(user.id, searchQuery, searchType);
      }

      let results: SearchResult[] = [];
      let usedSearchType = searchType;

      // Step 1: Always try platform search first
      console.log('🔍 Step 1: Searching platform businesses...');
      
      if (searchMode === 'offering') {
        // Search offerings/dishes/items
        const offeringResponse = await fetchWithTimeout('/.netlify/functions/search-offerings', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          timeout: 15000
        }, `?q=${encodeURIComponent(searchQuery)}&lat=${latitude || ''}&lng=${longitude || ''}&limit=10`);

        if (offeringResponse.ok) {
          const offeringData = await offeringResponse.json();
          if (offeringData.success && offeringData.results) {
            results = offeringData.results.map((offering: any) => ({
              id: offering.offeringId,
              name: offering.businessName,
              address: offering.businessAddress || 'Address not available',
              image: offering.imageUrl || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              shortDescription: offering.offeringDescription || `${offering.offeringTitle} at ${offering.businessName}`,
              rating: 4.5, // Default rating for offerings
              hours: offering.businessHours || 'Hours not available',
              isOpen: offering.isOpen !== false,
              reviews: [{
                text: `Great ${offering.offeringTitle.toLowerCase()}! Really enjoyed this offering.`,
                author: "Platform User",
                thumbsUp: true
              }],
              isPlatformBusiness: true,
              distance: offering.distanceKm ? offering.distanceKm * 0.621371 : undefined, // Convert km to miles
              duration: 15, // Default duration
              similarity: offering.semanticScore || 0.8,
              isOfferingSearch: true,
              offeringId: offering.offeringId,
              businessId: offering.businessId,
              ctaLabel: offering.ctaLabel || 'View Item',
              offeringDescription: offering.offeringDescription,
              businessAddress: offering.businessAddress,
              businessCategory: offering.businessCategory,
              businessHours: offering.businessHours,
              businessPhone: offering.businessPhone,
              businessWebsite: offering.businessWebsite
            }));
            
            console.log('✅ Found', results.length, 'offering results');
            usedSearchType = 'platform';
          }
        }
      } else {
        // Search businesses
        const platformBusinesses = await BusinessService.getBusinesses({
          search: searchQuery,
          userLatitude: latitude || undefined,
          userLongitude: longitude || undefined
        });

        console.log('✅ Platform search found', platformBusinesses.length, 'businesses');

        if (platformBusinesses.length > 0) {
          // Calculate accurate distances if we have user location
          let businessesWithDistances = platformBusinesses;
          if (latitude && longitude) {
            try {
              businessesWithDistances = await BusinessService.calculateBusinessDistances(
                platformBusinesses,
                latitude,
                longitude
              );
              console.log('✅ Updated platform businesses with accurate distances');
            } catch (distanceError) {
              console.warn('⚠️ Distance calculation failed, using placeholder values:', distanceError);
            }
          }

          results = businessesWithDistances.map(business => ({
            id: business.id,
            name: business.name,
            address: business.address || business.location || 'Address not available',
            image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
            shortDescription: business.short_description || business.description,
            rating: business.sentiment_score ? business.sentiment_score / 20 : 4.0,
            hours: business.hours || 'Hours not available',
            isOpen: true,
            reviews: business.reviews || [],
            isPlatformBusiness: true,
            distance: business.distance,
            duration: business.duration,
            similarity: 0.9,
            is_mobile_business: business.is_mobile_business,
            phone_number: business.phone_number,
            latitude: business.latitude,
            longitude: business.longitude,
            is_virtual: business.is_virtual,
            website_url: business.website_url
          }));
          
          usedSearchType = 'platform';
        }
      }

      // Step 2: If fewer than 10 platform results, try semantic search
      if (results.length < 10 && searchMode === 'business') {
        console.log('🧠 Step 2: Trying semantic search (fewer than 10 platform results)...');
        
        try {
          const semanticResults = await SemanticSearchService.searchByVibe(searchQuery, {
            latitude: latitude || undefined,
            longitude: longitude || undefined,
            matchThreshold: 0.3,
            matchCount: 15 - results.length
          });

          if (semanticResults.success && semanticResults.results.length > 0) {
            console.log('✅ Semantic search found', semanticResults.results.length, 'additional results');
            
            const semanticBusinesses = semanticResults.results.map(business => ({
              id: business.id,
              name: business.name,
              address: business.address || business.location || 'Address not available',
              image: business.image_url || business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              shortDescription: business.short_description || business.description,
              rating: business.sentiment_score ? business.sentiment_score / 20 : 4.0,
              hours: business.hours || 'Hours not available',
              isOpen: true,
              reviews: business.reviews || [],
              isPlatformBusiness: true,
              distance: business.distance,
              duration: business.duration,
              similarity: business.similarity,
              is_mobile_business: business.is_mobile_business,
              phone_number: business.phone_number,
              latitude: business.latitude,
              longitude: business.longitude,
              is_virtual: business.is_virtual,
              website_url: business.website_url
            }));

            results = [...results, ...semanticBusinesses];
            usedSearchType = 'semantic';
          }
        } catch (semanticError) {
          console.warn('⚠️ Semantic search failed:', semanticError);
        }
      }

      // Step 3: If still fewer than 10 results, try AI search
      if (results.length < 10 && searchMode === 'business') {
        console.log('🤖 Step 3: Trying AI search (still fewer than 10 results)...');
        
        try {
          const aiResponse = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await getAuthToken()}`
            },
            body: JSON.stringify({
              prompt: searchQuery,
              searchQuery: searchQuery,
              existingResultsCount: results.length,
              numToGenerate: Math.min(15 - results.length, 10),
              latitude: latitude || undefined,
              longitude: longitude || undefined
            }),
            timeout: 30000
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.results) {
              console.log('✅ AI search found', aiData.results.length, 'additional results');
              
              const aiBusinesses = aiData.results.map((business: any) => ({
                id: business.id,
                name: business.name,
                address: business.address || 'Address not available',
                image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                shortDescription: business.shortDescription,
                rating: business.rating || 4.0,
                hours: business.hours || 'Hours not available',
                isOpen: business.isOpen !== false,
                reviews: business.reviews || [],
                isPlatformBusiness: false,
                distance: business.distance,
                duration: business.duration,
                isGoogleVerified: business.isGoogleVerified,
                placeId: business.placeId,
                similarity: business.similarity,
                is_mobile_business: business.is_mobile_business,
                phone_number: business.phone_number,
                latitude: business.latitude,
                longitude: business.longitude,
                is_virtual: business.is_virtual,
                website_url: business.website_url
              }));

              results = [...results, ...aiBusinesses];
              usedSearchType = 'ai';
            }
          }
        } catch (aiError) {
          console.warn('⚠️ AI search failed:', aiError);
        }
      }

      // Deduct credits after successful search
      if (user && results.length > 0) {
        const deductionSuccess = await CreditService.deductSearchCredits(user.id, usedSearchType);
        if (!deductionSuccess) {
          console.warn('⚠️ Failed to deduct credits, but allowing search to continue');
        }
      }

      setSearchResults(results);
      setSearchType(usedSearchType);

      if (results.length === 0) {
        setError('No results found. Try a different search term or check your spelling.');
      }

    } catch (err) {
      console.error('❌ Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || '';
    } catch (error) {
      return '';
    }
  };

  const handleRecommend = async (business: SearchResult) => {
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

  const handleTakeMeThere = (business: SearchResult) => {
    if (!user) {
      setShowSignupPrompt(true);
      return;
    }

    // Record business visit
    BusinessService.recordBusinessVisit(business.id, user.id);
    
    // Handle different business types
    if (business.is_virtual && business.website_url) {
      window.open(business.website_url, '_blank', 'noopener,noreferrer');
      return;
    }
    
    if (business.is_mobile_business && business.phone_number) {
      window.open(`tel:${business.phone_number}`, '_self');
      return;
    }
    
    // Default: Open Google Maps
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

  const nextResult = () => {
    if (currentIndex < searchResults.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevResult = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentIndex(0);
    setError(null);
    setHasSearched(false);
    if (isAppModeActive) {
      setIsAppModeActive(false);
    }
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

  const searchModeOptions = [
    { value: 'business', label: 'Businesses', icon: Icons.Building },
    { value: 'offering', label: 'Dishes & Items', icon: Icons.UtensilsCrossed }
  ];

  return (
    <>
      <section className={`relative transition-all duration-500 ${
        isAppModeActive 
          ? 'fixed inset-0 z-50 bg-white overflow-hidden' 
          : 'py-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
      }`}>
        
        {/* Background for non-app mode */}
        {!isAppModeActive && (
          <div className="absolute inset-0 bg-black opacity-20"></div>
        )}

        <div className={`relative z-10 ${
          isAppModeActive 
            ? 'h-full flex flex-col' 
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center'
        }`}>
          
          {/* Header - Only show in non-app mode */}
          {!isAppModeActive && (
            <div className="mb-12">
              <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-white mb-6">
                Find Your Vibe
              </h1>
              <p className="font-lora text-xl md:text-2xl text-white text-opacity-90 max-w-3xl mx-auto leading-relaxed">
                Discover businesses that match your mood with AI-powered recommendations
              </p>
            </div>
          )}

          {/* Search Bar */}
          <div className={`${
            isAppModeActive 
              ? 'search-bar-fixed bg-white p-4 border-b border-neutral-200' 
              : 'max-w-2xl mx-auto'
          }`}>
            
            {/* Search Mode Toggle - Only in app mode */}
            {isAppModeActive && (
              <div className="flex justify-center mb-4">
                <div className="bg-neutral-100 rounded-lg p-1 flex">
                  {searchModeOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setSearchMode(option.value as any)}
                        className={`flex items-center px-3 py-2 rounded-md font-poppins text-sm font-medium transition-all duration-200 ${
                          searchMode === option.value
                            ? 'bg-white text-primary-600 shadow-sm'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        <IconComponent className="h-4 w-4 mr-2" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleSearch} className="relative">
              <div className="relative">
                <Icons.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-neutral-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchMode === 'offering' 
                      ? "Search for dishes, drinks, services..." 
                      : "Describe the vibe you're looking for..."
                  }
                  className={`w-full pl-12 pr-20 py-4 text-lg font-lora rounded-2xl border-2 transition-all duration-300 ${
                    isAppModeActive
                      ? 'border-neutral-200 focus:border-primary-500 bg-white'
                      : 'border-white border-opacity-20 bg-white bg-opacity-10 text-white placeholder-white placeholder-opacity-70 focus:bg-opacity-20 focus:border-opacity-40 hero-background-blur'
                  } focus:outline-none focus:ring-0`}
                />
                
                {/* Clear button - only show in app mode when there's text */}
                {isAppModeActive && searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-16 top-1/2 transform -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
                  >
                    <Icons.X className="h-5 w-5" />
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-3 rounded-xl transition-all duration-300 ${
                    loading || !searchQuery.trim()
                      ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                      : isAppModeActive
                        ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg'
                        : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg'
                  }`}
                >
                  {loading ? (
                    <Icons.Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Icons.ArrowRight className="h-6 w-6" />
                  )}
                </button>
              </div>
            </form>

            {/* Credit info - only show when not in app mode */}
            {!isAppModeActive && user && (
              <div className="flex items-center justify-center mt-4 text-white text-opacity-80">
                <Icons.Zap className="h-4 w-4 mr-2 text-yellow-400" />
                <span className="font-lora text-sm mr-2">
                  You have {user.credits} credits
                </span>
                <CreditInfoTooltip placement="top" />
              </div>
            )}
          </div>

          {/* Results Section - Only in app mode */}
          {isAppModeActive && (
            <div className="flex-1 overflow-hidden" {...swipeHandlers}>
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Icons.Loader2 className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-spin" />
                    <p className="font-lora text-neutral-600">
                      {searchMode === 'offering' ? 'Finding dishes and items...' : 'Finding your vibe...'}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="text-center max-w-md">
                    <Icons.AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                      No Results Found
                    </h3>
                    <p className="font-lora text-neutral-600 mb-4">{error}</p>
                    <button
                      onClick={clearSearch}
                      className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                    >
                      Try Another Search
                    </button>
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="h-full flex flex-col">
                  {/* Results Counter */}
                  <div className="flex-shrink-0 px-4 py-2 bg-neutral-50 border-b border-neutral-200">
                    <div className="flex items-center justify-between">
                      <span className="font-lora text-sm text-neutral-600">
                        {currentIndex + 1} of {searchResults.length} results
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                          searchType === 'platform' ? 'bg-blue-100 text-blue-700' :
                          searchType === 'semantic' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {searchType === 'platform' ? 'Platform' :
                           searchType === 'semantic' ? 'Semantic' : 'AI'}
                        </span>
                        {searchResults[currentIndex]?.isGoogleVerified && (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-poppins font-semibold">
                            Google
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Current Result */}
                  <div 
                    ref={resultsContainerRef}
                    className="flex-1 overflow-y-auto p-4"
                  >
                    {searchResults[currentIndex] && (
                      searchResults[currentIndex].isPlatformBusiness ? (
                        <PlatformBusinessCard
                          business={searchResults[currentIndex]}
                          onRecommend={handleRecommend}
                          onTakeMeThere={handleTakeMeThere}
                        />
                      ) : (
                        <AIBusinessCard
                          business={searchResults[currentIndex]}
                          onRecommend={handleRecommend}
                        />
                      )
                    )}
                  </div>

                  {/* Navigation Controls */}
                  {searchResults.length > 1 && (
                    <div className="flex-shrink-0 flex items-center justify-between p-4 bg-neutral-50 border-t border-neutral-200">
                      <button
                        onClick={prevResult}
                        disabled={currentIndex === 0}
                        className={`p-3 rounded-full transition-all duration-200 ${
                          currentIndex === 0
                            ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                            : 'bg-white text-neutral-600 hover:bg-neutral-100 shadow-md'
                        }`}
                      >
                        <Icons.ChevronLeft className="h-6 w-6" />
                      </button>

                      <div className="flex space-x-2">
                        {searchResults.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-3 h-3 rounded-full transition-all duration-200 ${
                              index === currentIndex
                                ? 'bg-primary-500'
                                : 'bg-neutral-300 hover:bg-neutral-400'
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        onClick={nextResult}
                        disabled={currentIndex === searchResults.length - 1}
                        className={`p-3 rounded-full transition-all duration-200 ${
                          currentIndex === searchResults.length - 1
                            ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                            : 'bg-white text-neutral-600 hover:bg-neutral-100 shadow-md'
                        }`}
                      >
                        <Icons.ChevronRight className="h-6 w-6" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sample searches - Only show in non-app mode */}
          {!isAppModeActive && (
            <div className="mt-12">
              <p className="font-lora text-white text-opacity-80 mb-6">Try searching for:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  'cozy coffee shop',
                  'romantic dinner',
                  'healthy smoothie',
                  'energetic workout',
                  'peaceful brunch'
                ].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setSearchQuery(sample)}
                    className="font-lora bg-white bg-opacity-10 text-white px-4 py-2 rounded-full hover:bg-opacity-20 transition-all duration-300 border border-white border-opacity-20"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Back Toast */}
        {backToastVisible && (
          <div className="back-toast">
            <span className="font-poppins text-sm">Tap back again to exit</span>
          </div>
        )}
      </section>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
          onSignup={handleSignupPromptSignup}
          onLogin={handleSignupPromptLogin}
          onClose={() => setShowSignupPrompt(false)}
          title="Sign Up to Search"
          message="Create an account to discover amazing businesses with AI-powered vibe matching."
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