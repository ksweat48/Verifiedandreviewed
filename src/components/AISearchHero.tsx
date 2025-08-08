import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Clock, ThumbsUp, ExternalLink, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ActivityService } from '../services/activityService';

interface SearchResult {
  id: string;
  name: string;
  shortDescription: string;
  rating: number;
  image: string | null;
  isOpen: boolean;
  hours: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  distance: number;
  duration: number;
  placeId: string;
  reviews: Array<{
    text: string;
    author: string;
    thumbsUp: boolean;
  }>;
  isPlatformBusiness: boolean;
  tags: string[];
  isGoogleVerified: boolean;
  similarity: number;
}

interface AISearchResponse {
  success: boolean;
  results: SearchResult[];
  query: string;
  usedAI: boolean;
  googleVerified: boolean;
  searchQueries: string[];
  foundBusinessesCount: number;
  searchLocation: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
}

export default function AISearchHero() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get user location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Could not get user location:', error);
          // Default to San Francisco
          setUserLocation({
            latitude: 37.7749,
            longitude: -122.4194
          });
        }
      );
    } else {
      // Default to San Francisco
      setUserLocation({
        latitude: 37.7749,
        longitude: -122.4194
      });
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setShowResults(false);
    setCurrentCardIndex(0);

    try {
      // Log search activity
      if (user) {
        await ActivityService.logSearch(user.id, searchQuery, 'ai');
      }

      const response = await fetch('/.netlify/functions/ai-business-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: searchQuery,
          searchQuery: searchQuery,
          existingResultsCount: 0,
          numToGenerate: 20,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data: AISearchResponse = await response.json();
      
      if (data.success && data.results) {
        setSearchResults(data.results);
        setShowResults(true);
      } else {
        console.error('Search failed:', data);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const nextCard = () => {
    setCurrentCardIndex((prev) => (prev + 1) % searchResults.length);
  };

  const prevCard = () => {
    setCurrentCardIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
  };

  const handleBusinessView = async (business: SearchResult) => {
    if (user) {
      await ActivityService.logBusinessView(user.id, business.id, business.name);
    }
  };

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-purple-800 via-purple-900 to-purple-950 flex items-center justify-center px-4 py-20">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
      
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Hero Content */}
        <div className="mb-12">
          <div className="flex items-center justify-center mb-6">
            <Sparkles className="w-8 h-8 text-purple-300 mr-3" />
            <h1 className="text-5xl md:text-6xl font-bold text-white">
              Find Your Vibe
            </h1>
          </div>
          
          <p className="text-xl md:text-2xl text-purple-100 mb-8 max-w-2xl mx-auto leading-relaxed">
            Discover businesses that match your mood and energy. 
            <br />
            <span className="text-purple-200">Tell us what you're feeling, we'll find the perfect spot.</span>
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-12">
          <div className="relative max-w-2xl mx-auto">
            <div className="bg-white shadow-lg rounded-2xl p-6 transition-all duration-300 hover:shadow-xl">
              <div className="flex items-center space-x-4">
                <Search className="w-6 h-6 text-neutral-400 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="I'm looking for a cozy coffee shop with good vibes..."
                  className="flex-1 text-lg text-neutral-900 placeholder-neutral-500 bg-transparent border-none outline-none"
                  disabled={isSearching}
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-300 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
                >
                  {isSearching ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Find Places</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Search Results */}
        {showResults && searchResults.length > 0 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6">
              <h3 className="text-2xl font-bold text-white mb-4">
                Found {searchResults.length} places that match your vibe
              </h3>
              
              {/* Card Navigation */}
              <div className="relative">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  {searchResults[currentCardIndex] && (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-xl font-bold text-neutral-900 mb-2">
                            {searchResults[currentCardIndex].name}
                          </h4>
                          <p className="text-neutral-600 mb-3">
                            {searchResults[currentCardIndex].shortDescription}
                          </p>
                        </div>
                        {searchResults[currentCardIndex].isGoogleVerified && (
                          <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold ml-4">
                            Google Verified
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-neutral-600">
                        {searchResults[currentCardIndex].rating > 0 && (
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span>{searchResults[currentCardIndex].rating.toFixed(1)}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span className={searchResults[currentCardIndex].isOpen ? 'text-green-600' : 'text-red-600'}>
                            {searchResults[currentCardIndex].isOpen ? 'Open' : 'Closed'}
                          </span>
                        </div>

                        {searchResults[currentCardIndex].distance < 999999 && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{searchResults[currentCardIndex].distance.toFixed(1)} mi</span>
                          </div>
                        )}

                        <div className="flex items-center space-x-1">
                          <ThumbsUp className="w-4 h-4 text-purple-600" />
                          <span>{Math.round(searchResults[currentCardIndex].similarity * 100)}% match</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={prevCard}
                            disabled={searchResults.length <= 1}
                            className="bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 text-neutral-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={nextCard}
                            disabled={searchResults.length <= 1}
                            className="bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 text-neutral-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                        
                        <button
                          onClick={() => handleBusinessView(searchResults[currentCardIndex])}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Counter */}
                <div className="text-center mt-4">
                  <span className="text-white/70 text-sm">
                    {currentCardIndex + 1} of {searchResults.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Results */}
        {showResults && searchResults.length === 0 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center">
              <h3 className="text-xl font-semibold text-white mb-2">
                No matches found
              </h3>
              <p className="text-purple-100">
                Try a different search or be more specific about what you're looking for.
              </p>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-4">
              <Sparkles className="w-8 h-8 text-purple-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">AI-Powered</h3>
              <p className="text-purple-100 text-sm">
                Our AI understands your mood and finds businesses that match your vibe
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-4">
              <MapPin className="w-8 h-8 text-purple-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Location-Based</h3>
              <p className="text-purple-100 text-sm">
                Find great spots near you with accurate distance and travel time
              </p>
            </div>
          </div>
          
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-4">
              <Star className="w-8 h-8 text-purple-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Verified Reviews</h3>
              <p className="text-purple-100 text-sm">
                Real reviews from Google and our community of verified users
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}