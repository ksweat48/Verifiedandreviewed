import React, { useState, useEffect } from 'react';
import { Search, MapPin, Sparkles, Loader2 } from 'lucide-react';
import AIBusinessCard from './AIBusinessCard';
import { SemanticSearchService } from '../services/semanticSearchService';
import { useGeolocation } from '../hooks/useGeolocation';
import { ActivityService } from '../services/activityService';
import { UserService } from '../services/userService';

interface OfferingSearchResult {
  offeringId: string;
  businessId: string;
  offeringTitle: string;
  offeringImageUrl: string;
  offeringType: string;
  businessName: string;
  businessAddress?: string;
  distance?: number;
  duration?: number;
  businessRating?: number;
  isOpen?: boolean;
  similarity?: number;
}

interface LegacyBusinessResult {
  id: string;
  name: string;
  image?: string;
  shortDescription?: string;
  rating?: number;
  distance?: number;
  duration?: number;
  isOpen?: boolean;
  similarity?: number;
}

type SearchResult = OfferingSearchResult | LegacyBusinessResult;

const AISearchHero: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [offeringSearchAvailable, setOfferingSearchAvailable] = useState(false);
  
  const { location, error: locationError } = useGeolocation();

  // Check if offering search is available
  useEffect(() => {
    const checkOfferingSearch = async () => {
      try {
        const available = await SemanticSearchService.isOfferingSearchAvailable();
        setOfferingSearchAvailable(available);
      } catch (error) {
        console.error('Error checking offering search availability:', error);
        setOfferingSearchAvailable(false);
      }
    };
    
    checkOfferingSearch();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    
    try {
      // Log search activity
      try {
        const user = await UserService.getCurrentUser();
        if (user) {
          await ActivityService.logActivity({
            userId: user.id,
            eventType: 'search',
            eventDetails: {
              query: searchQuery.trim(),
              search_type: offeringSearchAvailable ? 'offering_search' : 'business_search',
              location: location ? {
                latitude: location.latitude,
                longitude: location.longitude
              } : null
            }
          });
        }
      } catch (activityError) {
        console.debug('Search activity logging failed:', activityError);
      }

      let results: SearchResult[] = [];

      // Try offering search first if available
      if (offeringSearchAvailable) {
        try {
          console.log('🔍 Searching offerings for:', searchQuery);
          const offeringResults = await SemanticSearchService.searchOfferingsByVibe(
            searchQuery.trim(),
            location?.latitude,
            location?.longitude
          );
          
          if (offeringResults && offeringResults.length > 0) {
            results = offeringResults;
            console.log('✅ Found', results.length, 'offering results');
          }
        } catch (offeringError) {
          console.error('Offering search failed:', offeringError);
        }
      }

      // Fallback to business search if no offering results
      if (results.length === 0) {
        try {
          console.log('🔍 Falling back to business search for:', searchQuery);
          const businessResults = await SemanticSearchService.searchBusinessesByVibe(
            searchQuery.trim(),
            location?.latitude,
            location?.longitude
          );
          
          if (businessResults && businessResults.length > 0) {
            results = businessResults;
            console.log('✅ Found', results.length, 'business results');
          }
        } catch (businessError) {
          console.error('Business search failed:', businessError);
          throw businessError;
        }
      }

      setSearchResults(results);
      
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCardClick = (result: SearchResult) => {
    // Handle card click - for now just log
    console.log('Card clicked:', result);
  };

  const isOfferingResult = (result: SearchResult): result is OfferingSearchResult => {
    return 'offeringId' in result;
  };

  return (
    <div className="relative bg-gradient-to-br from-primary-50 to-accent-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Content */}
        <div className="text-center mb-12">
          <h1 className="font-cinzel text-4xl md:text-6xl font-bold text-neutral-900 mb-6">
            Find Your Perfect
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-accent-500 block">
              Dish & Experience
            </span>
          </h1>
          
          <p className="font-lora text-xl text-neutral-600 max-w-3xl mx-auto mb-8">
            {offeringSearchAvailable 
              ? "Search for specific dishes, services, and products using natural language. Find exactly what you're craving."
              : "Discover amazing businesses that match your vibe using AI-powered search."
            }
          </p>

          {/* Location Status */}
          {location && (
            <div className="flex items-center justify-center text-neutral-500 mb-8">
              <MapPin className="h-4 w-4 mr-2" />
              <span className="font-lora text-sm">
                Searching near your location
              </span>
            </div>
          )}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-neutral-400" />
            </div>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={offeringSearchAvailable 
                ? "Try 'brown stew fish', 'custom birthday cake', or 'shoe repair'..."
                : "Describe the vibe you're looking for..."
              }
              className="w-full pl-16 pr-32 py-6 text-lg font-lora border-2 border-neutral-200 rounded-2xl focus:border-primary-500 focus:ring-0 bg-white shadow-lg"
              disabled={isSearching}
            />
            
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute inset-y-0 right-0 mr-2 px-8 bg-primary-500 text-white rounded-xl font-poppins font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Search
                </>
              )}
            </button>
          </div>
        </form>

        {/* Search Results */}
        {hasSearched && (
          <div className="max-w-6xl mx-auto">
            {searchError ? (
              <div className="text-center py-12">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                  <h3 className="font-poppins text-lg font-semibold text-red-800 mb-2">
                    Search Error
                  </h3>
                  <p className="font-lora text-red-600">
                    {searchError}
                  </p>
                </div>
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-2">
                    {offeringSearchAvailable ? 'Perfect Matches' : 'AI Recommendations'}
                  </h2>
                  <p className="font-lora text-neutral-600">
                    Found {searchResults.length} {offeringSearchAvailable ? 'dishes and services' : 'businesses'} that match your search
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {searchResults.map((result) => (
                    <AIBusinessCard
                      key={isOfferingResult(result) ? result.offeringId : result.id}
                      {...result}
                      onClick={() => handleCardClick(result)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8">
                  <Search className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                  <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                    No Results Found
                  </h3>
                  <p className="font-lora text-neutral-600">
                    {offeringSearchAvailable 
                      ? "We couldn't find any dishes, products, or services matching your search. Try different keywords or check your spelling."
                      : "We couldn't find any businesses matching your search. Try different keywords or check your spelling."
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AISearchHero;