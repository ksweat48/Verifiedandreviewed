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
  onOpenReviewModal: (business: BusinessCard) => void;
  onTakeMeThere: (business: BusinessCard) => void;
}> = ({ business, onRecommend, onOpenReviewModal, onTakeMeThere }) => {
  const [businessProfileOpen, setBusinessProfileOpen] = useState(false);

  const handleBusinessClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusinessProfileOpen(true);
  };

  return (
    <>
      <div className="relative rounded-xl overflow-hidden group h-full w-full flex-grow z-0 flex flex-col shadow-md hover:shadow-lg transition-all duration-300 min-h-[220px] max-h-[235px]">
        <div className="relative h-full w-full flex-grow">
          <img
            src={business.image}
            alt={business.name}
            className="w-full h-full object-cover absolute inset-0 cursor-pointer"
            onClick={handleBusinessClick}
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-70"></div>
          
          {business.isOpen && (
            <div className="absolute top-3 left-3 z-10">
              <div className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-poppins font-semibold bg-green-500 shadow-sm">
                Open
              </div>
            </div>
          )}
          
          <div className="absolute inset-0 p-3 text-white flex flex-col justify-end group cursor-default">
            {/* Moved business name and hours down, closer to the recommend button */}
            <div className="mt-auto mb-3">
              <h3 className="font-poppins text-sm font-semibold mb-0.5 line-clamp-1 group-hover:text-primary-100 transition-colors duration-200 cursor-pointer" onClick={handleBusinessClick}>
                {business.name}
              </h3>
            
              <div className="flex items-center">
                <Icons.Clock className="h-3 w-3 mr-1" />
                <span className="font-lora text-xs text-white/80">
                  {business.hours || 'Hours unavailable'}
                  {business.distance && (
                    <span className="ml-1">• {business.distance.toFixed(1)} mi • 10 min</span>
                  )}
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1 items-center justify-between mb-2">
              <div className="flex flex-nowrap gap-1 overflow-hidden max-w-[65%]">
                {business.tags?.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-lora"
                  >
                    {tag}
                  </span>
                ))}
                {(business.tags?.length || 0) > 2 && (
                  <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-lora">
                    +{business.tags!.length - 2}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  onRecommend(business);
                }}
                className="flex-1 bg-primary-500 text-white py-1.5 px-2 rounded-lg font-poppins text-xs font-semibold hover:bg-primary-600 transition-all duration-200 flex items-center justify-center"
              >
                <Icons.Heart className="h-3 w-3 mr-1" />
                Recommend
              </button>
              <button
                onClick={() => {
                  onTakeMeThere(business);
                }}
                className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg font-poppins text-xs font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
              >
                GO
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Business Profile Modal */}
      <BusinessProfileModal
        isOpen={businessProfileOpen}
        onClose={() => setBusinessProfileOpen(false)}
        business={{
          id: business.id,
          name: business.name,
          category: business.tags?.[0],
          description: business.reviews?.[0]?.text,
          address: business.address,
          location: business.address,
          image_url: business.image,
          gallery_urls: business.reviews?.[0]?.images?.map(img => img.url) || [],
          hours: business.hours,
          tags: business.tags,
          is_verified: false,
          thumbs_up: business.rating?.thumbsUp,
          thumbs_down: business.rating?.thumbsDown,
          sentiment_score: business.rating?.sentimentScore,
          isOpen: business.isOpen
        }}
      />
    </>
  );
};

export default AIBusinessCard;