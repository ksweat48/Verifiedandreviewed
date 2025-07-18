import React, { useState, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import { useSwipeable } from 'react-swipeable';
import ReviewModal from './ReviewModal';
import ReviewerProfile from './ReviewerProfile';
import ImageGalleryPopup from './ImageGalleryPopup';
import SignupPrompt from './SignupPrompt';
import { useAnalytics } from '../hooks/useAnalytics'; 
import { UserService } from '../services/userService';
import { CreditService } from '../services/creditService';
import { BusinessService } from '../services/businessService';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [isSticky, setIsSticky] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [initialResultsLoaded, setInitialResultsLoaded] = useState(false);
  const [reviewerProfileOpen, setReviewerProfileOpen] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const searchRef = useRef(null);
  const searchBarRef = useRef(null);
  const { trackEvent } = useAnalytics();
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Listen for popstate events to handle back button in app mode
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Check if we're exiting app mode
      if (event.state && event.state.appMode === false) {
        setIsAppModeActive(false);
        setShowResults(false);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setIsAppModeActive]);

  // Refresh user credits when auth state changes
  useEffect(() => {
    const refreshUserCredits = async () => {
      if (isAuthenticated) {
        try {
          const user = await UserService.getCurrentUser();
          if (user) {
            setUserCredits(user.credits || 0);
            setCurrentUser(user);
          }
        } catch (error) {
          console.error('Error refreshing user credits:', error);
        }
      }
    };
    
    refreshUserCredits();
    
    const handleAuthStateChange = () => {
      refreshUserCredits();
    };
    
    window.addEventListener('auth-state-changed', handleAuthStateChange);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, [isAuthenticated]);

  const samplePrompts = [
    "peaceful brunch spot",
    "vibe-y wine bar",
    "cozy coffee for work",
    "romantic dinner place",
    "energetic workout studio"
  ];

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = UserService.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        const user = await UserService.getCurrentUser();
        if (user) {
          setUserCredits(user.credits || 0);
          setCurrentUser(user); // Add this line to set currentUser state
        }
      }
    };
    
    checkAuth();
  }, []);

  const getSentimentRating = (score) => {
    if (score >= 80) return { text: 'Great', color: 'bg-green-500' };
    if (score >= 70 && score < 80) return { text: 'Good', color: 'bg-blue-500' };
    if (score >= 65 && score < 70) return { text: 'Fair', color: 'bg-yellow-500' };
    return { text: 'Improve', color: 'bg-red-500' };
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    // If user is not authenticated or not current user, show signup prompt instead of searching
    if (!isAuthenticated || !currentUser) {
      setShowSignupPrompt(true);
      // Do not proceed with search or show loading state
      return;
    }
    
    setIsSearching(true);
    setIsSticky(true);
    
    // Enter app mode
    setIsAppModeActive(true);
    
    // Add app mode state to history
    window.history.pushState({ appMode: true }, '', window.location.pathname + '#app-mode');
    
    try {
      setShowResults(true);
      setInitialResultsLoaded(true);
      
      // First, try to get businesses from Supabase
      let transformedBusinesses = [];
      let platformBusinesses = [];
      let aiBusinesses = [];
      let needsAI = true;

      try {
        // Fetch real businesses from Supabase
        const realBusinesses = await BusinessService.getBusinesses({
          search: searchQuery,
          verified_only: false // Include both verified and unverified
        });
        
        // Transform the business data to match the expected format
        transformedBusinesses = realBusinesses.map(business => ({
          id: business.id,
          name: business.name,
          rating: {
            thumbsUp: business.thumbs_up || 0,
            thumbsDown: business.thumbs_down || 0,
            sentimentScore: business.sentiment_score || 0
          },
          image: business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
          isOpen: true, // Default to open since we don't have real-time status
          hours: business.hours || 'Hours unavailable',
          address: business.address || '',
          reviews: [], // We'll need to fetch reviews separately
          isPlatformBusiness: business.is_verified || false,
          tags: business.tags || []
        }));
        
        platformBusinesses = transformedBusinesses.filter(b => b.isPlatformBusiness);
        aiBusinesses = transformedBusinesses.filter(b => !b.isPlatformBusiness);
        
        // Use AI if we have fewer than 6 total results (platform + unverified)
        needsAI = transformedBusinesses.length < 6;
      } catch (error) {
        console.error('Error fetching businesses from Supabase:', error);
        needsAI = true;
      }

      setUsedAI(needsAI);

      let canProceed = true;
      const creditsRequired = needsAI ? 10 : 1;
      
      if (currentUser && currentUser.id) {
        // Check credit balance for all users
        if (userCredits < creditsRequired) {
          setShowCreditWarning(true);
          canProceed = false;
        } else {
          // Deduct credits
          const success = await CreditService.deductSearchCredits(currentUser.id, needsAI); // Fix: use currentUser.id
          if (success) {
            // Update local credit count
            setUserCredits(prev => prev - creditsRequired);
          } else {
            setShowCreditWarning(true);
            canProceed = false;
          }
        }
      }
      
      if (canProceed) {
        if (needsAI) {
          // Call OpenAI API through our serverless function
          setIsSearching(true);
          
          try {
            // Prepare the AI prompt with context about existing results
            const aiPrompt = transformedBusinesses.length > 0 
              ? `Find businesses similar to "${searchQuery}". I already have ${transformedBusinesses.length} results, so provide different but related businesses that match this search intent.`
              : `Find businesses that match: "${searchQuery}". Focus on the mood, vibe, or specific needs expressed in this search.`;

            const response = await fetch('/.netlify/functions/ai-business-search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({ 
                prompt: aiPrompt,
                searchQuery: searchQuery,
                existingResultsCount: transformedBusinesses.length
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('AI search API error:', response.status, errorText);
              throw new Error(`AI search failed: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('🎯 AI search response:', data);
            
            if (data.success && data.results) {
              // Combine platform businesses with AI-generated businesses
              const aiGeneratedBusinesses = data.results.map(business => ({
                ...business,
                isPlatformBusiness: false,
                // Ensure all required fields are present
                id: business.id || `ai-${Date.now()}-${Math.random()}`,
                rating: business.rating || { thumbsUp: 0, thumbsDown: 0, sentimentScore: 75 },
                image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                isOpen: business.isOpen !== undefined ? business.isOpen : true,
                hours: business.hours || 'Hours unavailable',
                address: business.address || 'Address not available',
                reviews: business.reviews || [],
                tags: business.tags || []
              }));
              
              console.log('🤖 Using AI to enhance search results for:', searchQuery);
              const combinedResults = [...platformBusinesses, ...aiGeneratedBusinesses];
              setResults(combinedResults);
              console.log('✅ Combined results:', combinedResults.length, 'businesses');
              
              trackEvent('search_performed', { 
                query: searchQuery, 
                used_ai: true, 
                credits_deducted: creditsRequired,
                results_count: combinedResults.length,
                platform_results: platformBusinesses.length,
                ai_results: aiGeneratedBusinesses.length
              });
            } else {
              console.error('AI search failed:', data);
              throw new Error(data.error || data.message || 'Failed to get AI business suggestions');
            }
          } catch (aiError) {
            console.error('AI search error:', aiError);
            console.log('🔄 Falling back to platform-only results');
            
            // Show error message to user
            setShowCreditWarning(true);
            
            // Fallback to platform businesses if AI search fails
            setResults(transformedBusinesses);
            trackEvent('search_performed', { 
              query: searchQuery, 
              used_ai: false, 
              credits_deducted: creditsRequired,
              results_count: transformedBusinesses.length,
              error: aiError.message,
              fallback: true
            });
          }
        } else {
          // Just use the platform businesses
          setResults(transformedBusinesses);
          console.log('📊 Using platform-only results for:', searchQuery);
          trackEvent('search_performed', { 
            query: searchQuery, 
            used_ai: false, 
            credits_deducted: creditsRequired,
            results_count: transformedBusinesses.length
          });
        }
      } else {
        setShowCreditWarning(true);
        setResults([]);
        trackEvent('search_performed', { 
          query: searchQuery, 
          used_ai: false, 
          credits_deducted: creditsRequired,
          error: aiError.message
        });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Exit app mode
  const exitAppMode = () => {
    setIsAppModeActive(false);
    setShowResults(false);
    
    // Go back in history to remove the app-mode state
    window.history.back();
  };

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recognition is not supported in your browser.');
      return;
    }

    setIsListening(true);

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      handleSearch(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };
  const nextCard = () => {
    setCurrentCardIndex((prev) => (prev + 1) % slots.length);
  };
  
  const prevCard = () => {
    setCurrentCardIndex((prev) => (prev - 1 + slots.length) % slots.length);
  };

  const handleCardClick = (business) => {
    setSelectedBusiness(business);
    setCurrentReviewIndex(0);
    setModalOpen(true);
  };
  
  // Swipe handlers for mobile
  const swipeHandlers = useSwipeable({
    onSwipedLeft: nextCard,
    onSwipedRight: prevCard,
    trackMouse: true,
    preventDefaultTouchmoveEvent: true,
    trackTouch: true
  });

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedBusiness(null);
    setCurrentReviewIndex(0);
  };

  const nextReview = () => {
    if (selectedBusiness && currentReviewIndex < selectedBusiness.reviews.length - 1) {
      setCurrentReviewIndex(prev => prev + 1);
    }
  };

  const prevReview = () => {
    if (currentReviewIndex > 0) {
      setCurrentReviewIndex(prev => prev - 1);
    }
  };

  const openReviewerProfile = (reviewer) => {
    setSelectedReviewer(reviewer);
    setReviewerProfileOpen(true);
  };
  
  const openImageGallery = (business, reviewIndex, imageIndex = 0) => {
    if (!business.reviews || 
        !business.reviews[reviewIndex] || 
        !business.reviews[reviewIndex].images || 
        business.reviews[reviewIndex].images.length === 0) {
      return;
    }
    
    setGalleryImages(business.reviews[reviewIndex].images || []);
    setGalleryInitialIndex(imageIndex);
    setGalleryOpen(true);
  };

  const handleRecommend = async (business) => {
    // Log to Supabase for admin approval
    console.log('Recommending business:', business.name);
    setModalOpen(false);
    alert(`Thanks! We'll review ${business.name} for addition to our platform.`);
  };

  const handleTakeMeThere = (business) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
    window.open(mapsUrl, '_blank');
    if (modalOpen) setModalOpen(false);
  };

  const handleSignup = () => {
    console.log('Opening signup modal from AISearchHero');
    setShowSignupPrompt(false); // Close the signup prompt first
    trackEvent('signup_prompt_clicked', { source: 'search_hero' });
    
    // Force signup mode
    const event = new CustomEvent('open-auth-modal', { 
      detail: { 
        mode: 'signup',
        forceMode: true 
      } 
    });
    document.dispatchEvent(event);
  };
  
  const handleLogin = () => {
    console.log('Opening login modal');
    // Trigger the auth modal to open in login mode
    trackEvent('login_prompt_clicked', { source: 'search_hero' });
    setShowSignupPrompt(false); // Close the signup prompt first
    const event = new CustomEvent('open-auth-modal', { 
      detail: { 
        mode: 'login',
        forceMode: true 
      } 
    });
    document.dispatchEvent(event);
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && searchInputRef.current === document.activeElement) {
        handleSearch(searchQuery);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [searchQuery]);

  useEffect(() => {
    // Results will be populated when search is performed
  }, [showResults, results.length]);

  const scrollToCard = (direction) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = 350; // Adjust based on card width + gap
      
      if (direction === 'left') {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  const platformBusinesses = results.filter(b => b.isPlatformBusiness);
  const aiBusinesses = results.filter(b => !b.isPlatformBusiness);
  
  let slots = [];
  
  for (let i = 0; i < Math.min(platformBusinesses.length, 3); i++) {
    slots.push({
      type: 'platform',
      businesses: [platformBusinesses[i]]
    });
  }
  
  const aiSlots = [];
  
  for (let i = 0; i < aiBusinesses.length; i += 2) {
    const slotBusinesses = [aiBusinesses[i]];
    
    if (i + 1 < aiBusinesses.length) {
      slotBusinesses.push(aiBusinesses[i + 1]);
    }
    
    aiSlots.push({
      type: 'ai',
      businesses: slotBusinesses
    });
  }
  
  for (let i = 0; i < aiSlots.length; i++) {
    if (slots.length < 6) {
      slots.push(aiSlots[i]);
    }
  }

  return (
    <div className={`relative bg-gradient-to-br from-purple-50 via-white to-blue-50 pb-10 pt-4 ${isAppModeActive ? 'h-screen overflow-hidden' : ''}`}>
      {!showResults && (
        <div className="flex flex-col justify-center items-center px-4 py-6 min-h-[30vh]">
          <div className="text-center">
            <h1 className="font-cinzel text-3xl md:text-6xl lg:text-7xl font-bold text-neutral-900 mb-6 mx-auto">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-accent-500">Discover what matters</span>
            </h1>
            <p className="font-lora text-lg md:text-2xl text-neutral-600 mb-4 max-w-2xl mx-auto">
              Find places with a vibe, a feeling, or just a word.
            </p>
          </div>
        </div>
      )}

      <div className={`w-full bg-white border-b border-neutral-100 shadow-sm ${isAppModeActive ? 'search-bar-fixed' : 'sticky top-16 z-40'} ${showResults ? 'mb-1' : ''} -mt-3`}>
        <div ref={searchBarRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div 
            ref={searchRef}
            className="relative w-full"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur opacity-20"></div>
            <div className="relative bg-white rounded-xl shadow-md border border-neutral-200 p-2 w-full">
              <form onSubmit={(e) => {e.preventDefault(); handleSearch(searchQuery);}} className="flex items-center w-full">
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
                    <Icons.Zap className="h-3 w-3 text-primary-500 mr-1" />
                    <span className="font-poppins text-xs font-semibold text-primary-700">
                      {userCredits} credits
                    </span>
                  </div>
                )}
                
                {/* Free trial credits for non-logged-in users */}
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0"
                  aria-label="Search"
                >
                  {isSearching ? (
                    <span className="flex items-center">
                      <Icons.Loader2 className="h-5 w-5 animate-spin sm:mr-2" />
                      <span className="hidden sm:inline">Thinking...</span>
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
      
      {/* Exit App Mode Button */}
      
      {/* Unified Bottom Navigation Bar */}
      {isAppModeActive && (
        <div className="fixed bottom-4 left-0 right-0 z-40 flex items-center justify-between px-4">
          {/* Pagination */}
          <div className="bg-white bg-opacity-80 px-3 py-1 rounded-full shadow-sm">
            <span className="font-poppins text-xs text-neutral-700">
              {`${currentCardIndex + 1} / ${slots.length}`}
            </span>
          </div>
          
          {/* Navigation Arrows */}
          <div className="flex items-center space-x-3">
            <button
              onClick={prevCard}
              className="w-10 h-10 bg-white bg-opacity-80 rounded-full shadow-lg flex items-center justify-center border border-neutral-100"
              aria-label="Previous card"
            >
              <Icons.ChevronLeft className="h-4 w-4 text-neutral-600" />
            </button>
            <button
              onClick={nextCard}
              className="w-10 h-10 bg-white bg-opacity-80 rounded-full shadow-lg flex items-center justify-center border border-neutral-100"
              aria-label="Next card"
            >
              <Icons.ChevronRight className="h-4 w-4 text-neutral-600" />
            </button>
          </div>
        </div>
      )}
      
      {/* Centered Exit Button */}
      {isAppModeActive && (
        <button 
          onClick={exitAppMode}
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-10 h-10 bg-white bg-opacity-80 rounded-full shadow-lg flex items-center justify-center border border-neutral-100"
          aria-label="Exit search mode"
        >
          <Icons.LogOut className="h-4 w-4 text-neutral-600" />
        </button>
      )}
      
      {/* Sample Prompts */}
      {!showResults && (
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {samplePrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setSearchQuery(prompt);
                handleSearch();
              }}
              className="bg-white border border-neutral-200 text-neutral-600 px-3 py-1 rounded-full text-sm font-lora hover:bg-neutral-50 hover:border-primary-300 transition-colors duration-200"
            >
              {prompt}
            </button>
          ))}
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
        className={`transition-all duration-500 overflow-hidden z-10 w-full ${
          showResults && results.length > 0 ? 'opacity-100 mt-0' : 'max-h-0 opacity-0'
        }`}
        style={{
          height: isAppModeActive ? 'calc(100vh - 60px)' : 'auto',
          maxHeight: isAppModeActive ? 'none' : showResults ? '800px' : '0'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 relative z-20">
          {results.length > 0 && showResults && (
            <div className="relative">
              <div
                ref={scrollContainerRef}
                className="hidden md:grid md:grid-flow-col md:auto-cols-max overflow-x-auto scrollbar-hide gap-6 pb-8 snap-x h-full"
                style={{ height: isAppModeActive ? 'calc(100vh - 128px)' : 'auto' }}
              >
                {slots.map((slot, slotIndex) => (
                  <div key={`slot-${slotIndex}`} className="w-80 flex-shrink-0 snap-start h-full">
                    {slot.type === 'platform' && slot.businesses.length > 0 && (
                      <PlatformBusinessCard
                        business={slot.businesses[0]}
                        onRecommend={handleRecommend}
                        onOpenReviewModal={handleCardClick}
                        onTakeMeThere={handleTakeMeThere}
                      />
                    )}
                    
                    {slot.type === 'ai' && slot.businesses.length > 0 && (
                      <div className="h-full flex flex-col gap-2">
                        {slot.businesses.slice(0, 2).map((business, businessIndex) => (
                          <div key={`ai-card-${business.id}`} className="flex-1 min-h-0">
                            <AIBusinessCard 
                              business={business}
                              onOpenReviewModal={handleCardClick}
                              onRecommend={handleRecommend}
                              onTakeMeThere={handleTakeMeThere}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {slot.type === 'empty' && (
                      <div className="h-full bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-center">
                        <p className="font-lora text-neutral-400">No more results</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="md:hidden relative animate-in fade-in duration-500 overflow-hidden h-full" {...swipeHandlers}>
                <div className="relative overflow-hidden" style={{ height: isAppModeActive ? 'calc(100vh - 128px)' : '480px' }}>
                  {slots[currentCardIndex] && slots[currentCardIndex].type === 'platform' && slots[currentCardIndex].businesses && slots[currentCardIndex].businesses.length > 0 && (
                    <PlatformBusinessCard
                      business={slots[currentCardIndex].businesses[0] || {
                        id: '',
                        name: '',
                        rating: { thumbsUp: 0, sentimentScore: 0 },
                        image: '',
                        isOpen: false,
                        hours: '',
                        address: '',
                        reviews: [],
                        isPlatformBusiness: true,
                        tags: []
                      }}
                      onOpenReviewModal={handleCardClick}
                      onRecommend={handleRecommend}
                      onTakeMeThere={handleTakeMeThere}
                    />
                  )}
                  
                  {slots[currentCardIndex] && slots[currentCardIndex].type === 'ai' && slots[currentCardIndex].businesses && slots[currentCardIndex].businesses.length > 0 && (
                    <div className="h-full flex flex-col gap-3">
                      {slots[currentCardIndex].businesses.slice(0, 2).map((business) => (
                        <div key={`mobile-ai-${business.id}`} className="flex-1 min-h-0 max-h-[235px]">
                          <AIBusinessCard 
                            business={business}
                            onRecommend={handleRecommend}
                            onTakeMeThere={handleTakeMeThere}
                            onOpenReviewModal={handleCardClick}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {slots[currentCardIndex] && slots[currentCardIndex].type === 'empty' && (
                    <div className="h-full bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-center">
                      <p className="font-lora text-neutral-400">No more results</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {results.length === 0 && !isSearching && showResults && (
            <div className="text-center py-8 px-4">
              <Icons.Search className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
              <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                No results found
              </h3>
              <p className="font-lora text-neutral-600 mb-4">
                Try a different search term or browse our categories below
              </p>
              <button
                onClick={() => setShowResults(false)}
                className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
              >
                Back to Search
              </button>
            </div>
          )}

          {isSearching && (
            <div className="text-center py-8 px-4">
              <Icons.RefreshCw className="h-10 w-10 text-primary-500 mx-auto mb-4 animate-spin" />
              <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                {usedAI ? 'AI is thinking...' : 'Searching...'}
              </h3>
              <p className="font-lora text-neutral-600">
                {usedAI 
                  ? `Using AI to find businesses that match "${searchQuery}"`
                  : `Searching our database for "${searchQuery}"`
                }
              </p>
              <div className="w-full max-w-md mx-auto mt-6">
                <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500 animate-pulse rounded-full" style={{ width: '70%' }}></div>
                </div>
                {usedAI && (
                  <p className="font-lora text-xs text-neutral-500 mt-2">
                    This may take a few moments while AI analyzes your request...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    
      <ReviewModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        business={selectedBusiness}
        currentReviewIndex={currentReviewIndex}
        onPrevReview={prevReview}
        onNextReview={nextReview}
        onOpenReviewerProfile={(index) => {
          if (selectedBusiness) {
            const review = selectedBusiness.reviews[index];
            if (review) {
              const reviewer = {
                name: review.author,
                image: review.authorImage || "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100",
                level: Math.floor(Math.random() * 5) + 1,
                reviewCount: Math.floor(Math.random() * 50) + 1,
                joinDate: '2023-' + (Math.floor(Math.random() * 12) + 1) + '-' + (Math.floor(Math.random() * 28) + 1),
                bio: `Food enthusiast and travel blogger. I love discovering hidden gems and sharing honest reviews about my experiences.`,
                reviews: [
                  {
                    businessName: selectedBusiness.name,
                    location: selectedBusiness.address,
                    date: new Date().toLocaleDateString(),
                    rating: review.thumbsUp ? 'thumbsUp' : 'thumbsDown',
                    text: review.text
                  },
                  {
                    businessName: 'Coastal Breeze Cafe',
                    location: 'Santa Monica, CA',
                    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                    rating: 'thumbsUp',
                    text: 'Fantastic ocean views and the freshest seafood. Highly recommended for sunset dining!'
                  }
                ]
              };
              setSelectedReviewer(reviewer);
              setReviewerProfileOpen(true);
            }
          }
        }}
      />

      <ReviewerProfile
        isOpen={reviewerProfileOpen}
        onClose={() => setReviewerProfileOpen(false)}
        reviewer={selectedReviewer}
      />
      
      {/* Image Gallery Popup */}
      <ImageGalleryPopup
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        images={galleryImages}
        initialIndex={galleryInitialIndex}
      />
    </div>
  );
};

export default AISearchHero;