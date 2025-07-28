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
import { ReviewService } from '../services/reviewService';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { getMatchPercentage, meetsDisplayThreshold, calculateCompositeScore } from '../utils/similarityUtils';
import { formatCredits } from '../utils/formatters';
import { ActivityService } from '../services/activityService';

// Helper function to calculate distance between two coordinates in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Minimum semantic similarity threshold for displaying results
const MINIMUM_DISPLAY_SIMILARITY = 0.0; // Allow all results for composite scoring
const MAX_SEARCH_RADIUS_MILES = 10; // Maximum search radius in miles

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

  // Enrich platform businesses with reviews
  const enrichPlatformBusinessesWithReviews = async (businesses: Business[]): Promise<Business[]> => {
    console.log("📝 ENRICHING platform businesses with reviews BEFORE deduplication...");
    const enrichedBusinesses: Business[] = [];
    
    for (const business of businesses) {
      if (business.isPlatformBusiness) {
        try {
          console.log(`📝 Fetching reviews for business: ${business.name} (ID: ${business.id})`);
          const reviews = await ReviewService.getBusinessReviews(business.id);
          console.log(`📝 Found ${reviews.length} reviews for ${business.name}`);
          
          // Transform reviews to match expected format
          const formattedReviews = reviews.map(review => ({
            text: review.review_text || 'No review text available',
            author: review.profiles?.name || 'Anonymous',
            authorImage: review.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100',
            images: (review.image_urls || []).map(url => ({ url })),
            thumbsUp: review.rating >= 4
          }));
          
          console.log(`📝 Formatted ${formattedReviews.length} reviews for ${business.name}:`, formattedReviews);
          
          const enrichedBusiness = {
            ...business,
            reviews: formattedReviews
          };
          
          console.log(`📝 Business with reviews created for ${business.name}:`, {
            name: enrichedBusiness.name,
            isPlatformBusiness: enrichedBusiness.isPlatformBusiness
          });
          
          enrichedBusinesses.push(enrichedBusiness);
        } catch (error) {
          console.error(`❌ Error enriching business ${business.name} with reviews:`, error);
          enrichedBusinesses.push(business); // Include original business if enrichment fails
        }
      } else {
        enrichedBusinesses.push(business); // Non-platform businesses don't need review enrichment
      }
    }
    
    console.log("✅ Reviews fetched for platform businesses");
    console.log("✅ Platform businesses enriched with reviews BEFORE deduplication.");
    return enrichedBusinesses;
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
    
    // Declare variables that will be used across different scopes
    let semanticSearchResults: any[] = [];
    let uniqueBusinesses: any[] = [];
    let exactMatchBusiness = null;
    
    setIsSearching(true);
    
    // Enter app mode
    setIsAppModeActive(true);
    
    // Add app mode state to history
    window.history.pushState({ appMode: true }, '', window.location.pathname + '#app-mode');
    
    // Step 1: Comprehensive platform business search
    console.log('🔍 Step 1: Comprehensive platform business search');

          // Determine if it's a platform business based on the source or a flag
          const isPlatform = business.isPlatformBusiness; // Assuming this flag is reliable

          // Construct the business object to pass to the card component
          // This ensures all expected properties are present and correctly mapped
          const cardBusiness = {
            ...business, // Spread existing properties
            // Map image_url to image for platform businesses, or use existing image for AI businesses
            image: business.image_url || business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
            
            // Map individual rating fields to the nested 'rating' object expected by PlatformBusinessCard
            rating: {
              thumbsUp: business.thumbs_up !== undefined ? business.thumbs_up : (business.rating?.thumbsUp || 0),
              thumbsDown: business.thumbs_down !== undefined ? business.thumbs_down : (business.rating?.thumbsDown || 0),
              sentimentScore: business.sentiment_score !== undefined ? business.sentiment_score : (business.rating?.sentimentScore || 0),
            },
            
            // Ensure reviews is an array, even if empty
            reviews: business.reviews || [],
            
            // Ensure isPlatformBusiness is explicitly set
            isPlatformBusiness: isPlatform,
            
            // Add other properties that might be missing or named differently
            address: business.address || business.location || '', // Ensure address is always present
            location: business.location || business.address || '', // Ensure location is always present
            isOpen: business.isOpen !== undefined ? business.isOpen : true, // Default to true if not specified
          };

          return isPlatform ? (
            <PlatformBusinessCard
              key={cardBusiness.id}
              business={cardBusiness}
              onRecommend={handleRecommend}
              onTakeMeThere={handleTakeMeThere}
            />
          ) : (
            <AIBusinessCard
              key={business.id}
              business={business} // AIBusinessCard already expects 'image' and 'rating' in its format
              onRecommend={handleRecommend}
            />
          );
          exactMatchBusiness.distance = exactDistance;
          exactMatchBusiness.duration = Math.round(exactDistance * 2); // Rough estimate
          console.log(`📍 [EXACT MATCH] Distance: ${exactDistance.toFixed(1)} miles`);
        }
        
        // Mark as exact match and give highest priority
        exactMatchBusiness.isExactMatch = true;
        exactMatchBusiness.similarity = 1.0; // Perfect match
        exactMatchBusiness.compositeScore = 2.0; // Highest possible score
        exactMatchBusiness.isPlatformBusiness = true;
        exactMatchBusiness.isOpen = exactMatchBusiness.isOpen !== undefined ? exactMatchBusiness.isOpen : true;
        platformBusinesses.push(exactMatchBusiness);
      } else {
        console.log('ℹ️ No exact business name match found');
      }
    } catch (error) {
      console.warn('⚠️ Error checking for exact match:', error);
    }
    
    // 1b: Broad keyword search for platform businesses
    console.log('🔍 Step 1b: Broad keyword search for platform businesses');
    try {
      const keywordResults = await BusinessService.getBusinesses({
        search: searchQuery,
        userLatitude: latitude,
        userLongitude: longitude
      });
      
      console.log('✅ Keyword search found', keywordResults.length, 'platform businesses');
      
      // Add keyword results to platform businesses (avoid duplicates)
      keywordResults.forEach(business => {
        const existingBusiness = platformBusinesses.find(pb => pb.id === business.id);
        if (!existingBusiness) {
          business.isPlatformBusiness = true;
          platformBusinesses.push(business);
        }
      });
    } catch (error) {
      console.warn('⚠️ Keyword search failed:', error);
    }
    
    // 1c: Semantic search for platform businesses (additional layer)
    console.log('🔍 Step 1c: Semantic search for platform businesses');
    try {
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
          matchThreshold: 0.5, // Updated threshold for better recall
          matchCount: 20
        });
        
        if (semanticResult.success && semanticResult.results.length > 0) {
          console.log('✅ Semantic search found', semanticResult.results.length, 'platform businesses');
          
          // Add semantic results to platform businesses (avoid duplicates)
          semanticResult.results.forEach(business => {
            const existingBusiness = platformBusinesses.find(pb => pb.id === business.id);
            if (existingBusiness) {
              // Update existing business with semantic similarity if higher
              if (business.similarity > (existingBusiness.similarity || 0)) {
                existingBusiness.similarity = business.similarity;
              }
            } else {
              const semanticBusiness = {
                ...business,
                isPlatformBusiness: true,
                isOpen: true,
                distance: business.distance || 999999,
                duration: business.duration || 999999,
                reviews: business.reviews || []
              };
              platformBusinesses.push(semanticBusiness);
            }
          });
        } else {
          console.log('⚠️ Semantic search returned no results or failed');
        }
      } else {
        console.log('⚠️ Semantic search failed or unavailable, using AI only');
      }
    } catch (error) {
      console.warn('⚠️ Semantic search failed:', error);
    }
    
    console.log('📊 Total platform businesses found:', platformBusinesses.length);
    platformBusinesses.forEach(business => {
      console.log(`  - ${business.name} (exact: ${business.isExactMatch || false}, similarity: ${business.similarity || 'N/A'})`);
    });
    
    // Step 2: Fetch reviews for platform businesses
    console.log('🔍 Step 2: Fetching reviews for', platformBusinesses.length, 'platform businesses');

    try {
      // Enrich platform businesses with reviews BEFORE deduplication
      const enrichedPlatformBusinesses = await enrichPlatformBusinessesWithReviews(platformBusinesses);
      
      // --- POST-ENRICHMENT VERIFICATION ---
      console.log("--- POST-ENRICHMENT VERIFICATION ---");
      console.log("🔍 enrichedPlatformBusinesses array:", enrichedPlatformBusinesses);
      const davidaBosticPostEnrichment = enrichedPlatformBusinesses.find(b => b.name === 'Davida Bostic Health Coach');
      if (davidaBosticPostEnrichment) {
        console.log("🔍 Davida Bostic Health Coach (after enrichment) reviews count:", davidaBosticPostEnrichment.reviews?.length);
        console.log("🔍 Davida Bostic Health Coach (after enrichment) full object:", davidaBosticPostEnrichment);
      } else {
        console.log("🔍 Davida Bostic Health Coach not found in enrichedPlatformBusinesses array after enrichment.");
      }
      console.log("--- END POST-ENRICHMENT VERIFICATION ---");
      
      // --- DEDUPLICATE INPUT VERIFICATION ---
      console.log("--- DEDUPLICATE INPUT VERIFICATION ---");
      const davidaBosticDedupeInput = enrichedPlatformBusinesses.find(b => b.name === 'Davida Bostic Health Coach');
      if (davidaBosticDedupeInput) {
        console.log("🔍 Davida Bostic Health Coach (as input to deduplicateBusinesses) reviews count:", davidaBosticDedupeInput.reviews?.length);
        console.log("🔍 Davida Bostic Health Coach (as input to deduplicateBusinesses) object reference:", davidaBosticDedupeInput);
      } else {
        console.log("🔍 Davida Bostic Health Coach not found in deduplicateBusinesses input array.");
      }
      console.log("--- END DEDUPLICATE INPUT VERIFICATION ---");

      // Update platformBusinesses with enriched data
      platformBusinesses = enrichedPlatformBusinesses;
    } catch (error) {
      console.error('❌ Error enriching platform businesses with reviews:', error);
    }
    
    // Step 3: Check if we need AI augmentation
    const needsAIAugmentation = platformBusinesses.length < 6;
    console.log('🤖 Step 3: AI augmentation needed?', needsAIAugmentation, `(${platformBusinesses.length}/6 platform businesses)`);
    
    let aiBusinesses: any[] = [];
    let usedAI = false;

    setUsedAI(needsAIAugmentation);

    let canProceed = true;
    const creditsRequired = needsAIAugmentation ? 10 : 5; // AI costs 10, semantic costs 5
    
    if (currentUser && currentUser.id) {
      // Skip deduction for admin or unlimited credit users
      if (currentUser.role === 'administrator' || userCredits >= 999999) {
        canProceed = true;
      } else {
        // Check credit balance for regular users
        if (userCredits < creditsRequired) {
          setShowCreditWarning(true);
          canProceed = false;
        } else {
          // Deduct credits using secure backend function
          const success = await CreditService.deductSearchCredits(currentUser.id, needsAIAugmentation ? 'ai' : 'semantic');
          if (success) {
            // Update local credit count
            setUserCredits(prev => prev - creditsRequired);
          } else {
            setShowCreditWarning(true);
            canProceed = false;
          }
        }
      }
    }
    
    if (canProceed) {
      if (needsAIAugmentation) {
        // Call OpenAI API through our serverless function
        setIsSearching(true);
        
        // Log search activity
        if (currentUser && currentUser.id) {
          ActivityService.logSearch(currentUser.id, searchQuery, 'ai');
        }
        
        try {
          // Calculate how many AI businesses we need (max 4 total cards)
          const numAINeeded = Math.max(0, 15 - platformBusinesses.length); // Get more for better ranking
          
          // Always try to get AI results for better ranking diversity
          console.log(`🤖 Getting ${numAINeeded} AI businesses for enhanced ranking`);
          
          // Prepare the AI prompt with context about existing results
          const aiPrompt = platformBusinesses.length > 0 
            ? `Find businesses similar to "${searchQuery}". I already have ${platformBusinesses.length} results, so provide ${numAINeeded} different but related businesses that match this search intent.`
            : `Find businesses that match: "${searchQuery}". Focus on the mood, vibe, or specific needs expressed in this search.`;

          const response = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ 
              prompt: aiPrompt,
              searchQuery: searchQuery,
              existingResultsCount: platformBusinesses.length,
              numToGenerate: numAINeeded,
              latitude: latitude,   // Pass user's latitude from hook
              longitude: longitude  // Pass user's longitude from hook
            })
          }, 25000); // 25 second timeout for AI business search
          
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
              rating: business.rating || { thumbsUp: 0, thumbsDown: 0, sentimentScore: 75 },
              image: business.image_url || business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              isOpen: business.isOpen !== undefined ? business.isOpen : true,
              hours: business.hours || 'Hours unavailable',
              address: business.address || 'Address not available',
              distance: business.distance || Math.round((Math.random() * 4 + 1) * 10) / 10, // Ensure distance is present
              duration: business.duration || Math.floor(Math.random() * 10 + 5), // Ensure duration is present
              reviews: business.reviews || [],
              isPlatformBusiness: false,
              similarity: business.similarity || 0.8 // Default high similarity for AI businesses
            }));
            
            console.log(`🤖 AI enhanced search results for: ${searchQuery} (${aiGeneratedBusinesses.length} AI businesses)`);
            
            // Step 4: Combine and deduplicate results
            console.log('🔄 Combining results: Platform =', platformBusinesses.length, ', AI =', aiGeneratedBusinesses.length);
            
            // Combine all businesses for de-duplication
            let combinedBusinesses = [...platformBusinesses, ...aiGeneratedBusinesses];
            
            // De-duplicate businesses with robust property merging
            const uniqueBusinessesMap = new Map();
            combinedBusinesses.forEach(business => {
              // Use name-address combination for more reliable de-duplication
              const key = `${business.name.toLowerCase().trim()}-${(business.address || '').toLowerCase().trim()}`;
              
              if (uniqueBusinessesMap.has(key)) {
                const existingBusinessInMap = uniqueBusinessesMap.get(key)!;
                const currentBusiness = business; // Renaming for clarity

                // --- ADDED LOGGING FOR DIAGNOSIS ---
                console.log("--- MERGE DIAGNOSIS ---");
                console.log("🔁 Merging:", currentBusiness.name);
                console.log("  Existing in map (reviews, isPlatform):", existingBusinessInMap.reviews?.length, existingBusinessInMap.isPlatformBusiness);
                console.log("  Current business (reviews, isPlatform):", currentBusiness.reviews?.length, currentBusiness.isPlatformBusiness);
                // --- END ADDED LOGGING ---

                // 1. Determine if the merged business should be considered a platform business
                // It's a platform business if either the existing one or the current one is
                const isMergedPlatformBusiness = existingBusinessInMap.isPlatformBusiness || currentBusiness.isPlatformBusiness;
                
                // 2. Determine which business has the most complete data
                // Priority: Platform business with reviews > Platform business > Business with reviews > Any business
                let primaryBusiness, secondaryBusiness;
                
                if (existingBusinessInMap.isPlatformBusiness && existingBusinessInMap.reviews?.length > 0) {
                  primaryBusiness = existingBusinessInMap;
                  secondaryBusiness = currentBusiness;
                  console.log('🔄 [MERGE] Existing business is platform with reviews - using as primary');
                } else if (currentBusiness.isPlatformBusiness && currentBusiness.reviews?.length > 0) {
                  primaryBusiness = currentBusiness;
                  secondaryBusiness = existingBusinessInMap;
                  console.log('🔄 [MERGE] Current business is platform with reviews - using as primary');
                } else if (existingBusinessInMap.isPlatformBusiness) {
                  primaryBusiness = existingBusinessInMap;
                  secondaryBusiness = currentBusiness;
                  console.log('🔄 [MERGE] Existing business is platform - using as primary');
                } else if (currentBusiness.isPlatformBusiness) {
                  primaryBusiness = currentBusiness;
                  secondaryBusiness = existingBusinessInMap;
                  console.log('🔄 [MERGE] Current business is platform - using as primary');
                } else if (existingBusinessInMap.reviews?.length > 0) {
                  primaryBusiness = existingBusinessInMap;
                  secondaryBusiness = currentBusiness;
                  console.log('🔄 [MERGE] Existing business has reviews - using as primary');
                } else if (currentBusiness.reviews?.length > 0) {
                  primaryBusiness = currentBusiness;
                  secondaryBusiness = existingBusinessInMap;
                  console.log('🔄 [MERGE] Current business has reviews - using as primary');
                } else {
                  primaryBusiness = existingBusinessInMap;
                  secondaryBusiness = currentBusiness;
                  console.log('🔄 [MERGE] No clear priority - using existing as primary');
                }
                
                // 3. Merge businesses with primary taking precedence for critical data
                let mergedBusiness = {
                  ...secondaryBusiness, // Start with secondary as base
                  ...primaryBusiness,   // Override with primary data
                  // Explicitly preserve critical properties
                  isPlatformBusiness: isMergedPlatformBusiness,
                  isExactMatch: existingBusinessInMap.isExactMatch || currentBusiness.isExactMatch,
                  reviews: primaryBusiness.reviews || secondaryBusiness.reviews || [],
                  // Preserve the best available data for each field
                  similarity: Math.max(existingBusinessInMap.similarity || 0, currentBusiness.similarity || 0),
                  distance: Math.min(existingBusinessInMap.distance || 999999, currentBusiness.distance || 999999),
                  duration: Math.min(existingBusinessInMap.duration || 999999, currentBusiness.duration || 999999)
                };
                
                console.log('🔄 [MERGE] Final merged business:', {
                  name: mergedBusiness.name,
                  isPlatformBusiness: mergedBusiness.isPlatformBusiness,
                  reviewsCount: mergedBusiness.reviews?.length || 0,
                  isExactMatch: mergedBusiness.isExactMatch,
                  similarity: mergedBusiness.similarity
                });
                
                uniqueBusinessesMap.set(key, mergedBusiness);
              } else {
                console.log('🔄 [NEW] Adding new business:', business.name, {
                  isExactMatch: business.isExactMatch,
                  isPlatformBusiness: business.isPlatformBusiness,
                  reviewsCount: business.reviews?.length || 0
                });
                uniqueBusinessesMap.set(key, business);
              }
            });
            uniqueBusinesses = Array.from(uniqueBusinessesMap.values());
            console.log(`🔄 De-duplication: ${combinedBusinesses.length} total → ${uniqueBusinesses.length} unique businesses`);
            
            // Debug: Show which businesses have isExactMatch flag after de-duplication
            const exactMatchesAfterDedup = uniqueBusinesses.filter(b => b.isExactMatch);
            console.log(`🎯 Exact matches after de-duplication: ${exactMatchesAfterDedup.length}`, exactMatchesAfterDedup.map(b => b.name));
            
            // Apply new dynamic search algorithm
            console.log('🔍 Applying dynamic search algorithm to', uniqueBusinesses.length, 'businesses');
            const rankedBusinesses = applyDynamicSearchAlgorithm(uniqueBusinesses, latitude, longitude);
            
            setResults(rankedBusinesses);
            console.log('✅ Dynamic search algorithm results:', rankedBusinesses.length, 'businesses (from', uniqueBusinesses.length, 'unique)');
            
            trackEvent('search_performed', { 
              query: searchQuery, 
              used_ai: needsAIAugmentation,
              used_semantic: false,
              credits_deducted: creditsRequired,
              results_count: rankedBusinesses.length,
              platform_results: platformBusinesses.length,
              ai_results: aiGeneratedBusinesses.length,
              duplicates_removed: combinedBusinesses.length - uniqueBusinesses.length
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
          
          // Apply dynamic search algorithm to platform-only results
          const rankedFallbackResults = applyDynamicSearchAlgorithm(platformBusinesses, latitude, longitude);
          
          // Add exact match to the beginning if found and not already included
          let finalResults = rankedFallbackResults;
          if (exactMatchBusiness) {
            const exactMatchExists = rankedFallbackResults.some(b => b.id === exactMatchBusiness.id);
            if (!exactMatchExists) {
              console.log('🎯 [EXACT MATCH] Adding to top of results:', exactMatchBusiness.name);
              finalResults = [exactMatchBusiness, ...rankedFallbackResults];
            } else {
              console.log('🎯 [EXACT MATCH] Already in results, ensuring top position');
              // Remove from current position and add to top
              const filteredResults = rankedFallbackResults.filter(b => b.id !== exactMatchBusiness.id);
              finalResults = [exactMatchBusiness, ...filteredResults];
            }
          }
          
          setResults(finalResults);
          console.log('✅ Final search results:', finalResults.length, 'businesses (from', uniqueBusinesses.length, 'unique)');
          if (exactMatchBusiness) {
            console.log('🎯 [EXACT MATCH] Prioritized at top:', exactMatchBusiness.name, `(${exactMatchBusiness.distance?.toFixed(1) || 'unknown'} miles)`);
          }
          console.log('✅ Fallback dynamic search results:', rankedFallbackResults.length, 'businesses');
          trackEvent('search_performed', { 
            query: searchQuery, 
            used_ai: false, 
            credits_deducted: creditsRequired,
            results_count: finalResults.length,
            duplicates_removed: combinedBusinesses.length - uniqueBusinesses.length,
            exact_match_found: !!exactMatchBusiness
          });
        }
      } else {
        // De-duplicate platform-only results before ranking
        const uniquePlatformResults = platformBusinesses.filter((business, index, self) => 
          index === self.findIndex(b => b.id === business.id)
        );
        
        // Log search activity for platform-only searches
        if (currentUser && currentUser.id) {
          ActivityService.logSearch(currentUser.id, searchQuery, 'semantic');
        }
        
        console.log(`🔄 Platform-only de-duplication: ${platformBusinesses.length} total → ${uniquePlatformResults.length} unique businesses`);
        
        // Apply dynamic search algorithm to platform-only results
        console.log('🔍 Applying dynamic search algorithm to', uniquePlatformResults.length, 'businesses');
        const rankedPlatformResults = applyDynamicSearchAlgorithm(uniquePlatformResults, latitude, longitude);
        
        // Add exact match to the beginning if found and not already included
        let finalPlatformResults = rankedPlatformResults;
        if (exactMatchBusiness) {
          const exactMatchExists = rankedPlatformResults.some(b => b.id === exactMatchBusiness.id);
          if (!exactMatchExists) {
            console.log('🎯 [EXACT MATCH] Adding to top of platform-only results:', exactMatchBusiness.name);
            finalPlatformResults = [exactMatchBusiness, ...rankedPlatformResults];
          } else {
            console.log('🎯 [EXACT MATCH] Already in platform results, ensuring top position');
            // Remove from current position and add to top
            const filteredResults = rankedPlatformResults.filter(b => b.id !== exactMatchBusiness.id);
            finalPlatformResults = [exactMatchBusiness, ...filteredResults];
          }
        }
        
        setResults(finalPlatformResults);
        console.log('📊 Final platform-only results:', finalPlatformResults.length, 'businesses for:', searchQuery);
        if (exactMatchBusiness) {
          console.log('🎯 [EXACT MATCH] Prioritized at top:', exactMatchBusiness.name, `(${exactMatchBusiness.distance?.toFixed(1) || 'unknown'} miles)`);
        }
        trackEvent('search_performed', { 
          query: searchQuery, 
          used_ai: false,
          used_semantic: true,
          results_count: finalPlatformResults.length,
          duplicates_removed: platformBusinesses.length - uniquePlatformResults.length,
          exact_match_found: !!exactMatchBusiness
        });
      }
    }
    
    setIsSearching(false);
    setShowResults(true);
    setInitialResultsLoaded(true);
  };

  // Dynamic Search Algorithm Implementation
  const applyDynamicSearchAlgorithm = (businesses: any[], userLatitude?: number, userLongitude?: number) => {
    console.log('🔍 Applying dynamic search algorithm to', businesses.length, 'businesses');
    
    const exactMatches = businesses.filter(business => business.isExactMatch === true);
    const otherBusinesses = businesses.filter(business => business.isExactMatch !== true);
    
    console.log('🎯 Found', exactMatches.length, 'exact matches,', otherBusinesses.length, 'other businesses');
    
    // Debug exact matches
    exactMatches.forEach(business => {
      console.log('🎯 [EXACT MATCH] In algorithm:', business.name, 'isExactMatch:', business.isExactMatch, 'compositeScore:', business.compositeScore);
    });
    
    // Step 2: Filter other businesses by radius (10 miles max) - exact matches bypass this
    const businessesWithinRadius = otherBusinesses.filter(business => {
      const distance = business.distance || 0;
      const withinRadius = distance <= MAX_SEARCH_RADIUS_MILES;
      if (!withinRadius) {
        console.log(`🚫 Filtering out business outside radius: ${business.name} (${distance} miles)`);
      }
      return withinRadius;
    });
    
    console.log(`📍 ${businessesWithinRadius.length} businesses within ${MAX_SEARCH_RADIUS_MILES} mile radius`);
    
    // Step 3: Combine exact matches with businesses within radius
    const allBusinessesToRank = [...exactMatches, ...businessesWithinRadius];
    console.log(`📊 Total businesses to rank: ${allBusinessesToRank.length} (${exactMatches.length} exact + ${businessesWithinRadius.length} within radius)`);
    
    // Step 4: Calculate composite scores for each business
    const businessesWithScores = allBusinessesToRank.map(business => {
      // Exact matches already have compositeScore = 2.0, skip calculation
      if (business.isExactMatch) {
        console.log(`🎯 [EXACT MATCH] ${business.name}: PRIORITY SCORE = ${business.compositeScore}`);
        return business;
      }
      
      const compositeScore = calculateCompositeScore({
        similarity: business.similarity,
        distance: business.distance,
        isOpen: business.isOpen,
        isPlatformBusiness: business.isPlatformBusiness
      });
      
      console.log(`📊 ${business.name}: similarity=${business.similarity?.toFixed(3)}, distance=${business.distance}, isOpen=${business.isOpen}, isPlatform=${business.isPlatformBusiness} → score=${compositeScore}`);
      
      return {
        ...business,
        compositeScore
      };
    });
    
    // Step 5: Sort by composite score (descending) - exact matches will be first due to score = 2.0
    const sortedBusinesses = businessesWithScores.sort((a, b) => {
      return b.compositeScore - a.compositeScore;
    });
    
    // Step 6: Remove duplicates by ID and limit to 10
    const uniqueResults = sortedBusinesses.filter((business, index, self) => 
      index === self.findIndex(b => b.id === business.id)
    ).slice(0, 10);
    
    // Step 7: Log final ranking
    console.log('🏆 Final ranking:');
    uniqueResults.forEach((business, index) => {
      const matchType = business.isExactMatch ? '[EXACT MATCH]' : '';
      const distance = business.distance ? `${business.distance.toFixed(1)}mi` : 'unknown distance';
      console.log(`  ${index + 1}. ${business.name} ${matchType} (score: ${business.compositeScore}, similarity: ${getMatchPercentage(business.similarity)}%, ${distance})`);
    });
    
    // Step 8: Handle no results case
    if (uniqueResults.length === 0) {
      console.log('⚠️ No businesses found (no exact matches and none within 10 mile radius)');
      return [];
    }
    
    return uniqueResults;
  };

  // Exit app mode
  const exitAppMode = () => {
    setIsAppModeActive(false);
    setShowResults(false);
    setResults([]);
    setSearchQuery('');
    setInitialResultsLoaded(false);
    
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
    if (!currentUser || !currentUser.id) {
      setShowSignupPrompt(true);
      return;
    }

    try {
      const success = await BusinessService.saveAIRecommendation(business, currentUser.id);
      if (success) {
        alert(`❤️ ${business.name} has been added to your favorites!`);
        trackEvent('ai_business_favorited', { 
          business_name: business.name,
          user_id: currentUser.id,
          similarity: business.similarity
        });
      } else {
        alert('Failed to add to favorites. Please try again.');
      }
    } catch (error) {
      console.error('Error favoriting business:', error);
      alert('Failed to add to favorites. Please try again.');
    }
  };

  const handleTakeMeThere = (business) => {
    // Debug: Log the complete business object to inspect data
    console.log('🗺️ DEBUG: handleTakeMeThere called with business object:', business);
    console.log('🗺️ DEBUG: Business coordinates:', { 
      latitude: business.latitude, 
      longitude: business.longitude,
      hasCoords: !!(business.latitude && business.longitude)
    });
    console.log('🗺️ DEBUG: Business address/name:', { 
      address: business.address, 
      name: business.name,
      addressType: typeof business.address,
      nameType: typeof business.name
    });
    
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
    
    // Robust navigation URL construction with data validation
    let mapsUrl;
    if (business.latitude && business.longitude) {
      // Priority 1: Use coordinates (most reliable)
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
      console.log('🗺️ DEBUG: Using coordinates for maps URL');
    } else if (business.address && typeof business.address === 'string' && business.address.trim().length > 0) {
      // Priority 2: Use valid address string
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address.trim())}`;
      console.log('🗺️ DEBUG: Using address for maps URL:', business.address.trim());
    } else if (business.name && typeof business.name === 'string' && business.name.trim().length > 0) {
      // Priority 3: Use business name as fallback
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name.trim())}`;
      console.log('🗺️ DEBUG: Using business name for maps URL:', business.name.trim());
    } else {
      // Last resort: Generic search
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=business`;
      console.log('🗺️ DEBUG: Using generic fallback for maps URL');
    }
    
    console.log('🗺️ Opening Google Maps with URL:', mapsUrl);
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
            {/* Loading Message - Show when searching */}
            {isSearching && (
              <div className="mb-8 animate-in fade-in duration-500 text-center">
                  <div className="flex flex-col items-center justify-center mb-4">
                    <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-white text-center">
                      One Moment
                    </h2>
                  </div>
                  <p className="font-lora text-lg md:text-xl text-white/90 animate-pulse">
                    Vibe Check in Progress...
                  </p>
              </div>
            )}
            
            {/* Title and Subtitle */}
            <div className={`mb-8 transition-all duration-500 ${isSearching ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}>
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
            <div className={`w-full max-w-2xl mx-auto mb-6 transition-all duration-500 ${isSearching ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <div 
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
                          {formatCredits(userCredits, currentUser?.role)} credits
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
            <div className={`flex flex-wrap justify-center gap-1 sm:gap-2 transition-all duration-500 ${isSearching ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              {samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setSearchQuery(prompt);
                    handleSearch();
                  }}
                  disabled={isSearching}
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
                      {formatCredits(userCredits, currentUser?.role)} credits
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
                {results.map((business, businessIndex) => {
                  console.log("Platform Business object in AISearchHero:", business);
                  return (
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
                  );
                })}
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