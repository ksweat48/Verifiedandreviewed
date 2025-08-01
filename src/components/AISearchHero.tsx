import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Zap, X, ArrowRight, Navigation, Sparkles, Mic, LayoutDashboard } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '../hooks/useGeolocation';
import { BusinessService } from '../services/businessService';
import { ReviewService } from '../services/reviewService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { CreditService } from '../services/creditService';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';
import { useAnalytics } from '../hooks/useAnalytics';
import { calculateCompositeScore } from '../utils/similarityUtils';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import CreditInfoTooltip from './CreditInfoTooltip';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showBackToast, setShowBackToast] = useState(false);
  const [searchType, setSearchType] = useState<'platform' | 'ai' | 'semantic'>('platform');
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [userCredits, setUserCredits] = useState<number>(0);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [signupPromptConfig, setSignupPromptConfig] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { latitude, longitude, error: locationError } = useGeolocation();

  // Check for current user and load credits
  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await UserService.getCurrentUser();
        setCurrentUser(user);
        if (user) {
          setUserCredits(user.credits || 0);
        }
      } catch (error) {
        console.debug('No user logged in');
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

  // Quick search suggestions
  const quickSearches = [
    'cozy coffee shop',
    'romantic dinner',
    'energetic workout',
    'peaceful brunch',
    'trendy bar'
  ];

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setLastSearchQuery(searchTerm);
    setCurrentCardIndex(0);
    
    try {
      // Check if user is authenticated for credit-based searches
      const user = await UserService.getCurrentUser();
      
      // If user is not logged in, show signup prompt instead of searching
      if (!user) {
        setSignupPromptConfig({
          title: "You need credits to Vibe",
          message: "Get <strong>100 free credits</strong> when you sign up!",
          signupButtonText: "Let's Vibe",
          loginButtonText: "Already have an account? Log in",
          benefits: [
            "100 free credits when you sign up",
            "200 free credits instantly",
            "AI-powered vibe matching",
            "Save favorite businesses",
            "Access to all features"
          ]
        });
        setShowSignupPrompt(true);
        setIsSearching(false);
        setIsAppModeActive(false); // Keep hero visible for modal
        return; // Exit early - no search for unauthenticated users
      }
      
      // User is authenticated - proceed with search
      setIsAppModeActive(true); // Show loading screen for authenticated users
      
      // Determine search type based on user authentication and credits
      let effectiveSearchType: 'platform' | 'ai' | 'semantic' = 'platform';
      
      if (user) {
        // User is authenticated - check credits for advanced searches
        const hasCreditsForSemantic = await CreditService.hasEnoughCreditsForSearch(user.id, 'semantic');
        const hasCreditsForAI = await CreditService.hasEnoughCreditsForSearch(user.id, 'ai');
        
        if (hasCreditsForSemantic) {
          effectiveSearchType = 'semantic';
        } else if (hasCreditsForAI) {
          effectiveSearchType = 'ai';
        }
      }
      
      setSearchType(effectiveSearchType);
      
      // Log search activity if user is authenticated
      if (user) {
        ActivityService.logSearch(user.id, searchTerm, effectiveSearchType);
      }
      
      // Track search event
      trackEvent('search_performed', {
        query: searchTerm,
        search_type: effectiveSearchType,
        user_authenticated: !!user,
        has_location: !!(latitude && longitude)
      });

      let platformResults: any[] = [];
      let semanticResults: any[] = [];
      let aiResults: any[] = [];

      // Step 1: Always search platform businesses first
      console.log('🔍 Searching platform businesses...');
      const rawPlatformResults = await BusinessService.getBusinesses({
        search: searchTerm,
        userLatitude: latitude || undefined,
        userLongitude: longitude || undefined
      });

      // Transform platform businesses and fetch their reviews
      // Batch fetch reviews for all platform businesses
      let allBusinessReviews: any[] = [];
      if (rawPlatformResults.length > 0) {
        const businessIds = rawPlatformResults.map(business => business.id);
        console.log('📦 Batch fetching reviews for', businessIds.length, 'platform businesses');
        allBusinessReviews = await ReviewService.getBusinessReviews(businessIds);
      }
      
      // Create a map of business ID to reviews for quick lookup
      const reviewsMap = new Map();
      allBusinessReviews.forEach(review => {
        if (!reviewsMap.has(review.business_id)) {
          reviewsMap.set(review.business_id, []);
        }
        reviewsMap.get(review.business_id).push(review);
      });
      
      // Transform platform businesses with their reviews
      platformResults = rawPlatformResults.map(business => {
        const businessReviews = reviewsMap.get(business.id) || [];
        
        // Transform reviews to match expected format
        const formattedReviews = businessReviews.map((review: any) => ({
          text: review.review_text || 'No review text available',
          author: review.profiles?.name || 'Anonymous',
          authorImage: review.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100',
          images: (review.image_urls || []).map((url: string) => ({ url })),
          thumbsUp: review.rating >= 4
        }));
        
        return {
          ...business,
          // Ensure platform business identification
          isPlatformBusiness: true,
          // Transform rating structure for compatibility
          rating: {
            thumbsUp: business.thumbs_up || 0,
            thumbsDown: business.thumbs_down || 0,
            sentimentScore: business.sentiment_score || 0
          },
          // Ensure image property is available
          image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
          // Ensure isOpen property
          isOpen: true, // Default to open since we don't have real-time status
          // Add fetched reviews
          reviews: formattedReviews
        };
      });

      console.log(`✅ Found ${platformResults.length} platform businesses`);

      // Step 2: If authenticated and has credits, try semantic search
      if (user && effectiveSearchType === 'semantic') {
        console.log('🧠 Performing semantic search...');
        try {
          // Deduct credits for semantic search
          const creditDeducted = await CreditService.deductSearchCredits(user.id, 'semantic');
          if (creditDeducted) {
            // Update local credits display
            setUserCredits(prev => Math.max(0, prev - 5));
            
            const semanticResponse = await SemanticSearchService.searchByVibe(searchTerm, {
              latitude: latitude || undefined,
              longitude: longitude || undefined,
              matchThreshold: 0.3,
              matchCount: 10
            });
            
            if (semanticResponse.success) {
              semanticResults = semanticResponse.results || [];
              console.log(`✅ Semantic search found ${semanticResults.length} results`);
            }
          } else {
            console.warn('⚠️ Failed to deduct credits for semantic search');
          }
        } catch (error) {
          console.error('❌ Semantic search failed:', error);
        }
      }

      // Step 3: Combine platform and semantic results
      // Step 3: Combine and deduplicate all results using Map for guaranteed uniqueness
      console.log('🔄 Deduplicating results...');
      console.log('📊 Before deduplication:', {
        platform: platformResults.length,
        semantic: semanticResults.length,
        ai: aiResults.length
      });
      
      // Use Map for deduplication with priority: Platform > Semantic > AI
      const businessMap = new Map();
      
      // Add AI results first (lowest priority)
      aiResults.forEach(business => {
        if (business.id) {
          businessMap.set(business.id, business);
        }
      });
      
      // Add semantic results (medium priority - will overwrite AI if same ID)
      semanticResults.forEach(business => {
        if (business.id) {
          businessMap.set(business.id, business);
        }
      });
      
      // Add platform results last (highest priority - will overwrite semantic/AI if same ID)
      platformResults.forEach(business => {
        if (business.id) {
          businessMap.set(business.id, business);
        }
      });
      
      // Convert Map back to array
      let combinedResults = Array.from(businessMap.values());
      
      console.log('📊 After deduplication:', {
        total: combinedResults.length,
        uniqueIds: new Set(combinedResults.map(b => b.id)).size
      });

      // Calculate distances for all businesses that need it (batch operation)
      if (latitude && longitude && combinedResults.length > 0) {
        console.log('📏 Batch calculating distances for', combinedResults.length, 'businesses');
        try {
          const businessesNeedingDistance = combinedResults.filter(business => 
            business.latitude && business.longitude && (business.distance === 999999 || !business.distance)
          );
          
          if (businessesNeedingDistance.length > 0) {
            const updatedBusinesses = await BusinessService.calculateBusinessDistances(
              businessesNeedingDistance,
              latitude,
              longitude
            );
            
            // Create a map of business ID to distance data
            const distanceMap = new Map();
            updatedBusinesses.forEach(business => {
              distanceMap.set(business.id, {
                distance: business.distance,
                duration: business.duration
              });
            });
            
            // Update combinedResults with calculated distances
            combinedResults = combinedResults.map(business => {
              const distanceData = distanceMap.get(business.id);
              if (distanceData) {
                return {
                  ...business,
                  distance: distanceData.distance,
                  duration: distanceData.duration
                };
              }
              return business;
            });
            
            console.log('✅ Batch distance calculation completed');
          }
        } catch (distanceError) {
          console.warn('⚠️ Batch distance calculation failed:', distanceError);
        }
      }

      // Step 4: If we have fewer than 6 total results and user has AI credits, use AI search
      if (combinedResults.length < 10 && user && effectiveSearchType !== 'platform' && aiResults.length === 0) {
        console.log('🤖 Using AI search to fill remaining slots...');
        try {
          // Deduct credits for AI search
          const creditDeducted = await CreditService.deductSearchCredits(user.id, 'ai');
          if (creditDeducted) {
            // Update local credits display
            setUserCredits(prev => Math.max(0, prev - 10));
            
            const aiResponse = await fetch('/.netlify/functions/ai-business-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: searchTerm,
                searchQuery: searchTerm,
                existingResultsCount: combinedResults.length,
                numToGenerate: Math.max(1, 10 - combinedResults.length),
                latitude: latitude || undefined,
                longitude: longitude || undefined
              })
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              if (aiData.success && aiData.results) {
                aiResults = aiData.results;
                console.log(`✅ AI search generated ${aiResults.length} results`);
                
                // Re-deduplicate with new AI results
                aiResults.forEach(business => {
                  if (business.id && !businessMap.has(business.id)) {
                    businessMap.set(business.id, business);
                  }
                });
                
                // Update combined results
                combinedResults = Array.from(businessMap.values());
                
                console.log('📊 After adding AI results:', {
                  total: combinedResults.length,
                  uniqueIds: new Set(combinedResults.map(b => b.id)).size
                });
              }
            }
          }
        } catch (error) {
          console.error('❌ AI search failed:', error);
        }
      }

      // Step 5: Sort and rank results using composite scoring
      const rankedResults = combinedResults.map(business => ({
        ...business,
        compositeScore: calculateCompositeScore({
          similarity: business.similarity,
          distance: business.distance,
          isOpen: business.isOpen,
          isPlatformBusiness: business.isPlatformBusiness || platformResults.some(p => p.id === business.id)
        })
      })).sort((a, b) => {
        // First priority: Platform businesses always come before Google businesses
        const aIsPlatform = a.isPlatformBusiness || platformResults.some(p => p.id === a.id);
        const bIsPlatform = b.isPlatformBusiness || platformResults.some(p => p.id === b.id);
        
        if (aIsPlatform && !bIsPlatform) return -1; // a comes first
        if (!aIsPlatform && bIsPlatform) return 1;  // b comes first
        
        // Second priority: Within the same business type, sort by composite score
        return b.compositeScore - a.compositeScore;
      });

      console.log(`🎯 Final ranked results: ${rankedResults.length} businesses`);
      setSearchResults(rankedResults);
      setIsAppModeActive(true);

    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };


  const handleBackToSearch = () => {
    setIsAppModeActive(false);
    setSearchResults([]);
    setHasSearched(false);
    setShowBackToast(true);
    setTimeout(() => setShowBackToast(false), 2000);
    
    // Focus search input after a brief delay
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleRecommendBusiness = async (business: any) => {
    if (!currentUser) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      const success = await BusinessService.saveAIRecommendation(business, currentUser.id);
      if (success) {
        alert(`${business.name} has been saved to your favorites!`);
      } else {
        alert('Failed to save business. Please try again.');
      }
    } catch (error) {
      console.error('Error saving business:', error);
      alert('Failed to save business. Please try again.');
    }
  };

  const handleTakeMeThere = (business: any) => {
    // Record business visit if user is authenticated
    if (currentUser) {
      BusinessService.recordBusinessVisit(business.id, currentUser.id);
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
    
    window.open(mapsUrl, '_blank');
  };

  const handleVoiceSearch = async () => {
    // Check if Speech Recognition is available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please try Chrome, Safari, or Edge.');
      return;
    }

    if (isListening) {
      // Stop listening if already active
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        console.log('🎤 Voice recognition started');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        
        // Update search query with the transcript
        setSearchQuery(transcript);
        console.log('🎤 Voice transcript:', transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
        console.log('🎤 Voice recognition ended');
        
        // Auto-search if we have a query
        if (searchQuery.trim()) {
          setTimeout(() => handleSearch(), 500);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        console.error('🎤 Voice recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        } else if (event.error === 'no-speech') {
          alert('No speech detected. Please try again.');
        } else {
          alert('Voice recognition error. Please try again.');
        }
      };

      recognition.start();
    } catch (error) {
      console.error('🎤 Error starting voice recognition:', error);
      alert('Failed to start voice recognition. Please try again.');
      setIsListening(false);
    }
  };
  
  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
    setUserCredits(user.credits || 0);
    setShowSignupPrompt(false);
    setShowAuthModal(false);
  };

  if (isAppModeActive) {
    return (
      <div className="fixed inset-0 bg-white z-40 overflow-hidden">
        {/* Fixed Search Bar */}
        <div className="search-bar-fixed">
          <div className="flex items-center px-4 py-3 bg-white border-b border-neutral-200">
            <button
              onClick={handleBackToSearch}
              className="mr-3 p-2 rounded-full hover:bg-neutral-100 transition-colors duration-200"
            >
              <ArrowRight className="h-5 w-5 text-neutral-600 rotate-180" />
            </button>
            
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for vibes..."
                className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg font-lora text-neutral-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            {currentUser && (
              <div className="ml-3 flex items-center bg-primary-100 text-primary-700 px-3 py-1 rounded-lg">
                <Zap className="h-4 w-4 mr-1" />
                <span className="font-poppins text-sm font-semibold">{userCredits}</span>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        <div className="pt-16 h-full overflow-hidden">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-white mx-auto mb-6"></div>
                <p className="font-cinzel text-2xl font-bold text-white animate-pulse">
                  ONE MOMENT...
                </p>
                <p className="font-lora text-lg text-white/80 animate-pulse mt-2">
                  Vibe search in progress
                </p>
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <div className="text-center">
                <Search className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="font-cinzel text-xl font-semibold text-neutral-900 mb-2">
                  No Vibes Found
                </h3>
                <p className="font-lora text-neutral-600 mb-4">
                  Try a different vibe search or check your spelling.
                </p>
                <button
                  onClick={handleBackToSearch}
                  className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                >
                  Re-Vibe
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="px-4 py-4 space-y-4">
                {searchResults.map((business, index) => (
                  <div key={business.id || index} className="w-full max-w-sm mx-auto">
                    {business.isPlatformBusiness || business.id?.startsWith('platform-') ? (
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
            </div>
          )}
        </div>

        {/* Back Toast */}
        {showBackToast && (
          <div className="back-toast">
            Tap back to search again
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
        {/* Credits Display - Top Left */}
        {currentUser && !isAppModeActive && (
          <div className="absolute top-4 left-4 z-20 flex items-center">
            <Zap className="h-5 w-5 mr-2 text-white" />
            <span className="font-poppins text-lg font-bold text-white">
              {currentUser.role === 'administrator' && userCredits >= 999999 ? '∞' : userCredits}
            </span>
          </div>
        )}

        {/* Favorites and Dashboard Icons - Top Right */}
        {currentUser && !isAppModeActive && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
            <button
             onClick={() => navigate('/dashboard', { state: { activeTab: 'favorites' } })}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200 group"
              title="Favorites"
            >
              <Icons.Heart className="h-5 w-5 text-white group-hover:text-red-300 transition-colors duration-200" />
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200 group"
              title="Dashboard"
            >
              <LayoutDashboard className="h-5 w-5 text-white group-hover:text-primary-300 transition-colors duration-200" />
            </button>
          </div>
        )}

        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,107,94,0.2),transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(123,68,155,0.2),transparent_50%)]"></div>
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-full opacity-60 animate-pulse"></div>
          <div className="absolute top-40 right-20 w-1 h-1 bg-primary-400 rounded-full opacity-80 animate-pulse delay-1000"></div>
          <div className="absolute bottom-40 left-20 w-1.5 h-1.5 bg-accent-400 rounded-full opacity-70 animate-pulse delay-2000"></div>
          <div className="absolute bottom-20 right-10 w-2 h-2 bg-white rounded-full opacity-50 animate-pulse delay-500"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 text-center">
          {/* Brand Logo */}
          <div className="mb-8">
            <img 
              src="/verified and reviewed logo-coral copy copy.png" 
              alt="Verified & Reviewed" 
              className="h-16 w-16 mx-auto mb-4 opacity-90"
            />
          </div>

          {/* Main Heading */}
          <div className="mb-8">
            <h1 className="font-cinzel text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 tracking-tight">
              Vibe Search
            </h1>
            <p className="font-lora text-xl md:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed">
              Experience something new
            </p>
          </div>

          {/* Search Section */}
          <div className="w-full max-w-2xl mx-auto mb-12">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-2xl"></div>
              <div className="relative bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-white/50">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <button
                      onClick={handleVoiceSearch}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full hover:bg-neutral-100 transition-colors duration-200"
                      title={isListening ? 'Stop listening' : 'Voice search'}
                    >
                      <Mic className={`h-5 w-5 ${isListening ? 'text-red-500 animate-pulse' : 'text-neutral-400'}`} />
                    </button>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Describe your perfect vibe..."
                      className="w-full pl-4 pr-16 py-4 bg-white border border-white rounded-xl font-lora text-neutral-900 placeholder-neutral-600 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <button
                    onClick={() => handleSearch()}
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 py-4 md:px-8 rounded-xl font-poppins font-semibold hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSearching ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        {/* Mobile: Search icon only */}
                        <Search className="h-5 w-5 md:hidden" />
                        {/* Desktop: Sparkles icon + Vibe text */}
                        <span className="hidden md:inline">Vibe</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Search Tags */}
            <div className="text-center">
              <div className="flex flex-wrap justify-center gap-2">
                {quickSearches.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickSearch(suggestion)}
                    className="bg-white/10 backdrop-blur-sm text-white/90 px-4 py-2 rounded-full font-lora text-sm hover:bg-white/20 transition-all duration-200 border border-white/20 hover:border-white/30"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location Status */}
          {latitude && longitude ? (
            <div className="flex items-center text-white/60 text-sm font-lora">
              <MapPin className="h-4 w-4 mr-2" />
              <span>Location detected • Finding nearby matches</span>
            </div>
          ) : locationError ? (
            <div className="flex items-center text-white/60 text-sm font-lora">
              <MapPin className="h-4 w-4 mr-2" />
              <span>Enable location for better results</span>
            </div>
          ) : (
            <div className="flex items-center text-white/60 text-sm font-lora">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/60 mr-2"></div>
              <span>Getting your location...</span>
            </div>
          )}
        </div>
      </section>

      {/* Signup Prompt Modal */}
      {showSignupPrompt && (
        <SignupPrompt
          title={signupPromptConfig?.title}
          message={signupPromptConfig?.message}
          signupButtonText={signupPromptConfig?.signupButtonText}
          loginButtonText={signupPromptConfig?.loginButtonText}
          benefits={signupPromptConfig?.benefits}
          onSignup={() => {
            setShowSignupPrompt(false);
            setSignupPromptConfig(null);
            setSignupPromptConfig(null);
            setAuthMode('signup');
            setShowAuthModal(true);
          }}
          onLogin={() => {
            setShowSignupPrompt(false);
            setSignupPromptConfig(null);
            setSignupPromptConfig(null);
            setAuthMode('login');
            setShowAuthModal(true);
          }}
          onClose={() => {
            setShowSignupPrompt(false);
            setSignupPromptConfig(null);
            setSignupPromptConfig(null);
          }}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode={authMode}
          onAuthSuccess={handleAuthSuccess}
        />
      )}
    </>
  );
};

export default AISearchHero;