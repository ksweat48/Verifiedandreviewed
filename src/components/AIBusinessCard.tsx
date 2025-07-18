import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import BusinessProfileModal from './BusinessProfileModal';

interface BusinessCard {
  id: string;
  name: string;
  shortDescription?: string;
  rating: {
    thumbsUp: number;
    thumbsDown?: number;
    sentimentScore: number;
  };
  image: string;
  isOpen: boolean;
  hours: string;
  address: string;
  reviews: Array<{
    text: string;
    author: string;
    images?: Array<{url: string; alt?: string}>;
    thumbsUp: boolean;
  }>;
  isPlatformBusiness: boolean;
  distance?: number;
  duration?: number;
}

// AI Business Card Component - Simplified card for AI-fetched businesses
const AIBusinessCard: React.FC<{
  business: BusinessCard;
  onRecommend: (business: BusinessCard) => void;
}> = ({ business, onRecommend }) => {
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-lg border border-neutral-200 py-4 px-2 hover:shadow-md transition-all duration-200 mb-3">
        <div className="space-y-3">
          {/* Business Name - Large Bold Text */}
          <h3 className="font-poppins text-lg font-bold text-neutral-900 line-clamp-1">
            {business.name}
          </h3>
          
          {/* Short Description - 2 lines max */}
          {business.shortDescription && (
            <p className="font-lora text-sm text-neutral-600 line-clamp-2 leading-relaxed">
              {business.shortDescription}
            </p>
          )}
          
          {/* Open/Close Status and Hours */}
          <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
            <div className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
              business.isOpen 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {business.isOpen ? 'Open' : 'Closed'}
            </div>
            <span className="font-lora text-sm text-neutral-600 truncate">
              {business.hours || 'Hours unavailable'}
            </span>
          </div>
          
          {/* Go and Recommend Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
                window.open(mapsUrl, '_blank');
              }}
              className="flex-1 bg-primary-500 text-white py-2 px-3 rounded-lg font-poppins text-sm font-semibold hover:bg-primary-600 transition-all duration-200 whitespace-nowrap flex-shrink-0"
            >
              Go {business.distance ? `${business.distance}mi` : ''} {business.duration ? `${business.duration}min` : ''}
            </button>
            <button 
              onClick={() => onRecommend(business)}
              className="w-10 h-10 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-red-500 rounded-lg transition-all duration-200 flex items-center justify-center flex-shrink-0"
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