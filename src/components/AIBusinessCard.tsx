import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { getMatchPercentage } from '../utils/similarityUtils';

interface BusinessCard {
  id: string;
  name: string;
  address: string;
  image: string;
  shortDescription?: string;
  rating: number;
  hours?: string;
  isOpen?: boolean;
  reviews: Array<{
    text: string;
    author: string;
    images?: Array<{url: string; alt?: string}>;
    thumbsUp: boolean;
  }>;
  isPlatformBusiness: boolean;
  distance?: number;
  duration?: number;
  isGoogleVerified?: boolean;
  placeId?: string;
  similarity?: number; // Semantic search similarity score (0-1)
  is_mobile_business?: boolean;
  phone_number?: string;
  latitude?: number;
  longitude?: number;
  website_url?: string;
  is_virtual?: boolean;
}

const AIBusinessCard: React.FC<{
  business: BusinessCard;
  onRecommend: (business: BusinessCard) => void;
  onGoClick?: (business: BusinessCard) => void;
}> = ({ business, onRecommend, onGoClick }) => {

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group">
      <div className="p-2">
        <h3 className="font-poppins text-base font-bold text-neutral-900 line-clamp-1 mb-1">
          {business.name}
        </h3>
          
          <div className="flex items-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Icons.Star
                key={i}
                className={`h-3 w-3 ${
                  i < Math.floor(business.rating)
                    ? 'text-yellow-400 fill-current'
                    : 'text-neutral-300'
                }`}
              />
            ))}
            <span className="font-poppins text-xs font-semibold text-neutral-700 ml-1">
              {business.rating.toFixed(1)}
            </span>
            {/* Semantic Similarity Score - Only show if available and > 0 */}
            {business.similarity && business.similarity > 0 && (
              <span className="bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-poppins font-semibold ml-2">
                {getMatchPercentage(business.similarity)}% match
              </span>
            )}
            {business.isGoogleVerified && (
              <span className="font-poppins text-xs text-green-600 font-semibold ml-2">
                Google
              </span>
            )}
          </div>
          
          {business.shortDescription && (
            <p className="font-lora text-xs text-neutral-600 line-clamp-2 leading-relaxed mb-1">
              {business.shortDescription}
            </p>
          )}
          
          <div className="mb-1">
            <p className="font-lora text-xs text-neutral-600 flex items-center gap-1">
              <Icons.MapPin className="h-3 w-3 flex-shrink-0 text-neutral-500" />
              <span className="line-clamp-1">{business.address}</span>
            </p>
          </div>
          
          {business.hours && (
            <div className="flex items-center gap-2 mb-2">
              <div className={`px-2 py-0.5 rounded-full text-xs font-poppins font-semibold ${
                business.isOpen 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {business.isOpen ? 'Open' : 'Closed'}
              </div>
              <span className="font-lora text-xs text-neutral-600 truncate">
                {business.hours}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Use the onGoClick prop if provided, otherwise use default behavior
                if (onGoClick) {
                  onGoClick(business);
                } else {
                  // Fallback to default navigation behavior
                  if (business.is_virtual && business.website_url) {
                    window.open(business.website_url, '_blank', 'noopener,noreferrer');
                  } else if (business.is_mobile_business && business.phone_number) {
                    window.open(`tel:${business.phone_number}`, '_self');
                  } else {
                    // Standard navigation logic
                    let mapsUrl;
                    if (business.placeId && typeof business.placeId === 'string' && business.placeId.trim().length > 0) {
                      const businessName = business.name && typeof business.name === 'string' ? business.name.trim() : 'business';
                      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessName)}&query_place_id=${business.placeId.trim()}`;
                    } else if (business.latitude && business.longitude) {
                      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
                    } else if (business.address && typeof business.address === 'string' && business.address.trim().length > 0) {
                      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address.trim())}`;
                    } else if (business.name && typeof business.name === 'string' && business.name.trim().length > 0) {
                      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name.trim())}`;
                    } else {
                      mapsUrl = `https://www.google.com/maps/search/?api=1&query=business`;
                    }
                    
                    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                  }
                }
              }}
              className="flex-1 bg-gradient-to-r from-primary-500 to-accent-500 text-white py-2 px-3 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center text-sm"
            >
              {business.is_virtual && business.website_url ? (
                <>
                  <Icons.Globe className="h-4 w-4 mr-1" />
                  VISIT
                </>
              ) : business.is_mobile_business && business.phone_number ? (
                <>
                  <Icons.Phone className="h-4 w-4 mr-1" />
                  CALL
                </>
              ) : (
                <>
                  <Icons.Navigation className="h-4 w-4 mr-1" />
                  GO
                </>
              )}
              {business.distance && business.duration && (
                <span className="ml-1 text-xs opacity-90">
                  {business.distance}mi • {business.duration} min
                </span>
              )}
            </button>
            <button 
              onClick={() => onRecommend(business)}
              className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-red-500 rounded-lg transition-all duration-200 flex items-center justify-center flex-shrink-0"
              title="Recommend for Verification"
            >
              <Icons.Heart className="h-4 w-4" />
            </button>
          </div>
        </div>
    </div>
  );
};

export default AIBusinessCard;