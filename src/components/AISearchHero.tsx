import React, { useState, useEffect } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import * as AISearchService from '../services/semanticSearchService';

interface AISearchHeroProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const DISTANCE_OPTIONS = [10, 30];

interface Business {
  id: string;
  name: string;
  address?: string;
  location?: string;
  category?: string;
  description?: string;
  image_url?: string;
  distance?: number;
  isOpen?: boolean;
  isOnPlatform?: boolean;
  compositeScore?: number;
}

const AISearchHero: React.FC<AISearchHeroProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  const [prompt, setPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [maxRadius, setMaxRadius] = useState(10);
  const { user } = useAuth();
  const { latitude, longitude, error: locationError } = useGeolocation();

  const calculateCompositeScore = (business: Business, userLat: number, userLng: number) => {
    let score = 0;
    
    // Semantic similarity (0-1, weight: 40%)
    const semanticScore = business.compositeScore || 0;
    score += semanticScore * 0.4;
    
    // Distance score (closer = higher, weight: 35%)
    if (business.distance !== undefined) {
      const distanceScore = Math.max(0, 1 - (business.distance / 50)); // Normalize to 0-1
      score += distanceScore * 0.35;
    }
    
    // Platform bonus (weight: 15%)
    if (business.isOnPlatform) {
      score += 0.15;
    }
    
    // Open status bonus (weight: 10%)
    if (business.isOpen) {
      score += 0.1;
    }
    
    return score;
  };

  const applyDynamicSearchAlgorithm = (allBusinesses: Business[], maxRadius: number, userLat: number, userLng: number) => {
    // Calculate composite scores for all businesses
    const businessesWithScores = allBusinesses.map(business => ({
      ...business,
      compositeScore: calculateCompositeScore(business, userLat, userLng)
    }));

    let filteredBusinesses: Business[] = [];

    if (maxRadius === 10) {
      // For 10mi setting: show only businesses within 0-10 miles
      filteredBusinesses = businessesWithScores.filter(business => 
        business.distance !== undefined && business.distance <= 10
      );
    } else if (maxRadius === 30) {
      // For 30mi setting: show only businesses within 10-30 miles
      filteredBusinesses = businessesWithScores.filter(business => 
        business.distance !== undefined && business.distance > 10 && business.distance <= 30
      );
    }

    // Sort by composite score (descending) and return top 10
    return filteredBusinesses
      .sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0))
      .slice(0, 10);
  };

  const handleSearch = async () => {
    if (!prompt.trim() || !latitude || !longitude) return;

    setIsSearching(true);
    setIsAppModeActive(true);

    try {
      const aiResponse = await AISearchService.searchBusinesses(
        prompt,
        50, // Increased from 20 to 50
        latitude,
        longitude
      );

      if (aiResponse?.businesses) {
        const processedBusinesses = applyDynamicSearchAlgorithm(
          aiResponse.businesses,
          maxRadius,
          latitude,
          longitude
        );
        setBusinesses(processedBusinesses);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Discover Your Perfect Spot
          </h1>
          <p className="text-xl text-gray-600">
            Tell us what vibe you're looking for, and we'll find the perfect places nearby
          </p>
        </div>

        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., cozy coffee shop with good wifi, trendy rooftop bar, family-friendly restaurant..."
              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {locationError ? 'Location access needed' : 'Using your location'}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Distance:</span>
              <select
                value={maxRadius}
                onChange={(e) => setMaxRadius(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {DISTANCE_OPTIONS.map(distance => (
                  <option key={distance} value={distance}>
                    within {distance}mi
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={!prompt.trim() || !latitude || !longitude || isSearching}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Find My Vibe</span>
              </>
            )}
          </button>
        </div>
      </div>

      {businesses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {businesses.map((business) => (
            <div key={business.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">{business.name}</h3>
                {business.distance && (
                  <span className="text-sm text-gray-500">{business.distance.toFixed(1)} mi</span>
                )}
              </div>
              
              {business.image_url && (
                <img 
                  src={business.image_url} 
                  alt={business.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              
              {business.description && (
                <p className="text-gray-600 mb-4">{business.description}</p>
              )}
              
              {business.address && (
                <p className="text-sm text-gray-500 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {business.address}
                </p>
              )}
              
              <div className="flex items-center justify-between mt-4">
                {business.category && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    {business.category}
                  </span>
                )}
                
                <div className="flex items-center space-x-2">
                  {business.isOnPlatform && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Verified
                    </span>
                  )}
                  {business.isOpen && (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                      Open
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AISearchHero;