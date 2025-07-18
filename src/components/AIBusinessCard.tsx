import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import BusinessProfileModal from './BusinessProfileModal';

interface BusinessCard {
  id: string;
  name: string;
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
  tags?: string[];
  distance?: number;
}

// AI Business Card Component - Simplified card for AI-fetched businesses
const AIBusinessCard: React.FC<{
  business: BusinessCard;
  onRecommend: (business: BusinessCard) => void;
}> = ({ business, onRecommend }) => {
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-lg border border-neutral-200 p-4 hover:shadow-md transition-all duration-200 mb-3">
        <div className="space-y-3">
          {/* Business Name - Large Bold Text */}
          <h3 className="font-poppins text-lg font-bold text-neutral-900">
            {business.name}
          </h3>
          
          {/* Open/Close Status and Hours */}
          <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
              business.isOpen 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {business.isOpen ? 'Open' : 'Closed'}
            </div>
            <span className="font-lora text-sm text-neutral-600">
              {business.hours || 'Hours unavailable'}
            </span>
          </div>
          
          {/* Tags */}
          {business.tags && business.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {business.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-full text-xs font-lora"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Recommend Button */}
          <button 
            onClick={() => onRecommend(business)}
            className="w-full bg-primary-500 text-white py-2 px-4 rounded-lg font-poppins text-sm font-semibold hover:bg-primary-600 transition-all duration-200 flex items-center justify-center"
          >
            <Icons.Heart className="h-4 w-4 mr-2" />
            Recommend for Verification
          </button>
        </div>
      </div>
    </>
  );
};

export default AIBusinessCard;