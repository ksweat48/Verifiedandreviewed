import React, { useState, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';
import PlatformBusinessCard from './PlatformBusinessCard';
import AIBusinessCard from './AIBusinessCard';
import SignupPrompt from './SignupPrompt';
import { useAnalytics } from '../hooks/useAnalytics'; 
import { UserService } from '../services/userService';
import { CreditService } from '../services/creditService';
import { BusinessService } from '../services/businessService';
import { useGeolocation } from '../hooks/useGeolocation';
import { SemanticSearchService } from '../services/semanticSearchService';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [initialResultsLoaded, setInitialResultsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [showCreditWarning, setShowCreditWarning] = useState(false);
  const searchRef = useRef(null);
  const searchBarRef = useRef(null);
  const [useSemanticSearch, setUseSemanticSearch] = useState(true);
  const [semanticSearchAvailable, setSemanticSearchAvailable] = useState(false);
  const { trackEvent } = useAnalytics();
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Call the useGeolocation hook
  const { latitude, longitude, error: geoError, loading: geoLoading } = useGeolocation();
  
  // Check if semantic search is available
  useEffect(() => {
    const checkSemanticSearch = async () => {
      const available = await SemanticSearchService.isSemanticSearchAvailable();
      setSemanticSearchAvailable(available);
      console.log('🧠 Semantic search available:', available);
    };
    
    checkSemanticSearch();
  }, []);
  
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
    
    // Check if geolocation is still loading or has an error
    if (geoLoading) {
      // Optionally show a message to the user that location is still being fetched
      console.warn("Geolocation is still loading. Please wait.");
      return;
    }
    if (geoError) {
      // Optionally show a message to the user about the geolocation error
      console.error("Geolocation error:", geoError);
      // Decide whether to proceed with a default location or stop the search
      // For now, we'll proceed with the default location in the Netlify function
    }
    
    setIsSearching(true);
    
    // Enter app mode
    setIsAppModeActive(true);
    
    // Add app mode state to history
    window.history.pushState({ appMode: true }, '', window.location.pathname + '#app-mode');
    
    try {
      setShowResults(true);
      setInitialResultsLoaded(true);
      
      // Determine search strategy: semantic vs traditional
      let searchResults = [];
      let usedSemanticSearch = false;
      
      // Try semantic search first if available and user prefers it
      if (semanticSearchAvailable && useSemanticSearch) {
        console.log('🧠 Attempting semantic search...');
        console.log('🔍 Search query:', searchQuery);
        
        const semanticResult = await SemanticSearchService.searchByVibe(searchQuery, {
          latitude,
          longitude,
          matchThreshold: 0.5, // Lower threshold for more results
          matchCount: 8
        });
        
        if (semanticResult.success && semanticResult.results.length > 0) {
          searchResults = semanticResult.results;
          usedSemanticSearch = true;
          console.log('✅ Semantic search successful:', searchResults.length, 'results');
          console.log('🏢 Platform businesses found:', searchResults.filter(r => r.isPlatformBusiness).length);
        } else {
          console.log('⚠️ Semantic search failed or no results, falling back to traditional search');
          console.log('Semantic search error:', semanticResult.error);
        }
      }
      
      // Fallback to traditional search if semantic search failed or unavailable
      let transformedBusinesses = [];
      let platformBusinesses = [];
      let aiBusinesses = [];
      let needsAI = !usedSemanticSearch; // Only use AI if semantic search wasn't successful

      if (usedSemanticSearch) {
        // Use semantic search results
        transformedBusinesses = searchResults;
        platformBusinesses = searchResults;
        needsAI = searchResults.length < 6;
      } else {
        // Traditional keyword search fallback
        try {
          // Fetch real businesses from Supabase
          const realBusinesses = await BusinessService.getBusinesses({
            search: searchQuery,
            userLatitude: latitude || undefined,
            userLongitude: longitude || undefined
          });
          
          // Debug logging to see what businesses are returned from Supabase
          console.log('🔍 Supabase realBusinesses:', realBusinesses);
          console.log('🔍 Search query:', searchQuery);
          console.log('🔍 Number of businesses found:', realBusinesses.length);
          
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
            isPlatformBusiness: true, // All businesses from Supabase are platform businesses
            tags: business.tags || [],
            distance: business.distance || Math.round((Math.random() * 4 + 1) * 10) / 10,
            duration: business.duration || Math.floor(Math.random() * 10 + 5)
          }));
          
          // All businesses from Supabase are platform businesses
          platformBusinesses = transformedBusinesses;
          aiBusinesses = []; // No AI businesses from Supabase
          
          // Use AI if we have fewer than 6 total results (platform + unverified)
          needsAI = transformedBusinesses.length < 6;
        } catch (error) {
          console.error('Error fetching businesses from Supabase:', error);
          needsAI = true;
        }
      }

      setUsedAI(needsAI && !usedSemanticSearch);

      let canProceed = true;
      const creditsRequired = usedSemanticSearch ? 5 : (needsAI ? 10 : 1); // Semantic search costs 5 credits
      
      if (currentUser && currentUser.id) {
        // Check credit balance for all users
        if (userCredits < creditsRequired) {
          setShowCreditWarning(true);
          canProceed = false;
        } else {
          // Deduct credits
          const success = await CreditService.deductSearchCredits(currentUser.id, usedSemanticSearch ? 'semantic' : (needsAI ? 'ai' : 'platform')); // Fix: use currentUser.id
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
            // Calculate how many AI businesses we need (max 4 total cards)
            const numAINeeded = Math.max(0, 5 - transformedBusinesses.length);
            
            if (numAINeeded === 0) {
              // We already have 5 or more platform businesses, no AI needed
              setResults(transformedBusinesses.slice(0, 5));
              console.log('📊 Using platform-only results (5+ available):', searchQuery);
              trackEvent('search_performed', { 
                query: searchQuery, 
                used_ai: false, 
                credits_deducted: creditsRequired,
                results_count: Math.min(transformedBusinesses.length, 5),
                platform_results: Math.min(transformedBusinesses.length, 5),
                ai_results: 0
              });
              return;
            }
            
            // Prepare the AI prompt with context about existing results
            const aiPrompt = transformedBusinesses.length > 0 
              ? `Find businesses similar to "${searchQuery}". I already have ${transformedBusinesses.length} results, so provide ${numAINeeded} different but related businesses that match this search intent.`
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
                existingResultsCount: transformedBusinesses.length,
                numToGenerate: numAINeeded,
                latitude: latitude,   // Pass user's latitude from hook
                longitude: longitude  // Pass user's longitude from hook
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
                // Ensure all required fields are present
                id: business.id || `ai-${Date.now()}-${Math.random()}`,
                address: business.address || 'Address not available',
                rating: business.rating || { thumbsUp: 0, thumbsDown: 0, sentimentScore: 75 },
                image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                isOpen: business.isOpen !== undefined ? business.isOpen : true,
                hours: business.hours || 'Hours unavailable',
                address: business.address || 'Address not available',
                distance: business.distance || Math.round((Math.random() * 4 + 1) * 10) / 10, // Ensure distance is present
                duration: business.duration || Math.floor(Math.random() * 10 + 5), // Ensure duration is present
                reviews: business.reviews || [],
                isPlatformBusiness: false
              }));
              
              console.log(`🤖 Using AI to enhance search results for: ${searchQuery} (${numAINeeded} AI businesses)`);
              const combinedResults = [...platformBusinesses, ...aiGeneratedBusinesses];
              
              // Sort and limit results: Platform businesses first, then open businesses, then closest, limit to 5 total
              const sortedResults = combinedResults.sort((a, b) => {
                // First priority: Platform businesses
                if (a.isPlatformBusiness && !b.isPlatformBusiness) return -1;
                if (!a.isPlatformBusiness && b.isPlatformBusiness) return 1;
                
                // First priority: Open businesses
                if (a.isOpen && !b.isOpen) return -1;
                if (!a.isOpen && b.isOpen) return 1;
                
                // Second priority: Closest businesses (by distance)
                if (a.distance && b.distance) {
                  if (a.distance < b.distance) return -1;
                  if (a.distance > b.distance) return 1;
                }
                
                return 0;
              });
              
              // Remove duplicates by ID and limit to 5
              const uniqueResults = sortedResults.filter((business, index, self) => 
                index === self.findIndex(b => b.id === business.id)
              ).slice(0, 5);
              
              setResults(uniqueResults);
              console.log('✅ Combined results:', combinedResults.length, 'businesses');
              
              trackEvent('search_performed', { 
                query: searchQuery, 
                used_ai: needsAI,
                used_semantic: usedSemanticSearch,
                credits_deducted: creditsRequired,
                results_count: uniqueResults.length,
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
            // Sort and limit results: Platform businesses first, then open businesses first, limit to 5 total
            const sortedResults = transformedBusinesses.sort((a, b) => {
              // First priority: Platform businesses
              if (a.isPlatformBusiness && !b.isPlatformBusiness) return -1;
              if (!a.isPlatformBusiness && b.isPlatformBusiness) return 1;
              
              // Second priority: Open businesses
              if (a.isOpen && !b.isOpen) return -1;
              if (!a.isOpen && b.isOpen) return 1;
              
              // Third priority: Closest businesses (by distance)
              if (a.distance && b.distance) {
                if (a.distance < b.distance) return -1;
                if (a.distance > b.distance) return 1;
              }
              
              return 0;
            }).slice(0, 5);
            
            // Fallback to platform businesses if AI search fails
            // Remove duplicates by ID and limit to 5
            const uniquePlatformResults = sortedResults.filter((business, index, self) => 
              index === self.findIndex(b => b.id === business.id)
            ).slice(0, 5);
            
            setResults(uniquePlatformResults);
            trackEvent('search_performed', { 
              query: searchQuery, 
              used_ai: false, 
              credits_deducted: creditsRequired,
              results_count: uniquePlatformResults.length,
              error: aiError.message,
              fallback: true
            });
          }
        } else {
          // Just use the platform businesses
          const sortedResults = transformedBusinesses.sort((a, b) => {
            // First priority: Platform businesses (all are platform businesses here)
            if (a.isPlatformBusiness && !b.isPlatformBusiness) return -1;
            if (!a.isPlatformBusiness && b.isPlatformBusiness) return 1;
            
            // Second priority: Open businesses
            if (a.isOpen && !b.isOpen) return -1;
            if (!a.isOpen && b.isOpen) return 1;
            
            // Third priority: Closest businesses (by distance)
            if (a.distance && b.distance) {
              if (a.distance < b.distance) return -1;
              if (a.distance > b.distance) return 1;
            }
            
            return 0;
          });
          
          // Remove duplicates by ID and limit to 5
          const uniquePlatformResults = sortedResults.filter((business, index, self) => 
            index === self.findIndex(b => b.id === business.id)
          ).slice(0, 5);
          
          setResults(uniquePlatformResults);
          console.log('📊 Using platform-only results for:', searchQuery);
          trackEvent('search_performed', { 
            query: searchQuery, 
            used_ai: false,
            used_semantic: usedSemanticSearch,
            credits_deducted: creditsRequired,
            results_count: uniquePlatformResults.length
          });
        }
      } else {
        setShowCreditWarning(true);
        setResults([]);
        trackEvent('search_performed', { 
          query: searchQuery, 
          used_ai: false,
          used_semantic: false,
          credits_deducted: 0,
          error: 'Insufficient credits'
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
      handleSearch();
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

  const handleRecommend = async (business) => {
    // Log to Supabase for admin approval
    console.log('Recommending business:', business.name);
    alert(`Thanks! We'll review ${business.name} for addition to our platform.`);
  };

  const handleTakeMeThere = (business) => {
    // Record the business visit for platform businesses
    if (business.isPlatformBusiness && currentUser && currentUser.id) {
      BusinessService.recordBusinessVisit(business.id, currentUser.id)
        .then(success => {
          if (success) {
            console.log('✅ Business visit recorded for:', business.name);
            // Dispatch event to update visited businesses list
            window.dispatchEvent(new CustomEvent('visited-businesses-updated'));
          }
        })
        .catch(error => {
          console.error('❌ Error recording business visit:', error);
        });
    }
    
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
    window.open(mapsUrl, '_blank');
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
        handleSearch();
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [searchQuery]);

  useEffect(() => {
    // Results will be populated when search is performed
  }, [showResults, results.length]);

  const platformBusinesses = results.filter(b => b.isPlatformBusiness);
  const aiBusinesses = results.filter(b => !b.isPlatformBusiness);
  
  return (
    <div 
      className={`relative flex flex-col h-screen ${isAppModeActive ? 'overflow-hidden' : ''}`}
    >
      {/* Blurred Background Layer */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'url("/ChatGPT Image Jul 12, 2025, 05_41_06 AM.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(2px)'
        }}
      ></div>
      
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/50"></div>
      
      {!showResults && (
        <div className="flex flex-col justify-center items-center flex-grow z-10 px-4 sm:px-6 lg:px-8">
          {/* Centered Hero Content Container */}
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Title and Subtitle */}
            <div className="mb-8">
              <h1 className="font-cinzel text-4xl md:text-7xl lg:text-8xl font-bold text-neutral-900 mb-6 mx-auto">
                <span className="text-white drop-shadow-lg">Discover what matters</span>
              </h1>
              <p className="font-lora text-xl md:text-3xl text-neutral-600 mb-4 max-w-2xl mx-auto">
                <span className="text-white drop-shadow-md">
                Find places with a vibe, a feeling, or just a word.
                </span>
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="w-full max-w-2xl mx-auto mb-6">
              <div 
                ref={searchRef}
                className="relative w-full"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur opacity-20"></div>
                <div className="relative bg-white rounded-xl shadow-md border border-neutral-200 p-2 w-full">
                  <form onSubmit={(e) => {e.preventDefault(); handleSearch();}} className="flex items-center w-full">
                    <Icons.Sparkles className="h-5 w-5 text-primary-500 ml-1 sm:ml-4 mr-1 sm:mr-3 flex-shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="peaceful brunch spot, vibe-y wine bar, cozy coffee for work..."
                      className="flex-1 py-2 sm:py-3 px-1 text-base font-lora text-neutral-700 placeholder-neutral-400 bg-transparent border-none outline-none min-w-0"
                    />
                    <button
                      onClick={startVoiceRecognition}
                      className={`p-1 rounded-full ${isListening ? 'bg-primary-100 text-primary-600 animate-pulse' : 'text-neutral-400 hover:text-primary-500 hover:bg-primary-50'} transition-colors duration-200 flex-shrink-0`}
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
                      className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0"
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