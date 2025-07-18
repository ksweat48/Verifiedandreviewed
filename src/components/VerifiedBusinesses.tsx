import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Shield, ArrowRight, ThumbsUp } from 'lucide-react';
import { mockVerifiedBusinesses } from '../data/mockData';

const VerifiedBusinesses = () => {
  const navigate = useNavigate();

  const verifiedBusinesses = mockVerifiedBusinesses;

  const getSentimentBadge = (score: number) => {
    if (score >= 80) return { color: 'bg-green-500', text: 'Great', emoji: '🟢' };
    if (score >= 70 && score < 80) return { color: 'bg-blue-500', text: 'Good', emoji: '🔵' };
    if (score >= 65 && score < 70) return { color: 'bg-yellow-500', text: 'Fair', emoji: '🟡' };
    return { color: 'bg-red-500', text: 'Improve', emoji: '🔴' };
  };

  const handleBusinessClick = (businessId: number) => {
    navigate(`/business/${businessId}`);
  };

  const handleViewMore = () => {
    navigate('/verified-businesses');
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4 flex items-center justify-center">
            <Shield className="h-8 w-8 mr-3 text-green-500" />
            Verified Businesses
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            Hand-picked and verified businesses that consistently deliver exceptional experiences.
          </p>
        </div>

        {/* Desktop: 3 cards inline */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 mb-12">
          {verifiedBusinesses.map((business) => {
            const sentiment = getSentimentBadge(business.sentimentScore);
            
            return (
              <div
                key={business.id}
                className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                onClick={() => handleBusinessClick(business.id)}
              >
                <div className="relative h-48">
                  <img
                    src={business.image}
                    alt={business.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Verified Badge */}
                  <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold flex items-center">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified
                  </div>

                  {/* Sentiment Badge */}
                  <div className={`absolute top-4 right-4 ${sentiment.color} text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold`}>
                    {sentiment.emoji} {sentiment.text}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2 group-hover:text-primary-500 transition-colors duration-200">
                    {business.name}
                  </h3>
                  
                  <div className="flex items-center mb-3">
                    <div className="flex items-center text-green-600">
                      <ThumbsUp className="h-4 w-4 mr-1 fill-current" />
                      <span className="font-poppins text-sm font-semibold">
                        {business.thumbsUp}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center text-neutral-600 mb-3">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="font-lora text-sm">{business.location}</span>
                  </div>

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

                  <p className="font-lora text-sm text-neutral-700 leading-relaxed">
                    {business.excerpt}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: 1 card */}
        <div className="md:hidden mb-8">
          {verifiedBusinesses.slice(0, 1).map((business) => {
            const sentiment = getSentimentBadge(business.sentimentScore);
            
            return (
              <div
                key={business.id}
                className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => handleBusinessClick(business.id)}
              >
                <div className="relative h-48">
                  <img
                    src={business.image}
                    alt={business.name}
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold flex items-center">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified
                  </div>

                  <div className={`absolute top-4 right-4 ${sentiment.color} text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold`}>
                    {sentiment.emoji} {sentiment.text}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                    {business.name}
                  </h3>
                  
                  <div className="flex items-center mb-3">
                    <div className="flex items-center text-green-600">
                      <ThumbsUp className="h-4 w-4 mr-1 fill-current" />
                      <span className="font-poppins text-sm font-semibold">
                        {business.thumbsUp}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center text-neutral-600 mb-3">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="font-lora text-sm">{business.location}</span>
                  </div>

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

                  <p className="font-lora text-sm text-neutral-700 leading-relaxed">
                    {business.excerpt}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* View More Button */}
        <div className="text-center">
          <button
            onClick={handleViewMore}
            className="inline-flex items-center font-poppins bg-gradient-to-r from-primary-500 to-accent-500 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200"
          >
            View More
            <ArrowRight className="h-5 w-5 ml-2" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default VerifiedBusinesses;