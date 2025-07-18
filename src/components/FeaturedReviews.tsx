import React, { useState } from 'react';
import { Star, MapPin, CheckCircle, Download, Share2, Instagram } from 'lucide-react';
import { mockFeaturedReviews } from '../data/mockData';

const FeaturedReviews = () => {
  const [showSocialCard, setShowSocialCard] = useState<number | null>(null);

  const reviews = mockFeaturedReviews;

  const generateSocialCard = (review: any) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-poppins text-xl font-semibold">Share This Review</h3>
            <button 
              onClick={() => setShowSocialCard(null)}
              className="text-neutral-500 hover:text-neutral-700 text-2xl"
            >
              ✕
            </button>
          </div>
          
          {/* Instagram-style square card preview */}
          <div className="bg-gradient-to-br from-primary-500 to-accent-500 p-6 rounded-2xl text-white mb-6 aspect-square flex flex-col justify-between relative overflow-hidden">
            {/* Business image at the top */}
            <div className="absolute top-6 left-6 right-6">
              <img 
                src={review.image} 
                alt={review.name}
                className="w-full h-32 object-cover rounded-xl shadow-lg"
              />
            </div>
            
            {/* Content below image */}
            <div className="relative z-10 mt-36">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-6 w-6 mr-2 rounded-full bg-white p-1 flex items-center justify-center">
                    <span className="text-primary-500 font-bold text-xs">V&R</span>
                  </div>
                  <div>
                    <div className="font-poppins text-xs font-bold">VERIFIED</div>
                    <div className="font-poppins text-xs opacity-90">& REVIEWED</div>
                  </div>
                </div>
                <div className="flex items-center bg-white bg-opacity-20 px-2 py-1 rounded-full">
                  <span className="text-xs font-poppins font-bold">Score: {review.healthScore}</span>
                </div>
              </div>
              
              <h3 className="font-cinzel text-lg font-bold mb-2">{review.name}</h3>
              <p className="font-lora text-xs opacity-90 mb-3">
                "{review.review.substring(0, 60)}..."
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex text-yellow-300">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
                <div className="font-lora text-xs opacity-90">{review.location}</div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button className="flex-1 bg-primary-500 text-white py-3 px-6 rounded-xl font-poppins font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center justify-center">
              <Download className="h-5 w-5 mr-2" />
              Download
            </button>
            <button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-poppins font-semibold hover:opacity-90 transition-opacity duration-200 flex items-center justify-center">
              <Instagram className="h-5 w-5 mr-2" />
              Share to IG
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            Featured Reviews
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            Discover top-rated experiences from our latest verified visits and reviews.
          </p>
        </div>

        {/* Top Row - Regular Review Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className="bg-white border border-neutral-200 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="relative">
                <img
                  src={review.image}
                  alt={review.name}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1 flex items-center shadow-lg">
                  <CheckCircle className="h-4 w-4 text-primary-500 mr-1" />
                  <span className="font-poppins text-sm font-semibold text-neutral-700">Verified</span>
                </div>
                <div className="absolute bottom-4 left-4 bg-white rounded-full px-3 py-1 shadow-lg">
                  <span className="font-poppins text-sm font-bold text-primary-500">
                    Health Score: {review.healthScore}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-poppins text-sm text-primary-500 font-semibold uppercase tracking-wide">
                    {review.category}
                  </span>
                  <div className="flex items-center">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                </div>

                <h3 className="font-cinzel text-xl font-semibold text-neutral-900 mb-2">
                  {review.name}
                </h3>

                <div className="flex items-center text-neutral-600 mb-3">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span className="font-lora text-sm">{review.location}</span>
                </div>

                <p className="font-lora text-neutral-700 text-sm leading-relaxed mb-4">
                  {review.review}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {review.features.map((feature) => (
                    <span
                      key={feature}
                      className="font-lora bg-neutral-50 border border-neutral-200 text-neutral-700 px-2 py-1 rounded-full text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-lora text-xs text-neutral-500">
                    Reviewed {review.verifiedDate}
                  </span>
                  <button className="font-poppins text-primary-500 font-semibold hover:text-primary-600 transition-colors duration-200 text-sm">
                    View Review →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button className="font-poppins bg-primary-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200">
            View All Reviews
          </button>
        </div>
      </div>

      {/* Social card modal */}
      {showSocialCard && generateSocialCard(reviews.find(r => r.id === showSocialCard))}
    </section>
  );
};

export default FeaturedReviews;