import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, ArrowRight, TrendingUp, Award, ThumbsUp } from 'lucide-react';
import { mockPopularReviews } from '../data/mockData';

const PopularReviews = () => {
  const navigate = useNavigate();

  const popularReviews = mockPopularReviews;

  const getLevelBadge = (level: number) => {
    const levels = {
      1: { name: 'New', color: 'bg-gray-100 text-gray-700' },
      2: { name: 'Regular', color: 'bg-blue-100 text-blue-700' },
      3: { name: 'Trusted', color: 'bg-green-100 text-green-700' },
      4: { name: 'Expert', color: 'bg-purple-100 text-purple-700' },
      5: { name: 'Master', color: 'bg-yellow-100 text-yellow-700' }
    };
    
    return levels[level as keyof typeof levels] || levels[1];
  };

  const getSentimentBadge = (score: number) => {
    if (score >= 80) return { color: 'bg-green-500', text: 'Great', emoji: '🟢' };
    if (score >= 70 && score < 80) return { color: 'bg-blue-500', text: 'Good', emoji: '🔵' };
    if (score >= 65 && score < 70) return { color: 'bg-yellow-500', text: 'Fair', emoji: '🟡' };
    return { color: 'bg-red-500', text: 'Improve', emoji: '🔴' };
  };

  const handleReviewClick = (reviewId: number) => {
    navigate(`/review/${reviewId}`);
  };

  const handleViewMore = () => {
    navigate('/popular-reviews');
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4 flex items-center justify-center">
            <TrendingUp className="h-8 w-8 mr-3 text-primary-500" />
            Popular Reviews
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            Top-rated reviews from our most experienced reviewers, featuring the best experiences in your area.
          </p>
        </div>

        {/* Desktop: 3 cards inline */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 mb-12">
          {popularReviews.map((review) => {
            const levelBadge = getLevelBadge(review.reviewer.level);
            const sentiment = getSentimentBadge(review.sentimentScore);
            
            return (
              <div
                key={review.id}
                className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                onClick={() => handleReviewClick(review.id)}
              >
                <div className="relative h-48">
                  <img
                    src={review.businessImage}
                    alt={review.businessName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Popular Badge */}
                  <div className="absolute top-4 left-4 bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Popular
                  </div>

                  {/* Sentiment Badge */}
                  <div className={`absolute top-4 right-4 ${sentiment.color} text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold`}>
                    {sentiment.emoji} {sentiment.text}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2 group-hover:text-primary-500 transition-colors duration-200">
                    {review.businessName}
                  </h3>
                  
                  <div className="flex items-center text-neutral-600 mb-4">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="font-lora text-sm">{review.location}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {review.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-poppins"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="font-lora text-sm text-neutral-700 leading-relaxed mb-4 line-clamp-3">
                    "{review.reviewText}"
                  </p>

                  {/* Thumbs Up Count */}
                  <div className="flex items-center mb-4">
                    <div className="flex items-center text-green-600">
                      <ThumbsUp className="h-4 w-4 mr-1 fill-current" />
                      <span className="font-poppins text-sm font-semibold">
                        {review.thumbsUp}
                      </span>
                    </div>
                  </div>

                  {/* Reviewer Info */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <div className="flex items-center">
                      <img
                        src={review.reviewer.avatar}
                        alt={`${review.reviewer.name} profile`}
                        className="w-8 h-8 rounded-full object-cover mr-3"
                      />
                      <div>
                        <div className="font-poppins text-sm font-semibold text-neutral-900 flex items-center">
                          {review.reviewer.name}
                          {review.reviewer.level >= 4 && (
                            <Award className="h-3 w-3 ml-1 text-yellow-500" />
                          )}
                        </div>
                        <div className={`${levelBadge.color} px-2 py-1 rounded-full text-xs font-poppins font-semibold inline-block`}>
                          {levelBadge.name} • {review.reviewer.reviewCount} reviews
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-neutral-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="font-lora text-xs">{review.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: 1 card */}
        <div className="md:hidden mb-8">
          {popularReviews.slice(0, 1).map((review) => {
            const levelBadge = getLevelBadge(review.reviewer.level);
            const sentiment = getSentimentBadge(review.sentimentScore);
            
            return (
              <div
                key={review.id}
                className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => handleReviewClick(review.id)}
              >
                <div className="relative h-48">
                  <img
                    src={review.businessImage}
                    alt={review.businessName}
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute top-4 left-4 bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Popular
                  </div>

                  <div className={`absolute top-4 right-4 ${sentiment.color} text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold`}>
                    {sentiment.emoji} {sentiment.text}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-2">
                    {review.businessName}
                  </h3>
                  
                  <div className="flex items-center text-neutral-600 mb-4">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span className="font-lora text-sm">{review.location}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {review.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-poppins"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="font-lora text-sm text-neutral-700 leading-relaxed mb-4">
                    "{review.reviewText}"
                  </p>

                  {/* Thumbs Up Count */}
                  <div className="flex items-center mb-4">
                    <div className="flex items-center text-green-600">
                      <ThumbsUp className="h-4 w-4 mr-1 fill-current" />
                      <span className="font-poppins text-sm font-semibold">
                        {review.thumbsUp}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <div className="flex items-center">
                      <img
                        src={review.reviewer.avatar}
                        alt={`${review.reviewer.name} profile`}
                        className="w-8 h-8 rounded-full object-cover mr-3"
                      />
                      <div>
                        <div className="font-poppins text-sm font-semibold text-neutral-900 flex items-center">
                          {review.reviewer.name}
                          {review.reviewer.level >= 4 && (
                            <Award className="h-3 w-3 ml-1 text-yellow-500" />
                          )}
                        </div>
                        <div className={`${levelBadge.color} px-2 py-1 rounded-full text-xs font-poppins font-semibold inline-block`}>
                          {levelBadge.name} • {review.reviewer.reviewCount} reviews
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-neutral-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="font-lora text-xs">{review.date}</span>
                    </div>
                  </div>
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

export default PopularReviews;