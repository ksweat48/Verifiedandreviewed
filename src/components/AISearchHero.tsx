import React, { useState, useEffect, useRef } from 'react';
import { Search, Zap, X, ArrowRight, Mic, LayoutDashboard } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ReviewService } from '../services/reviewService';
import { KeywordSearchService } from '../services/keywordSearchService';
import { CreditService } from '../services/creditService';
import { UserService } from '../services/userService';
import { ActivityService } from '../services/activityService';
import { useAnalytics } from '../hooks/useAnalytics';
import { useGeolocation } from '../hooks/useGeolocation';
import OfferingCard from './OfferingCard';
import SignupPrompt from './SignupPrompt';
import AuthModal from './AuthModal';
import OfferingReviewsModal from './OfferingReviewsModal';
import { supabase } from '../services/supabaseClient';
import { usePendingReviewsCount } from '../hooks/usePendingReviewsCount';
import { getAvatarForUser, isBusinessOpen } from '../utils/displayUtils';
import { showSuccess, showError } from '../utils/toast';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

// Combined sorting algorithm for search results
const sortSearchResults = (results: any[]): any[] => {
  return results.sort((a, b) => {
    // 1. Open businesses first (highest priority)
    if (a.isOpen !== b.isOpen) {
      return b.isOpen ? 1 : -1; // Open businesses come first
    }
    
    // 2. Platform offerings over AI businesses (when open/closed status is same)
    if (a.isPlatformBusiness !== b.isPlatformBusiness) {
      return b.isPlatformBusiness ? 1 : -1; // Platform offerings come first
    }
    
    // 3. Relevance score (higher is better)
    const aRelevance = a.relevanceScore || 0;
    const bRelevance = b.relevanceScore || 0;
    if (Math.abs(aRelevance - bRelevance) > 0.1) { // Only sort by relevance if difference is significant
      return bRelevance - aRelevance;
    }
    
    // 4. Distance (closer is better)
    const aDistance = a.distance || 999999;
    const bDistance = b.distance || 999999;
    return aDistance - bDistance;
  });
};

// Normalize relevance scores to 0-1 scale for comparison
const normalizeRelevanceScore = (business: any): number => {
  if (business.isPlatformBusiness) {
    // For platform offerings, use keywordMatchPercentage (already 0-1)
    return business.keywordMatchPercentage || 0;
  } else {
    // For AI businesses, use similarity (already 0-1)
    return business.similarity || 0;
  }
};

