import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Zap, Users, Loader2, X, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { CreditService } from '../services/creditService';
import { ActivityService } from '../services/activityService';
import { BusinessService } from '../services/businessService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { supabase } from '../services/supabaseClient';
import AIBusinessCard from './AIBusinessCard';
import PlatformBusinessCard from './PlatformBusinessCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import CreditInfoTooltip from './CreditInfoTooltip';
import { getMatchPercentage } from '../utils/similarityUtils';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { latitude, longitude, error: locationError } = useGeolocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchType, setSearchType] = useState<'platform' | 'ai' | 'semantic' | 'offerings'>('platform');
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [recentSearches, setRecentSearches] = useState<Array<{ query: string; avatar: string }>>([]);
  const [searchStartTime, setSearchStartTime] = useState<number>(0);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from activity logs
  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const { data, error } = await supabase
          .from('user_activity_logs')
          .select(`
            event_details,
            profiles!inner (
              name,
              avatar_url
            )
          `)
          .eq('event_type', 'search')
          .not('event_details->search_query', 'is', null)
          .order('created_at', { ascending: false })
          .limit(15);

        if (error) throw error;

        const searches = (data || []).map(log => ({
          query: log.event_details?.search_query || '',
          avatar: log.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100'
        })).filter(search => search.query.length > 0);

        console.log('✅ Fetched', searches.length, 'real user searches');
        console.log('🔍 Sample searches:', searches.slice(0, 3).map(s => `${s.query}`));
        console.log('🖼️ Sample avatars:', searches.slice(0, 3).map(s => `${s.avatar}`));

        setRecentSearches(searches);
      } catch (error) {
        console.error('Error loading recent searches:', error);
        setRecentSearches([]);
      }
    };

    loadRecentSearches();
  }, []);

  // Helper function to determine if a query is for specific offerings/items
  const isOfferingQuery = (query: string): boolean => {
    const lowerQuery = query.toLowerCase().trim();
    
    // Specific food items and dishes
    const foodKeywords = [
      'burger', 'pizza', 'sushi', 'ramen', 'pasta', 'salad', 'sandwich', 'wrap',
      'smoothie', 'juice', 'coffee', 'tea', 'latte', 'cappuccino', 'espresso',
      'taco', 'burrito', 'quesadilla', 'nachos', 'wings', 'fries', 'soup',
      'steak', 'chicken', 'fish', 'salmon', 'shrimp', 'lobster', 'crab',
      'cake', 'pie', 'cookie', 'donut', 'muffin', 'bagel', 'croissant',
      'ice cream', 'gelato', 'frozen yogurt', 'milkshake', 'beer', 'wine',
      'cocktail', 'martini', 'margarita', 'mojito', 'whiskey', 'vodka'
    ];
    
    // Specific services
    const serviceKeywords = [
      'massage', 'facial', 'manicure', 'pedicure', 'haircut', 'styling',
      'therapy', 'consultation', 'training', 'lesson', 'class', 'session',
      'treatment', 'procedure', 'service', 'repair', 'cleaning', 'delivery'
    ];
    
    // Specific products
    const productKeywords = [
      'shirt', 'dress', 'shoes', 'jacket', 'pants', 'jeans', 'hat',
      'phone', 'laptop', 'tablet', 'headphones', 'camera', 'watch',
      'book', 'magazine', 'cd', 'vinyl', 'game', 'toy', 'gift'
    ];
    
    const allOfferingKeywords = [...foodKeywords, ...serviceKeywords, ...productKeywords];
    
    // Check if query contains specific offering keywords
    return allOfferingKeywords.some(keyword => lowerQuery.includes(keyword));
  };

  // Helper function to determine if a query is for general business vibe
  const isVibeQuery = (query: string): boolean => {
    const lowerQuery = query.toLowerCase().trim();
    
    // Vibe/mood descriptors
    const vibeKeywords = [
      'cozy', 'peaceful', 'quiet', 'lively', 'energetic', 'romantic', 'casual',
      'upscale', 'trendy', 'hip', 'modern', 'vintage', 'rustic', 'elegant',
      'family-friendly', 'kid-friendly', 'date night', 'business meeting',
      'study', 'work', 'relax', 'chill', 'fun', 'exciting', 'intimate'
    ];
    
    // Business type descriptors
    const businessTypeKeywords = [
      'restaurant', 'cafe', 'bar', 'pub', 'lounge', 'club', 'shop', 'store',
      'boutique', 'market', 'gym', 'studio', 'spa', 'salon', 'hotel',
      'brunch spot', 'dinner spot', 'lunch place', 'breakfast place',
      'coffee shop', 'wine bar', 'cocktail bar', 'juice bar'
    ];
    
    // Check if query contains vibe or business type keywords
    return vibeKeywords.some(keyword => lowerQuery.includes(keyword)) ||
           businessTypeKeywords.some(keyword => lowerQuery.includes(keyword));
  };

  // Main search handler
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    setSearchStartTime(Date.now());
    setIsSearching(true);
    setSearchResults([]);
    setHasSearched(true);
    setIsAppModeActive(true);

    try {
      // Check if user has enough credits
      if (user) {
        const hasCredits = await CreditService.hasEnoughCreditsForSearch(user.id, 'ai');
        if (!hasCredits) {
          setShowSignupPrompt(true);
          setIsSearching(false);
          return;
        }
      }

      // Determine search type based on query content
      let searchTypeToUse: 'platform' | 'ai' | 'semantic' | 'offerings' = 'platform';
      let results: any[] = [];

      // FIXED ROUTING LOGIC:
      if (isOfferingQuery(searchTerm)) {
        // Route to offerings search for specific items/services
        console.log('🍽️ Searching offerings for:', searchTerm);
        searchTypeToUse = 'offerings';
        
        try {
          const response = await fetch(`/.netlify/functions/search-offerings?q=${encodeURIComponent(searchTerm)}&lat=${latitude}&lng=${longitude}&limit=10`);
          const data = await response.json();
          
          if (data.success && data.results) {
            results = data.results.map((offering: any) => ({
              id: `offering-${offering.offeringId}`,
              name: offering.businessName,
              shortDescription: offering.offeringDescription,
              rating: 4.5, // Default rating for offerings
              image: offering.imageUrl,
              address: offering.businessAddress,
              hours: offering.businessHours,
              isOpen: offering.isOpen,
              distance: offering.distanceKm ? offering.distanceKm * 0.621371 : undefined, // Convert km to miles
              duration: Math.round((offering.distanceKm || 5) * 2), // Estimate duration
              reviews: [{
                text: offering.offeringDescription || 'Great offering that matches your search!',
                author: 'Platform User',
                thumbsUp: true
              }],
              isPlatformBusiness: false,
              isOfferingSearch: true,
              offeringId: offering.offeringId,
              businessId: offering.businessId,
              ctaLabel: offering.ctaLabel,
              latitude: offering.businessLatitude,
              longitude: offering.businessLongitude,
              phone_number: offering.businessPhone,
              website_url: offering.businessWebsite
            }));
          }
        } catch (error) {
          console.error('Offerings search error:', error);
        }
      } else {
        // Route to AI business search for vibe queries
        console.log('🧠 Searching AI businesses for vibe:', searchTerm);
        searchTypeToUse = 'ai';
        
        try {
          const response = await fetch('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: searchTerm,
              searchQuery: searchTerm,
              existingResultsCount: 0,
              numToGenerate: 15,
              latitude: latitude,
              longitude: longitude
            })
          });

          const data = await response.json();
          
          if (data.success && data.results) {
            results = data.results.map((business: any) => ({
              id: business.id,
              name: business.name,
              shortDescription: business.shortDescription,
              rating: business.rating || 4.5,
              image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              address: business.address,
              hours: business.hours,
              isOpen: business.isOpen,
              distance: business.distance,
              duration: business.duration,
              reviews: business.reviews || [],
              isPlatformBusiness: false,
              isGoogleVerified: business.isGoogleVerified,
              placeId: business.placeId,
              similarity: business.similarity,
              latitude: business.latitude,
              longitude: business.longitude,
              phone_number: business.phone_number,
              website_url: business.website_url
            }));
          }
        } catch (error) {
          console.error('AI business search error:', error);
        }
      }

      // If no results from AI search, try platform search as fallback
      if (results.length === 0 && searchTypeToUse !== 'offerings') {
        console.log('🔍 No AI results, trying platform search...');
        searchTypeToUse = 'platform';
        
        try {
          const platformResults = await BusinessService.getBusinesses({
            search: searchTerm,
            userLatitude: latitude,
            userLongitude: longitude
          });

          if (platformResults.length > 0) {
            results = platformResults.map((business: any) => ({
              id: business.id,
              name: business.name,
              shortDescription: business.short_description || business.description,
              rating: business.sentiment_score ? business.sentiment_score / 20 : 4.0,
              image: business.image_url,
              address: business.address,
              hours: business.hours,
              isOpen: true,
              distance: business.distance,
              duration: business.duration,
              reviews: business.reviews || [],
              isPlatformBusiness: true,
              similarity: 0.8,
              latitude: business.latitude,
              longitude: business.longitude,
              phone_number: business.phone_number,
              website_url: business.website_url
            }));
          }
        } catch (error) {
          console.error('Platform search error:', error);
        }
      }

      // If still no results, try semantic search as final fallback
      if (results.length === 0 && searchTypeToUse !== 'offerings') {
        console.log('🔍 No platform results, trying semantic search...');
        searchTypeToUse = 'semantic';
        
        try {
          const semanticResult = await SemanticSearchService.searchByVibe(searchTerm, {
            latitude,
            longitude,
            matchThreshold: 0.3,
            matchCount: 10
          });

          if (semanticResult.success && semanticResult.results) {
            results = semanticResult.results.map((business: any) => ({
              id: business.id,
              name: business.name,
              shortDescription: business.short_description || business.description,
              rating: business.sentiment_score ? business.sentiment_score / 20 : 4.0,
              image: business.image_url,
              address: business.address,
              hours: business.hours,
              isOpen: true,
              distance: business.distance,
              duration: business.duration,
              reviews: business.reviews || [],
              isPlatformBusiness: true,
              similarity: business.similarity,
              latitude: business.latitude,
              longitude: business.longitude,
              phone_number: business.phone_number,
              website_url: business.website_url
            }));
          }
        } catch (error) {
          console.error('Semantic search error:', error);
        }
      }

      setSearchResults(results);
      setSearchType(searchTypeToUse);

      // Deduct credits if user is authenticated
      if (user) {
        await CreditService.deductSearchCredits(user.id, searchTypeToUse);
        
        // Log search activity
        await ActivityService.logSearch(user.id, searchTerm, searchTypeToUse);
      }

      const searchTime = Date.now() - searchStartTime;
      console.log('Total Search Time:', searchTime, 'ms');
      console.log('✅ Search completed successfully');

    } catch (error) {
      console.error('Search error:', error);
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
      console.error('Error saving recommendation:', error);
      alert('Failed to add to favorites. Please try again.');
    }
  };

  const handleTakeMeThere = async (business: any) => {
    if (user) {
      await BusinessService.recordBusinessVisit(business.id, user.id);
    }

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

  const handleAuthSuccess = (user: any) => {
    setAuthModalOpen(false);
    setShowSignupPrompt(false);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
    setIsAppModeActive(false);
  };

  const exitAppMode = () => {
    setIsAppModeActive(false);
    setSearchResults([]);
    setHasSearched(false);
  };

  return (
    <>
      <section className={`relative transition-all duration-500 ${
        isAppModeActive 
          ? 'fixed inset-0 z-40 bg-white overflow-hidden' 
          : 'py-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900'
      }`}>
        
        {/* Search Header */}
        <div className={`${
          isAppModeActive 
            ? 'search-bar-fixed bg-white border-b border-neutral-200 header-shadow' 
            : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'
        }`}>
          <div className={isAppModeActive ? 'max-w-7xl mx-auto px-4 py-4' : ''}>
            {!isAppModeActive && (
              <div className="mb-8">
                <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-white mb-6">
                  Find Your Perfect Vibe
                </h1>
                <p className="font-lora text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                  Discover businesses that match your mood with AI-powered search
                </p>
              </div>
            )}

            {/* Search Bar */}
            <div className={`relative ${isAppModeActive ? 'max-w-2xl mx-auto' : 'max-w-2xl mx-auto'}`}>
              <div className="flex items-center">
                {isAppModeActive && (
                  <button
                    onClick={exitAppMode}
                    className="mr-3 p-2 text-neutral-600 hover:text-neutral-900 transition-colors duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                
                <form onSubmit={handleSearch} className="flex-1 relative">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Try: cozy coffee shop, peaceful brunch, trendy bar..."
                      className={`w-full pl-12 pr-16 py-4 border border-neutral-200 rounded-2xl font-lora text-neutral-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-lg ${
                        isAppModeActive ? 'text-base' : 'text-lg'
                      }`}
                      disabled={isSearching}
                    />
                    
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-12 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                    
                    <button
                      type="submit"
                      disabled={isSearching || !searchTerm.trim()}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary-500 text-white p-2 rounded-xl hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSearching ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Search className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </form>

                {isAppModeActive && user && (
                  <div className="ml-3 flex items-center">
                    <div className="bg-primary-100 text-primary-700 px-3 py-2 rounded-lg flex items-center">
                      <Zap className="h-4 w-4 mr-1" />
                      <span className="font-poppins text-sm font-semibold">
                        {user.credits || 0}
                      </span>
                    </div>
                    <CreditInfoTooltip placement="bottom" />
                  </div>
                )}
              </div>
            </div>

            {/* Location Status */}
            {!isAppModeActive && (
              <div className="mt-6 flex items-center justify-center text-white/80">
                <MapPin className="h-4 w-4 mr-2" />
                <span className="font-lora text-sm">
                  {locationError 
                    ? 'Location unavailable - showing general results'
                    : latitude && longitude 
                      ? 'Using your location for personalized results'
                      : 'Getting your location...'
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        {isAppModeActive && (
          <div className="pt-24 pb-8 px-4 h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {isSearching ? (
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-spin" />
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                    Finding your perfect match...
                  </h3>
                  <p className="font-lora text-neutral-600">
                    {searchType === 'offerings' ? 'Searching for specific items and services' :
                     searchType === 'ai' ? 'Using AI to find businesses that match your vibe' :
                     searchType === 'semantic' ? 'Using semantic search to understand your preferences' :
                     'Searching our platform businesses'}
                  </p>
                </div>
              ) : hasSearched ? (
                <div>
                  {searchResults.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
                          Found {searchResults.length} matches for "{searchTerm}"
                        </h2>
                        <div className="text-sm text-neutral-600 font-lora">
                          {searchType === 'offerings' ? 'Specific Items' :
                           searchType === 'ai' ? 'AI Generated' :
                           searchType === 'semantic' ? 'Semantic Match' :
                           'Platform Businesses'}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResults.map((business) => (
                          business.isPlatformBusiness ? (
                            <PlatformBusinessCard
                              key={business.id}
                              business={business}
                              onRecommend={handleRecommend}
                              onTakeMeThere={handleTakeMeThere}
                            />
                          ) : (
                            <AIBusinessCard
                              key={business.id}
                              business={business}
                              onRecommend={handleRecommend}
                            />
                          )
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Search className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                      <h3 className="font-cinzel text-2xl font-semibold text-neutral-900 mb-2">
                        No matches found
                      </h3>
                      <p className="font-lora text-neutral-600 mb-6">
                        Try a different search term or check your internet connection
                      </p>
                      <div className="space-y-2">
                        <p className="font-lora text-sm text-neutral-500">Try searching for:</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {['cozy coffee shop', 'trendy bar', 'family restaurant', 'quiet study spot'].map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => {
                                setSearchTerm(suggestion);
                                handleSearch();
                              }}
                              className="bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full text-sm font-lora hover:bg-primary-100 hover:text-primary-700 transition-colors duration-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <h3 className="font-cinzel text-2xl font-semibold text-neutral-900 mb-4">
                    What vibe are you looking for?
                  </h3>
                  
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="mb-8">
                      <h4 className="font-poppins text-lg font-semibold text-neutral-700 mb-4 flex items-center justify-center">
                        <Users className="h-5 w-5 mr-2" />
                        Recent Community Searches
                      </h4>
                      <div className="flex flex-wrap justify-center gap-3">
                        {recentSearches.slice(0, 8).map((search, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSearchTerm(search.query);
                              handleSearch();
                            }}
                            className="bg-white/10 backdrop-blur-sm text-neutral-700 px-4 py-2 rounded-full text-sm font-lora hover:bg-primary-100 hover:text-primary-700 transition-all duration-200 flex items-center border border-neutral-200"
                          >
                            <img 
                              src={search.avatar} 
                              alt="User" 
                              className="w-4 h-4 rounded-full mr-2"
                            />
                            "{search.query}"
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Non-app mode content */}
        {!isAppModeActive && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center mt-8">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mb-8">
                <h4 className="font-poppins text-lg font-semibold text-white/90 mb-4 flex items-center justify-center">
                  <Users className="h-5 w-5 mr-2" />
                  Recent Community Searches
                </h4>
                <div className="flex flex-wrap justify-center gap-3">
                  {recentSearches.slice(0, 6).map((search, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchTerm(search.query);
                        handleSearch();
                      }}
                      className="bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-lora hover:bg-white/20 transition-all duration-200 flex items-center"
                    >
                      <img 
                        src={search.avatar} 
                        alt="User" 
                        className="w-4 h-4 rounded-full mr-2"
                      />
                      "{search.query}"
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
          onSignup={() => {
            setAuthMode('signup');
            setAuthModalOpen(true);
            setShowSignupPrompt(false);
          }}
          onLogin={() => {
            setAuthMode('login');
            setAuthModalOpen(true);
            setShowSignupPrompt(false);
          }}
          onClose={() => setShowSignupPrompt(false)}
          title="Get More Credits"
          message="You need credits to search. Sign up for 200 free credits or log in to continue."
          signupButtonText="Sign Up for 200 Free Credits"
        />
      )}

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