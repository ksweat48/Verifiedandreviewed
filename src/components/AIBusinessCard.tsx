import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import BusinessProfileModal from './BusinessProfileModal';
import { Star } from 'lucide-react';

interface BusinessCard {
  id: string;
  name: string;
  address: string;
  shortDescription?: string;
  rating: number; // Google rating (e.g., 4.5)
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
}

// AI Business Card Component - Simplified card for AI-fetched businesses
const AIBusinessCard: React.FC<{
  business: BusinessCard;
  onRecommend: (business: BusinessCard) => void;
}> = ({ business, onRecommend }) => {
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group">
        <div className="p-2">
          {/* Business Name - Large Bold Text */}
          <h3 className="font-poppins text-base font-bold text-neutral-900 line-clamp-1 mb-1">
            {business.name}
          </h3>
          
          {/* Google Rating */}
          <div className="flex items-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star
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
            {business.isGoogleVerified && (
              <span className="font-poppins text-xs text-green-600 font-semibold ml-2">
                Google Verified
              </span>
            )}
          </div>
          
          {/* Short Description - 2 lines max */}
          {business.shortDescription && (
            <p className="font-lora text-xs text-neutral-600 line-clamp-2 leading-relaxed mb-1">
              {business.shortDescription}
            </p>
          )}
          
          {/* Address */}
          <div className="mb-1">
            <p className="font-lora text-xs text-neutral-600 flex items-center gap-1">
              <Icons.MapPin className="h-3 w-3 flex-shrink-0 text-neutral-500" />
              <span className="line-clamp-1">{business.address}</span>
            </p>
          </div>
          
          {/* Open/Close Status and Hours - Compact */}
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
          
          {/* Go and Recommend Buttons */}
          <div className="flex items-center gap-2 mt-2">
            <button 
              onClick={() => {
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
                window.open(mapsUrl, '_blank');
              }}
              className="flex-1 bg-gradient-to-r from-primary-500 to-accent-500 text-white py-2 px-3 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center text-sm"
            >
              <Icons.Navigation className="h-4 w-4 mr-1" />
              GO
              {business.distance && business.duration && (
                <span className="ml-1 text-xs opacity-90">
                  {business.distance}mi
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
    </>
  );
};

export default AIBusinessCard;