// Ensure business has proper isOpen status
const ensureOpenStatus = (business: any): any => {
  return {
    ...business,
    isOpen: business.isOpen !== undefined ? business.isOpen : isBusinessOpen(business)
  };
};
const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { latitude, longitude, error: locationError, loading: locationLoading } = useGeolocation();
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
  const [showFloatingSearchInput, setShowFloatingSearchInput] = useState(false);
  const [searchOfferingReviewCounts, setSearchOfferingReviewCounts] = useState<Record<string, number>>({});
  const [isOfferingReviewsModalOpen, setIsOfferingReviewsModalOpen] = useState(false);
  const [selectedOfferingForReviews, setSelectedOfferingForReviews] = useState<{
    id: string;
    title: string;
    businessName: string;
  } | null>(null);
  
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
    const searchTerm = String(query || searchQuery || '');
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
      
      // Hide floating search input when starting search
      setShowFloatingSearchInput(false);
      
      // Set search type to keyword
      setSearchType('platform'); // Show as 'platform' since we're using keyword search on platform offerings
      
      // Log search activity if user is authenticated
      if (user) {
        ActivityService.logSearch(user.id, searchTerm, 'keyword');
      }
      
      // Track search event
      trackEvent('search_performed', {
        query: searchTerm,
        search_type: 'keyword_search',
        user_authenticated: !!user
      });

      // Deduct credits for unified search
      const creditDeducted = await CreditService.deductSearchCredits(user.id, 'keyword');
      if (!creditDeducted) {
        console.warn('⚠️ Failed to deduct credits for keyword search');
        setIsSearching(false);
        setIsAppModeActive(false);
        return;
      }
      
      // Update local credits display
      setUserCredits(prev => Math.max(0, prev - 2));
      
      // Perform keyword search
      console.log('🔍 Performing keyword search...');
      const searchResponse = await KeywordSearchService.searchOfferings(searchTerm, {
        latitude: latitude,
        longitude: longitude,
        matchCount: 10
      });
      
      if (searchResponse.success) {
        console.log(`✅ Keyword search completed: ${searchResponse.results.length} results`);
        console.log('🔍 Main keywords used:', searchResponse.keywords);
        
        // Also perform AI business search to include AI-generated businesses
        console.log('🤖 Performing AI business search...');
        let aiBusinesses = [];
        try {
          const aiResponse = await fetch('/.netlify/functions/ai-search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: searchTerm,
              latitude: latitude,
              longitude: longitude,
             matchCount: 15 // Get more AI results to fill remaining slots after platform offerings
            })
          });
          
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.businesses) {
              aiBusinesses = aiData.businesses.map(business => ({
                ...business,
                isAIGenerated: true,
                isPlatformBusiness: false,
                source: 'ai'
              }));
              console.log(`✅ AI search completed: ${aiBusinesses.length} AI businesses found`);
            }
          } else {
            console.warn('⚠️ AI search service not available');
          }
        } catch (aiError) {
          console.warn('⚠️ AI search failed:', aiError);
        }
        
        // Fetch reviews for all platform businesses in the results
        const platformBusinessIds = searchResponse.results
          .filter(business => business.isPlatformBusiness)
          .map(business => business.id || business.business_id)
          .filter(Boolean);
        
        let allBusinessReviews: any[] = [];
        const offeringReviewCounts: Record<string, number> = {};
        
        if (platformBusinessIds.length > 0) {
          console.log('📦 Batch fetching reviews for', platformBusinessIds.length, 'platform businesses');
          allBusinessReviews = await ReviewService.getBusinessReviews(platformBusinessIds);
          
          // Calculate review counts for offerings
          searchResponse.results.forEach(business => {
            if (business.offeringId || business.id) {
              const offeringId = business.offeringId || business.id;
              const businessId = business.business_id || business.id;
              const reviewsForBusiness = allBusinessReviews.filter(review => review.business_id === businessId);
              offeringReviewCounts[offeringId] = reviewsForBusiness.length;
            }
          });
        }
        
        setSearchOfferingReviewCounts(offeringReviewCounts);
        
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
            isPlatformBusiness: true // All results are platform offerings
          };
        });
        
        // Combine platform offerings and AI businesses
        const combinedResults = [...enrichedResults, ...aiBusinesses];
        
        console.log(`🎯 Raw combined results: ${enrichedResults.length} platform offerings + ${aiBusinesses.length} AI businesses = ${combinedResults.length} total`);
        
        // Prepare results for sorting
        const resultsForSorting = combinedResults.map(business => {
          // Ensure proper open/closed status
          const businessWithOpenStatus = ensureOpenStatus(business);
          
          // Add normalized relevance score
          const relevanceScore = normalizeRelevanceScore(businessWithOpenStatus);
          
          return {
            ...businessWithOpenStatus,
            relevanceScore
          };
        });
        
        // Filter to 15-mile radius if user location is available
        const filteredResults = latitude && longitude 
          ? resultsForSorting.filter(business => {
              const distance = business.distance || 999999;
              return distance <= 15; // 15-mile radius
            })
          : resultsForSorting;
        
        console.log(`📏 Results within 15-mile radius: ${filteredResults.length} businesses`);
        
        // Apply the combined sorting algorithm
        const sortedResults = sortSearchResults(filteredResults);
        
        // Limit to top 10 results
        const finalResults = sortedResults.slice(0, 10);
        
        console.log(`🎯 Final sorted results (top 10):`);
        finalResults.forEach((business, index) => {
          console.log(`  ${index + 1}. ${business.isOpen ? '🟢' : '🔴'} ${business.isPlatformBusiness ? '🏢' : '🤖'} "${business.title || business.name}" - Relevance: ${(business.relevanceScore * 100).toFixed(1)}% - Distance: ${business.distance?.toFixed(1) || '?'}mi`);
        });
        
        setSearchResults(finalResults);
      } else {
        console.error('❌ Keyword search failed:', searchResponse.error);
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

  const handleRecommendBusiness = async (business: any, offeringId?: string) => {
    if (!currentUser) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      let success = false;
      
      if (offeringId && business.isPlatformBusiness) {
        // Save platform offering to favorites
        success = await BusinessService.saveFavoritedOffering(offeringId, currentUser.id);
      } else if (business.isAIGenerated) {
        // Save AI business to favorites
        const { error } = await supabase
          .from('business_recommendations')
          .insert({
            name: business.name,
            address: business.address || business.location || 'Address not available',
            location: business.location || business.address || 'Location not available',
            category: business.category || 'AI Generated',
            description: `AI-generated business. ${business.description || business.short_description || ''}`,
            image_url: business.image || '/verified and reviewed logo-coral copy copy.png',
            recommended_by: currentUser.id,
            status: 'pending',
            created_at: new Date().toISOString()
          });
        
        success = !error;
      }
      
      if (success) {
        const itemName = business.title || business.name;
        alert(`${itemName} has been saved to your favorites!`);
      } else {
        alert('Failed to save to favorites. Please try again.');
      }
    } catch (error) {
      console.error('Error saving to favorites:', error);
      alert('Failed to save to favorites. Please try again.');
    }
  };

  const handleTakeMeThere = (business: any) => {
    // AI businesses go to Google Business Profile, others go to Google Maps directions
    if (business.isAIGenerated && business.placeId) {
      // For AI-generated businesses, use Google Search to avoid native app interception
      const searchQuery = encodeURIComponent(`${business.name} ${business.address || business.location || ''}`);
      const profileUrl = `https://www.google.com/search?q=${searchQuery}+place_id:${business.placeId}`;
      window.open(profileUrl, '_blank');
      return;
    }
    
    // For platform businesses, go directly to Google Maps for directions
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

  const handleOpenOfferingReviews = (business: any) => {
    // Only open for platform businesses with offering IDs
    if (business.isPlatformBusiness && (business.offeringId || business.id)) {
      setSelectedOfferingForReviews({
        id: business.offeringId || business.id,
        title: business.title || business.name,
        businessName: business.business_name || business.name
      });
      setIsOfferingReviewsModalOpen(true);
    }
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
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-white/30 border-t-white mx-auto mb-8"></div>
                <h3 className="font-cinzel text-3xl font-bold text-white mb-4">
                  One Moment
                </h3>
                <p className="font-lora text-xl text-white/80 animate-pulse">
                  Searching for exact matches
                </p>
                <div className="mt-8 flex items-center justify-center space-x-3">
                  <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-3 h-3 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4 text-white">
              <div className="text-center">
                <Search className="h-16 w-16 text-white/60 mx-auto mb-4" />
                <h3 className="font-cinzel text-xl font-semibold text-white mb-2">
                  No Offerings Found
                </h3>
                <p className="font-lora text-white/80 mb-4">
                  Try a different search or check your spelling.
                </p>
                <button
                  onClick={handleBackToSearch}
                  className="font-poppins bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors duration-200 border border-white/30"
                >
                  New Search
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="px-4 py-4 space-y-4">
                {searchResults.map((business, index) => (
                  <div key={business.id || index} className="w-full max-w-sm mx-auto">
                    <OfferingCard
                      business={business}
                      onRecommend={handleRecommendBusiness}
                      onTakeMeThere={handleTakeMeThere}
                      onOpenOfferingReviews={handleOpenOfferingReviews}
                      offeringReviewCounts={searchOfferingReviewCounts}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Offering Reviews Modal */}
        )}
      </div>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-white pt-4">
        {/* Desktop Search Bar - Always Visible */}
        <div className="hidden lg:block max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-neutral-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="What are you hungry for? Try 'vegan pancakes', 'stew chicken', 'tacos'..."
                  className="w-full pl-12 pr-4 py-4 border border-neutral-200 rounded-xl font-lora text-lg text-neutral-900 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <button
                onClick={handleVoiceSearch}
                disabled={isListening}
                className="p-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition-colors duration-200 disabled:opacity-50"
                title="Voice search"
              >
                <Mic className={`h-6 w-6 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
              </button>
              
              <button
                onClick={() => handleSearch(searchQuery)}
                disabled={!searchQuery.trim() || isSearching}
                className="bg-gradient-to-r from-primary-500 to-accent-500 text-white py-4 px-8 rounded-xl font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Search className="h-6 w-6 mr-2" />
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            
            {currentUser && (
              <div className="flex items-center justify-center mt-4">
                <div className="bg-primary-50 rounded-lg px-4 py-2 flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-primary-500" />
                  <span className="font-poppins text-primary-700">
                    You have {userCredits} credits • 2 credits per search
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

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
        <div className="relative z-10 flex flex-col items-center justify-center py-4 px-4 sm:px-6 lg:px-8 lg:hidden">
          {!isAppModeActive && (
            <div className="relative mb-6">
              <h1 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 text-center">
              </h1>
              <p className="font-lora text-lg text-neutral-600 text-center mt-2">
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Floating Search Button */}
      {!isAppModeActive && (
        <button
          onClick={() => setShowFloatingSearchInput(true)}
          className="lg:hidden fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center group"
          title="Search for experiences"
        >
          <Search className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
        </button>
      )}

      {/* Floating Search Input */}
      {showFloatingSearchInput && !isAppModeActive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-cinzel text-xl font-bold text-neutral-900">
                What are you Hungry for?
              </h3>
              <button
                onClick={() => setShowFloatingSearchInput(false)}
                className="text-neutral-500 hover:text-neutral-700 transition-colors duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="vegan pancakes, stew chicken, tacos..."
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora text-neutral-900 placeholder-neutral-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => handleSearch(searchQuery)}
                  disabled={!searchQuery.trim() || isSearching}
                  className="flex-1 bg-gradient-to-r from-primary-500 to-accent-500 text-white py-3 px-4 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Search className="h-5 w-5 mr-2" />
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
                
                <button
                  onClick={handleVoiceSearch}
                  disabled={isListening}
                  className="p-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg transition-colors duration-200 disabled:opacity-50"
                  title="Voice search"
                >
                  <Mic className={`h-5 w-5 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
                </button>
              </div>
              
              {currentUser && (
                <div className="bg-primary-50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center">
                    <Zap className="h-4 w-4 mr-2 text-primary-500" />
                    <span className="font-poppins text-sm text-primary-700">
                      You have {userCredits} credits • 2 credits per search
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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