import React, { useState, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { BusinessService } from '../services/businessService';
import { ReviewService } from '../services/reviewService';
import { CreditService } from '../services/creditService';
import { SemanticSearchService } from '../services/semanticSearchService';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';

interface BusinessCard {
  id: string;
  name: string;
  rating: {
    thumbsUp: number;
    thumbsDown: number;
    sentimentScore: number;
  };
  address?: string;
  location?: string;
  category?: string;
  tags?: string[];
  description?: string;
  imageUrl?: string;
  hours?: string;
  isVerified?: boolean;
  isPlatformBusiness?: boolean;
  reviews?: Array<{
    id: string;
    text: string;
    author: string;
    authorImage?: string;
    images: Array<{
      url: string;
      alt: string;
    }>;
    thumbsUp: boolean;
    level?: number;
    reviewCount?: number;
  }>;
}

interface AISearchHeroProps {
  onBusinessSelect?: (business: BusinessCard) => void;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ onBusinessSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<BusinessCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isAppModeActive, setIsAppModeActive] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [semanticSearchAvailable, setSemanticSearchAvailable] = useState(false);
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  
  const { user, isAuthenticated, userCredits, refreshUserCredits } = useAuth();
  const { 
    location, 
    error: geoError, 
    loading: geoLoading, 
    getCurrentLocation 
  } = useGeolocation();
  
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  const samplePrompts = [
    "cozy coffee shops",
    "best brunch spots", 
    "romantic dinner",
    "family activities",
    "late night eats"
  ];

  useEffect(() => {
    const checkSemanticSearch = async () => {
      try {
        const available = await SemanticSearchService.isAvailable();
        setSemanticSearchAvailable(available);
        setUseSemanticSearch(available);
      } catch (error) {
        console.error('Error checking semantic search availability:', error);
        setSemanticSearchAvailable(false);
        setUseSemanticSearch(false);
      }
    };

    checkSemanticSearch();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setShowResults(true);
    setIsAppModeActive(true);
    setShowCreditWarning(false);
    setUsedAI(false);
    
    try {
      await getCurrentLocation();
      
      const creditCost = useSemanticSearch && semanticSearchAvailable ? 10 : 1;
      
      if (isAuthenticated && userCredits < creditCost) {
        setShowCreditWarning(true);
        setIsSearching(false);
        return;
      }
      
      if (!isAuthenticated && !semanticSearchAvailable) {
        setShowSignupPrompt(true);
        setIsSearching(false);
        return;
      }

      let searchResults = [];
      
      if (useSemanticSearch && semanticSearchAvailable) {
        try {
          const semanticResults = await SemanticSearchService.searchBusinesses(
            searchQuery,
            location?.latitude,
            location?.longitude
          );
          searchResults = semanticResults;
          setUsedAI(true);
        } catch (error) {
          console.error('Semantic search failed, falling back to regular search:', error);
          setShowCreditWarning(true);
          setIsSearching(false);
          return;
        }
      } else {
        const aiResults = await fetch('/api/ai-business-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            latitude: location?.latitude,
            longitude: location?.longitude
          })
        });
        
        if (!aiResults.ok) {
          throw new Error('AI search failed');
        }
        
        const data = await aiResults.json();
        searchResults = data.businesses || [];
        setUsedAI(true);
      }

      const realBusinesses = await BusinessService.getAllBusinesses();
      
      const businessesWithReviews = await Promise.all(
        realBusinesses.map(async (business) => {
          try {
            const reviews = await ReviewService.getBusinessReviews(business.id);
            const transformedReviews = reviews.map(review => ({
              id: review.id,
              text: review.review_text,
              author: review.profiles?.name || 'Anonymous',
              authorImage: review.profiles?.avatar_url,
              images: (review.image_urls || []).map((url: string, index: number) => ({
                url,
                alt: `Review image ${index + 1}`
              })),
              thumbsUp: review.rating >= 4,
              level: review.profiles?.level || 1,
              reviewCount: review.profiles?.review_count || 0
            }));
            
            return {
              ...business,
              reviews: transformedReviews
            };
          } catch (error) {
            console.error(`Error fetching reviews for business ${business.id}:`, error);
            return {
              ...business,
              reviews: []
            };
          }
        })
      );

      let transformedBusinesses: BusinessCard[] = businessesWithReviews.map(business => ({
        id: business.id,
        name: business.name,
        rating: {
          thumbsUp: business.thumbs_up || 0,
          thumbsDown: business.thumbs_down || 0,
          sentimentScore: business.sentiment_score || 0
        },
        address: business.address,
        location: business.location,
        category: business.category,
        tags: business.tags,
        description: business.description,
        imageUrl: business.image_url,
        hours: business.hours,
        isVerified: business.is_verified,
        isPlatformBusiness: true,
        reviews: business.reviews || []
      }));

      const combinedResults = [...transformedBusinesses, ...searchResults];
      setResults(combinedResults);
      
      if (isAuthenticated) {
        await CreditService.deductCredits(user.id, creditCost, 
          useSemanticSearch ? 'semantic_search' : 'ai_search', 
          `Search: "${searchQuery}"`
        );
        await refreshUserCredits();
      }
      
    } catch (error) {
      console.error('Search error:', error);
      setShowCreditWarning(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRecommend = async (business: BusinessCard) => {
    // Implementation for recommendation
  };

  const handleTakeMeThere = (business: BusinessCard) => {
    if (business.address) {
      const encodedAddress = encodeURIComponent(business.address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  const handleSignup = () => {
    setShowSignupPrompt(false);
  };

  const handleLogin = () => {
    setShowSignupPrompt(false);
  };

  const exitAppMode = () => {
    setIsAppModeActive(false);
    setShowResults(false);
    setResults([]);
    setSearchQuery('');
  };

  const startVoiceRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setIsListening(false);
      };
      
      recognition.onerror = () => {
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.start();
    }
  };

  return (
    <div className="relative w-full">
      {!showResults && (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)), url('https://images.pexels.com/photos/1581384/pexels-photo-1581384.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')`
            }}
          />
          
          <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="font-poppins text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                Find Your Next
                <span className="block bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                  Favorite Spot
                </span>
              </h1>
              <p className="font-lora text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
                Discover amazing local businesses through AI-powered search. 
                Tell us what you're looking for and we'll find the perfect match.
              </p>
            </div>
            
            <div 
              ref={searchRef}
              className="relative max-w-2xl mx-auto mb-8"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur opacity-20"></div>
              <div className="relative bg-white rounded-xl shadow-2xl border border-white/20 p-2">
                <form onSubmit={(e) => {e.preventDefault(); handleSearch();}} className="flex items-center">
                  <Icons.Sparkles className="h-6 w-6 text-primary-500 ml-4 mr-3 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="peaceful brunch spot, vibe-y wine bar, cozy coffee for work..."
                    className="flex-1 py-4 px-2 text-lg font-lora text-neutral-700 placeholder-neutral-400 bg-transparent border-none outline-none"
                  />
                  <button
                    onClick={startVoiceRecognition}
                    className={`p-3 rounded-full mr-2 ${isListening ? 'bg-primary-100 text-primary-600 animate-pulse' : 'text-neutral-400 hover:text-primary-500 hover:bg-primary-50'} transition-colors duration-200`}
                    aria-label="Voice search"
                    type="button"
                  >
                    <Icons.Mic className="h-5 w-5" />
                  </button>
                  
                  {isAuthenticated && userCredits > 0 && (
                    <div className="flex items-center mr-3 bg-primary-50 px-3 py-2 rounded-lg">
                      {semanticSearchAvailable && useSemanticSearch ? (
                        <Icons.Brain className="h-4 w-4 text-purple-500 mr-2" />
                      ) : (
                        <Icons.Zap className="h-4 w-4 text-primary-500 mr-2" />
                      )}
                      <span className="font-poppins text-sm font-semibold text-primary-700">
                        {userCredits} credits
                      </span>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSearching || geoLoading}
                    className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-6 py-4 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                    aria-label="Search"
                  >
                    {isSearching ? (
                      <span className="flex items-center">
                        <Icons.Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Thinking...
                      </span>
                    ) : geoLoading ? (
                      <span className="flex items-center">
                        <Icons.MapPin className="h-5 w-5 animate-pulse mr-2" />
                        Locating...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Icons.Search className="h-5 w-5 mr-2" />
                        Search
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </div>
            
            {/* Sample Prompts */}
            <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
              {samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setSearchQuery(prompt);
                    handleSearch();
                  }}
                  className="bg-white/10 border border-white/30 text-white px-3 py-1 rounded-full text-sm font-lora hover:bg-white/20 hover:border-white transition-colors duration-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showResults && (
        <div className={`w-full bg-white border-b border-neutral-100 shadow-sm ${isAppModeActive ? 'search-bar-fixed' : 'sticky top-16 z-40'} mb-1`}>
        <div ref={searchBarRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div 
            ref={searchRef}
            className="relative w-full"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur opacity-20"></div>
            <div className="relative bg-white rounded-xl shadow-md border border-neutral-200 p-2 w-full">
              <form onSubmit={(e) => {e.preventDefault(); handleSearch();}} className="flex items-center w-full">
                <Icons.Sparkles className="h-5 w-5 text-primary-500 ml-2 sm:ml-4 mr-2 sm:mr-3 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="peaceful brunch spot, vibe-y wine bar, cozy coffee for work..."
                  className="flex-1 py-2 sm:py-3 px-2 text-base font-lora text-neutral-700 placeholder-neutral-400 bg-transparent border-none outline-none min-w-0"
                />
                <button
                  onClick={startVoiceRecognition}
                  className={`p-2 rounded-full ${isListening ? 'bg-primary-100 text-primary-600 animate-pulse' : 'text-neutral-400 hover:text-primary-500 hover:bg-primary-50'} transition-colors duration-200 flex-shrink-0`}
                  aria-label="Voice search"
                  type="button"
                >
                  <Icons.Mic className="h-5 w-5" />
                </button>
                
                {/* Credit display for logged-in users */}
               {isAuthenticated && userCredits > 0 && (
                  <div className="hidden sm:flex items-center mr-2 bg-primary-50 px-2 py-1 rounded-lg">
                    {semanticSearchAvailable && useSemanticSearch ? (
                      <Icons.Brain className="h-3 w-3 text-purple-500 mr-1" />
                    ) : (
                      <Icons.Zap className="h-3 w-3 text-primary-500 mr-1" />
                    )}
                    <span className="font-poppins text-xs font-semibold text-primary-700">
                      {userCredits} credits
                    </span>
                  </div>
                )}
                
                {/* Free trial credits for non-logged-in users */}
                <button
                  type="submit"
                  disabled={isSearching || geoLoading} // Disable search if geolocation is loading
                  className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0"
                  aria-label="Search"
                >
                  {isSearching ? (
                    <span className="flex items-center">
                      <Icons.Loader2 className="h-5 w-5 animate-spin sm:mr-2" />
                      <span className="hidden sm:inline">Thinking...</span>
                    </span>
                  ) : geoLoading ? ( // Show loading state for geolocation
                    <span className="flex items-center">
                      <Icons.MapPin className="h-5 w-5 animate-pulse sm:mr-2" />
                      <span className="hidden sm:inline">Locating...</span>
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Icons.Search className="h-5 w-5 sm:mr-2" />
                      <span className="hidden sm:inline">Search</span>
                    </span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
        </div>
      )}
      
      {/* Exit Search Button */}
      {isAppModeActive && (
        <button 
          onClick={exitAppMode}
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-auto px-4 py-2 bg-white bg-opacity-80 rounded-full shadow-lg flex items-center justify-center border border-neutral-100"
          aria-label="Exit search mode"
        >
          <Icons.LogOut className="h-4 w-4 mr-2 text-neutral-600" />
          <span className="font-poppins text-sm text-neutral-600">Exit Search</span>
        </button>
      )}
      
      {geoError && ( // Display geolocation error
        <div className="max-w-md mx-auto mt-4 bg-red-50 border border-red-200 rounded-xl p-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Icons.AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="font-poppins text-sm font-semibold text-red-800">
                Location Error
              </h3>
              <p className="font-lora text-xs text-red-700 mt-1">
                {geoError}
              </p>
              <p className="font-lora text-xs text-red-700 mt-1">
                Search results might be less relevant without your precise location.
              </p>
            </div>
            <button
              onClick={() => { /* Optionally clear error or provide retry */ }}
              className="ml-auto flex-shrink-0 text-red-500 hover:text-red-700"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showCreditWarning && (
        <div className="max-w-md mx-auto mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Icons.AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="ml-3">
              <h3 className="font-poppins text-sm font-semibold text-yellow-800">
                {userCredits < (usedAI ? 10 : 1) ? 'Not enough credits' : 'Search temporarily unavailable'}
              </h3>
              <p className="font-lora text-xs text-yellow-700 mt-1">
                {userCredits < (usedAI ? 10 : 1) 
                  ? `You need ${usedAI ? '10 credits' : '1 credit'} for this search. Purchase more credits to continue searching.`
                  : 'AI search is temporarily unavailable. Please try again in a moment.'
                }
              </p>
              <div className="mt-2">
                {userCredits < (usedAI ? 10 : 1) ? (
                  <button
                    onClick={() => {
                      // Navigate to credits page
                      window.location.href = '/account';
                    }}
                    className="font-poppins text-xs font-semibold text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Get More Credits
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCreditWarning(false)}
                    className="font-poppins text-xs font-semibold text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowCreditWarning(false)}
              className="ml-auto flex-shrink-0 text-yellow-500 hover:text-yellow-700"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showSignupPrompt && (
        <div className="max-w-md mx-auto mt-4 animate-in slide-in-from-top-4 duration-300">
          <SignupPrompt 
            onClose={() => setShowSignupPrompt(false)}
            onSignup={handleSignup}
            onLogin={handleLogin}
          />
        </div>
      )}

      <div
        ref={resultsRef} 
        className={`transition-all duration-500 z-10 w-full ${isAppModeActive ? 'pt-20' : ''} ${
          showResults && results.length > 0 ? 'opacity-100 mt-0 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
        style={{
          height: isAppModeActive ? 'calc(100vh - 60px)' : 'auto',
          maxHeight: isAppModeActive ? 'calc(100vh - 60px)' : showResults ? '800px' : '0'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 relative z-20">
          {results.length > 0 && showResults && (
            <div className="relative">
              {/* Vertical scrollable layout */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-8"
              >
                {results.map((business, businessIndex) => (
                  <div key={`${business.id}-${businessIndex}`} className={business.isPlatformBusiness ? "sm:col-span-2 lg:col-span-2 flex flex-col h-full" : ""}>
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
          )}
          
          {showResults && results.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.Search className="h-8 w-8 text-neutral-400" />
              </div>
              <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                No businesses found
              </h3>
              <p className="font-lora text-neutral-600 mb-4">
                We couldn't find any businesses matching "{searchQuery}" in your area.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowResults(false);
                  setIsAppModeActive(false);
                }}
                className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
              >
                Try Another Search
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default AISearchHero;