import React, { useState, useEffect, useRef } from 'react';
import { Search, Zap, X, ArrowRight, Mic, LayoutDashboard } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BusinessService } from '../services/businessService';
import { ReviewService } from '../services/reviewService';
import { SemanticSearchService } from '../services/semanticSearchService';
import { CreditService } from '../services/creditService';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';
import { useAnalytics } from '../hooks/useAnalytics';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import { supabase } from '../services/supabaseClient';
import { usePendingReviewsCount } from '../hooks/usePendingReviewsCount';
import { getAvatarForUser } from '../utils/displayUtils';

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
  const [isOutOfCreditsModal, setIsOutOfCreditsModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Get pending reviews count for notification dot
  const { pendingReviewsCount, loading: loadingPendingReviews } = usePendingReviewsCount(currentUser?.id);
  

  // Handle browser back button when in app mode
  useEffect(() => {
    if (isAppModeActive) {
      // Push a new state when entering app mode
      window.history.pushState({ appMode: true }, '', window.location.href);
      
      const handlePopState = (event) => {
        // If we're in app mode and user presses back, exit app mode instead of leaving the site
        if (isAppModeActive) {
          setIsAppModeActive(false);
          setSearchResults([]);
          setHasSearched(false);
          
          // Show back toast
          setShowBackToast(true);
          setTimeout(() => setShowBackToast(false), 2000);
          
          // Focus search input after a brief delay
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 100);
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isAppModeActive, setIsAppModeActive]);
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

  // Listen for review updates to refresh search results
  useEffect(() => {
    const handleReviewUpdate = () => {
      // Only refresh if we're in app mode and have search results
      if (isAppModeActive && hasSearched && lastSearchQuery) {
        console.log('🔄 Refreshing search results after review update');
        handleSearch(lastSearchQuery);
      }
    };
    
    window.addEventListener('visited-businesses-updated', handleReviewUpdate);
    
    return () => {
      window.removeEventListener('visited-businesses-updated', handleReviewUpdate);
    };
  }, [isAppModeActive, hasSearched, lastSearchQuery]);

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    // Clear previous search results immediately for clean UX
    setSearchResults([]);
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
      // Check if user has enough credits for search (2 credits required)
      const hasEnoughCredits = await CreditService.hasEnoughCreditsForSearch(user.id, 'unified');
      if (!hasEnoughCredits) {
        // User is out of credits - show out of credits modal
        setSignupPromptConfig({
          title: "Out of Credits!",
          message: "You need <strong>2 credits</strong> to search. Get more credits to continue vibing!",
          signupButtonText: "Get More Credits",
          loginButtonText: "View Credit Options",
          benefits: [
            "50 free credits every month",
            "2 credits per review you write",
            "20 credits per friend referral",
            "Purchase credit packages starting at $2.99",
            "Auto-refill options available"
          ]
        });
        setIsOutOfCreditsModal(true);
        setShowSignupPrompt(true);
        setIsSearching(false);
        setIsAppModeActive(false); // Keep hero visible for modal
        return; // Exit early - no search for users without credits
      }
      
      setIsAppModeActive(true); // Show loading screen for authenticated users
      
      // Set search type to unified
      setSearchType('ai'); // Show as 'ai' since we're using the intelligent unified system
      
      // Log search activity if user is authenticated
      if (user) {
        ActivityService.logSearch(user.id, searchTerm, 'unified');
      }
      
      // Track search event
      trackEvent('search_performed', {
        query: searchTerm,
        search_type: 'intelligent_unified',
        user_authenticated: !!user
      });

      // Deduct credits for unified search
      const creditDeducted = await CreditService.deductSearchCredits(user.id, 'unified');
      if (!creditDeducted) {
        console.warn('⚠️ Failed to deduct credits for intelligent search');
        setIsSearching(false);
        setIsAppModeActive(false);
        return;
      }
      
      // Update local credits display
      setUserCredits(prev => Math.max(0, prev - 2));
      
      // Perform unified search
      console.log('🔍 Performing unified search...');
      const searchResponse = await SemanticSearchService.searchByVibe(searchTerm, {
        latitude: undefined,
        longitude: undefined,
        matchThreshold: 0.3,
        matchCount: 15
      });
      
      if (searchResponse.success) {
        console.log(`✅ Unified search completed: ${searchResponse.results.length} results`);
        console.log('📊 Search sources:', searchResponse.searchSources);
        
        // Fetch reviews for all platform businesses in the results
        const platformBusinessIds = searchResponse.results
          .filter(business => business.isPlatformBusiness || business.source === 'offering' || business.source === 'platform_business')
          .map(business => business.id || business.business_id)
          .filter(Boolean);
        
        let allBusinessReviews: any[] = [];
        if (platformBusinessIds.length > 0) {
          console.log('📦 Batch fetching reviews for', platformBusinessIds.length, 'platform businesses');
          allBusinessReviews = await ReviewService.getBusinessReviews(platformBusinessIds);
        }
        
        // Create a map of business ID to reviews for quick lookup
        const reviewsMap = new Map();
        allBusinessReviews.forEach(review => {
          if (!reviewsMap.has(review.business_id)) {
            reviewsMap.set(review.business_id, []);
          }
          reviewsMap.get(review.business_id).push(review);
        });
        
        // Enrich results with reviews
        const enrichedResults = searchResponse.results.map(business => {
          const businessId = business.id || business.business_id;
          const businessReviews = reviewsMap.get(businessId) || [];
          
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
            reviews: business.reviews || formattedReviews,
            // Ensure compatibility fields
            isPlatformBusiness: business.isPlatformBusiness || business.source === 'offering' || business.source === 'platform_business'
          };
        });
        
        setSearchResults(enrichedResults);
      } else {
        console.error('❌ Unified search failed:', searchResponse.error);
        setSearchResults([]);
      }
      setIsAppModeActive(true);

    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };


  const handleBackToSearch = () => {
    // Use browser's back functionality to trigger the popstate handler
    window.history.back();
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
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-40 overflow-hidden">
        {/* Fixed Search Bar */}
        <div className="search-bar-fixed bg-gradient-to-r from-slate-800 to-purple-800">
          <div className="flex items-center px-4 py-3 border-b border-white/20">
            <button
              onClick={handleBackToSearch}
              className="mr-3 p-2 rounded-full hover:bg-white/10 transition-colors duration-200"
            >
              <ArrowRight className="h-5 w-5 text-white rotate-180" />
            </button>
            
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for vibes..."
                className="w-full pl-10 pr-4 py-2 bg-white/90 backdrop-blur-sm border border-white/30 rounded-lg font-lora text-neutral-900 placeholder-neutral-600 focus:ring-2 focus:ring-white focus:border-white focus:bg-white"
              />
            </div>
            
            {currentUser && (
              <div className="ml-3 flex items-center bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-lg border border-white/30">
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
            <div className="flex items-center justify-center h-full px-4 text-white">
              <div className="text-center">
                <Search className="h-16 w-16 text-white/60 mx-auto mb-4" />
                <h3 className="font-cinzel text-xl font-semibold text-white mb-2">
                  No Vibes Found
                </h3>
                <p className="font-lora text-white/80 mb-4">
                  Try a different vibe search or check your spelling.
                </p>
                <button
                  onClick={handleBackToSearch}
                  className="font-poppins bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors duration-200 border border-white/30"
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
      <section className="relative bg-white py-4">
        {/* Credits Display - Top Left */}
        {currentUser && !isAppModeActive && (
          <div className="absolute top-4 left-4 z-20 flex items-center bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-neutral-200">
            <Zap className="h-5 w-5 mr-2 text-primary-500" />
            <span className="font-poppins text-lg font-bold text-neutral-900">
              {currentUser.role === 'administrator' && userCredits >= 999999 ? '∞' : userCredits}
            </span>
          </div>
        )}

        {/* Favorites and Dashboard Icons - Top Right */}
        {currentUser && !isAppModeActive && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard', { state: { activeTab: 'favorites' } })}
              className="p-3 rounded-full bg-white/90 backdrop-blur-sm border border-neutral-200 hover:bg-neutral-100 transition-all duration-200 group"
              title="Favorites"
            >
              <Icons.Heart className="h-5 w-5 text-neutral-600 group-hover:text-red-500 transition-colors duration-200" />
            </button>
            
            <div className="relative">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-3 rounded-full bg-white/90 backdrop-blur-sm border border-neutral-200 hover:bg-neutral-100 transition-all duration-200 group"
                title="Dashboard"
              >
                <LayoutDashboard className="h-5 w-5 text-neutral-600 group-hover:text-primary-500 transition-colors duration-200" />
              </button>
              {/* Notification dot for pending reviews */}
              {!loadingPendingReviews && pendingReviewsCount > 0 && (
                <span className="notification-dot absolute -top-1 -right-1"></span>
              )}
            </div>
          </div>
        )}

        {/* Minimal Header Content */}
        <div className="relative z-10 flex flex-col items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
          {!isAppModeActive && (
            <div className="relative mb-6">
              <h1 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 text-center">
              </h1>
              <p className="font-lora text-lg text-neutral-600 text-center mt-2">
              </p>
              <p className="font-lora text-lg text-neutral-600 text-center mt-6 pt-8">
                Discover new businesses by offerings
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Floating Search Button */}
      {!isAppModeActive && (
        <button
          onClick={() => setIsAppModeActive(true)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
          title="Search for experiences"
        >
          <Search className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
        </button>
      )}

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
            setIsOutOfCreditsModal(false);
            if (isOutOfCreditsModal) {
              // Navigate to credits tab in dashboard
              navigate('/dashboard', { state: { activeTab: 'credits' } });
            } else {
              // Regular signup flow
              setAuthMode('signup');
              setShowAuthModal(true);
            }
          }}
          onLogin={() => {
            setShowSignupPrompt(false);
            setSignupPromptConfig(null);
            setIsOutOfCreditsModal(false);
            if (isOutOfCreditsModal) {
              // Navigate to credits tab in dashboard
              navigate('/dashboard', { state: { activeTab: 'credits' } });
            } else {
              // Regular login flow
              setAuthMode('login');
              setShowAuthModal(true);
            }
          }}
          onClose={() => {
            setShowSignupPrompt(false);
            setSignupPromptConfig(null);
            setIsOutOfCreditsModal(false);
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