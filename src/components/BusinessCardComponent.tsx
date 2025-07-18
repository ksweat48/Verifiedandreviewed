import React, { useState } from 'react';
import * as Icons from 'lucide-react';

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
    thumbsUp: boolean;
  }>;
  isPlatformBusiness: boolean;
  tags?: string[];
}

// Business Card Component
const BusinessCardComponent: React.FC<{
  business: BusinessCard;
  onRecommend: (business: BusinessCard) => void;
  onTakeMeThere: (business: BusinessCard) => void;
}> = ({ business, onRecommend, onTakeMeThere }) => {
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const sentiment = getSentimentBadge(business.rating.sentimentScore);

  const nextReview = () => {
    setCurrentReviewIndex((prev) => (prev + 1) % business.reviews.length);
  };

  const prevReview = () => {
    setCurrentReviewIndex((prev) => (prev - 1 + business.reviews.length) % business.reviews.length);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Image */}
      <div className="relative h-48">
        <img
          src={business.image}
          alt={business.name}
          className="w-full h-full object-cover"
        />
        
        {/* Status Badge */}
        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-white text-sm font-poppins font-semibold ${
          business.isOpen ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {business.isOpen ? 'Open' : 'Closed'}
        </div>

        {/* Platform Business Badge */}
        {business.isPlatformBusiness && (
          <div className="absolute top-4 left-4 bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold">
            Verified
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-1">
              {business.name}
            </h3>
            <div className="flex items-center mb-2">
              <div className="flex items-center text-green-600">
                <Icons.ThumbsUp className="h-4 w-4 mr-1 fill-current" />
                <span className="font-poppins text-sm font-semibold">
                  {business.rating.thumbsUp}
                </span>
              </div>
            </div>
          </div>
          
          {/* Sentiment Badge */}
          {sentiment && business.isPlatformBusiness && (
            <div className={`${sentiment.color} text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold`}>
              {sentiment.emoji} {sentiment.text}
            </div>
          )}
        </div>

        {/* Hours & Location */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-neutral-600">
            <Icons.Clock className="h-4 w-4 mr-2" />
            <span className="font-lora text-sm">{business.hours}</span>
          </div>
          <div className="flex items-center text-neutral-600">
            <Icons.MapPin className="h-4 w-4 mr-2" />
            <span className="font-lora text-sm">{business.address}</span>
          </div>
        </div>

        {/* Tags */}
        {business.tags && (
          <div className="flex flex-wrap gap-2 mb-4">
            {business.tags.map((tag, index) => (
              <span
                key={index}
                className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-poppins"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Reviews Carousel */}
        <div className="mb-4">
          <h4 className="font-poppins font-semibold text-neutral-900 mb-2">Reviews</h4>
          <div className="relative bg-neutral-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Icons.ThumbsUp className={`h-4 w-4 mr-1 ${business.reviews[currentReviewIndex].thumbsUp ? 'text-green-500 fill-current' : 'text-neutral-400'}`} />
              </div>
              <span className="font-poppins text-xs text-neutral-500">
                {currentReviewIndex + 1} of {business.reviews.length}
              </span>
            </div>
            <p className="font-lora text-sm text-neutral-700 mb-2">
              "{business.reviews[currentReviewIndex].text}"
            </p>
            <p className="font-poppins text-xs text-neutral-500">
              - {business.reviews[currentReviewIndex].author}
            </p>
            
            {business.reviews.length > 1 && (
              <div className="flex justify-center mt-3 space-x-2">
                <button onClick={prevReview} className="text-neutral-400 hover:text-neutral-600">←</button>
                <button onClick={nextReview} className="text-neutral-400 hover:text-neutral-600">→</button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => onTakeMeThere(business)}
            className="w-full bg-gradient-to-r from-primary-500 to-accent-500 text-white py-3 px-4 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
          >
            <Icons.ExternalLink className="h-4 w-4 mr-2" />
            Take Me There
          </button>
          
          {!business.isPlatformBusiness && (
            <button
              onClick={() => onRecommend(business)}
              className="w-full border-2 border-primary-500 text-primary-500 py-3 px-4 rounded-lg font-poppins font-semibold hover:bg-primary-50 transition-all duration-200 flex items-center justify-center"
            >
              <Icons.Heart className="h-4 w-4 mr-2" />
              Recommend This
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const getSentimentBadge = (score: number) => {
  if (score >= 80) return { color: 'bg-green-500', text: 'Great', emoji: '🟢' };
  if (score >= 70 && score < 80) return { color: 'bg-blue-500', text: 'Good', emoji: '🔵' };
  if (score >= 65 && score < 70) return { color: 'bg-yellow-500', text: 'Fair', emoji: '🟡' };
  return { color: 'bg-red-500', text: 'Improve', emoji: '🔴' };
};

export default BusinessCardComponent;