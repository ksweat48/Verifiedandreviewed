import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useWordPressPosts } from '../hooks/useWordPress';
import { useAnalytics } from '../hooks/useAnalytics';
import type { WordPressPost } from '../types/wordpress';

const WordPressFeaturedReviews = () => {
  const navigate = useNavigate();
  const [showSocialCard, setShowSocialCard] = useState<number | null>(null);
  const [showConnectionTest, setShowConnectionTest] = useState(false);
  const [components, setComponents] = useState<{
    SocialShareButtons: React.ComponentType<any> | null;
    HealthScoreBadge: React.ComponentType<any> | null;
    WordPressConnectionTest: React.ComponentType<any> | null;
  }>({
    SocialShareButtons: null,
    HealthScoreBadge: null,
    WordPressConnectionTest: null
  });
  
  const { posts, loading, error } = useWordPressPosts({ 
    per_page: 10,
    orderby: 'date',
    order: 'desc'
  });
  const { trackReviewView, trackSocialShare } = useAnalytics();
  
  // Lazy load components
  React.useEffect(() => {
    const loadComponents = async () => {
      const [SocialShareButtons, HealthScoreBadge, WordPressConnectionTest] = await Promise.all([
        import('./SocialShareButtons').then(module => module.default),
        import('./HealthScoreBadge').then(module => module.default),
        import('./WordPressConnectionTest').then(module => module.default)
      ]);
      
      setComponents({
        SocialShareButtons,
        HealthScoreBadge,
        WordPressConnectionTest
      });
    };
    
    loadComponents();
  }, []);

  const formatWordPressReview = (post: WordPressPost) => {
    const acf = post.acf;
    const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
    
    // Create excerpt from WordPress content (not ACF field) for feed display
    const wordpressContent = post.content.rendered.replace(/<[^>]*>/g, '') || 'Review content coming soon...';
    const shortExcerpt = wordpressContent.length > 120 ? wordpressContent.substring(0, 120) + '...' : wordpressContent;
    
    return {
      id: post.id,
      slug: post.slug,
      name: acf?.business_name || post.title.rendered.replace(' Review', '').replace(' - ', ' - '),
      category: acf?.category || 'General',
      rating: acf?.rating || 5,
      image: featuredImage?.source_url || acf?.business_image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      healthScore: acf?.health_score || 95,
      location: acf?.location || 'Location TBD',
      excerpt: shortExcerpt, // Short excerpt from WordPress content for feed
      fullContent: post.content.rendered, // Full WordPress content for single post
      features: acf?.features || [],
      verifiedDate: acf?.verified_date || new Date(post.date).toLocaleDateString(),
      isVerified: acf?.is_verified === true,
      link: post.link
    };
  };

  const handleReviewView = (review: any) => {
    trackReviewView(review.id.toString(), review.name, review.category);
    navigate(`/post/${review.slug}`);
  };

  const handleSocialShare = (platform: string, review: any) => {
    trackSocialShare(platform, 'review', review.id.toString());
  };

  const handleViewAllVerified = () => {
    navigate('/blog');
  };

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
          
          <div className="bg-gradient-to-br from-primary-500 to-accent-500 p-6 rounded-2xl text-white mb-6 aspect-square flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-6 left-6 right-6">
              <img 
                src={review.image} 
                alt={review.name}
                className="w-full h-32 object-cover rounded-xl shadow-lg"
              />
            </div>
            
            <div className="relative z-10 mt-36">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <img 
                    src="/verified and reviewed logo-coral copy copy.png" 
                    alt="Verified & Reviewed" 
                    className="h-6 w-6 mr-2 rounded-full bg-white p-1"
                  />
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
                "{review.excerpt.substring(0, 60)}..."
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex text-yellow-300">
                  {[...Array(review.rating)].map((_, i) => (
                    <Icons.Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
                <div className="font-lora text-xs opacity-90">{review.location}</div>
              </div>
            </div>
          </div>
          
          <SocialShareButtons 
            review={review}
            onShare={(platform) => handleSocialShare(platform, review)}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
              Verified Reviews
            </h2>
            <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
              Loading latest reviews from WordPress...
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-100 rounded-2xl h-96 animate-pulse"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
              Verified Reviews
            </h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center mb-4">
                <Icons.AlertCircle className="h-7 w-7 text-yellow-600 mr-3" />
                <h3 className="font-poppins text-lg font-semibold text-yellow-800">
                  CMS Connection Issue
                </h3>
              </div>
              <p className="font-lora text-yellow-700 mb-4">
                Unable to load reviews from WordPress. Showing demo content instead.
              </p>
              <p className="font-lora text-sm text-yellow-600 mb-4">
                Error: {error}
              </p>
              <button
                onClick={() => setShowConnectionTest(!showConnectionTest)}
                className="font-poppins bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition-colors duration-200"
              >
                {showConnectionTest ? 'Hide' : 'Test'} WordPress Connection
              </button>
            </div>
          </div>
          
          {showConnectionTest && (
            components.WordPressConnectionTest && (
              <div className="mt-8">
                <components.WordPressConnectionTest />
              </div>
            )
          )}
        </div>
      </section>
    );
  }

  // Separate verified and unverified reviews
  const allFormattedReviews = posts.map(formatWordPressReview);
  const verifiedReviews = allFormattedReviews.filter(review => review.isVerified).slice(0, 3);
  const hasVerifiedReviews = verifiedReviews.length > 0;

  // If no verified reviews, show all recent reviews
  const reviewsToShow = hasVerifiedReviews ? verifiedReviews : allFormattedReviews.slice(0, 3);

  if (reviewsToShow.length === 0) {
    return (
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Shield className="h-8 w-8 text-neutral-400" />
            </div>
            <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
              Verified Reviews
            </h2>
            <p className="font-lora text-neutral-600 mb-6">
              No reviews found. Add some review posts in WordPress to see them here!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowConnectionTest(!showConnectionTest)}
                className="inline-flex items-center font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
              >
                <Icons.AlertCircle className="h-4 w-4 mr-2" />
                Test WordPress Connection
              </button>
              
              <a 
                href="https://cms.verifiedandreviewed.com/wp-admin/post-new.php"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-poppins border border-neutral-300 text-neutral-700 px-6 py-3 rounded-lg font-semibold hover:border-primary-500 hover:text-primary-500 transition-colors duration-200"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Add Review in WordPress
              </a>
            </div>
            
            {showConnectionTest && (
              <div className="mt-8">
                <WordPressConnectionTest />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            {hasVerifiedReviews ? 'Verified Reviews' : 'Latest Reviews'}
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            {hasVerifiedReviews 
              ? 'Discover our most recent verified experiences and honest reviews from real visits.'
              : 'Latest reviews from our WordPress CMS, including both verified and pending reviews.'
            }
          </p>
          
          {!hasVerifiedReviews && (
            <div className="mt-4 inline-flex items-center bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg">
              <Icons.AlertCircle className="h-4 w-4 mr-2" />
              <span className="font-lora text-sm">
                No verified reviews yet. Mark reviews as verified in WordPress to feature them here.
              </span>
            </div>
          )}
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {reviewsToShow.map((review, index) => (
            <div
              key={review.id}
              className="bg-white border border-neutral-200 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
              onClick={() => handleReviewView(review)}
            >
              <div className="relative">
                <img
                  src={review.image}
                  alt={review.name}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  {review.isVerified ? (
                    <div className="bg-green-500 text-white rounded-full px-2 py-1 flex items-center shadow-lg">
                      <Icons.Shield className="h-3 w-3 mr-1" />
                      <span className="font-poppins text-xs font-bold">VERIFIED</span>
                    </div>
                  ) : (
                    <div className="bg-yellow-500 text-white rounded-full px-3 py-1 flex items-center shadow-lg">
                      <span className="font-poppins text-sm font-bold">PENDING</span>
                    </div>
                  )}
                </div>
                
                {/* Health Score Badge - ONLY for verified posts */}
                {review.isVerified && (
                  components.HealthScoreBadge && (
                    <div className="absolute bottom-4 left-4">
                      <components.HealthScoreBadge score={review.healthScore} size="md" />
                    </div>
                  )
                )}
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-poppins text-sm text-primary-500 font-semibold uppercase tracking-wide">
                    {review.category.replace('-', ' ')}
                  </span>
                  <div className="flex items-center">
                    {[...Array(review.rating)].map((_, i) => (
                      <Icons.Star key={i} className="h-3 w-3 text-yellow-400 fill-current mr-1" />
                    ))}
                    <span className="font-poppins text-xs font-bold text-neutral-700">
                      {review.rating}
                    </span>
                  </div>
                </div>

                <h3 className="font-cinzel text-xl font-semibold text-neutral-900 mb-2 group-hover:text-primary-500 transition-colors duration-200">
                  {review.name}
                </h3>

                <div className="flex items-center text-neutral-600 mb-3">
                  <Icons.MapPin className="h-4 w-4 mr-1" />
                  <span className="font-lora text-sm">{review.location}</span>
                </div>

                {/* Short Excerpt from WordPress Content - Only 2-3 lines */}
                <p className="font-lora text-neutral-700 text-sm leading-relaxed mb-3 line-clamp-2">
                  {review.excerpt}
                </p>

                {/* Read More Link */}
                <div className="mb-4">
                  <span className="font-poppins text-primary-500 font-semibold hover:text-primary-600 transition-colors duration-200 text-sm cursor-pointer">
                    View Review →
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {review.features.slice(0, 2).map((feature: string) => (
                    <span
                      key={feature}
                      className="font-lora bg-neutral-50 border border-neutral-200 text-neutral-700 px-2 py-1 rounded-full text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                  {review.features.length > 2 && (
                    <span className="font-lora bg-neutral-50 border border-neutral-200 text-neutral-500 px-2 py-1 rounded-full text-xs">
                      +{review.features.length - 2} more
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-500 pt-3 border-t border-neutral-100">
                  <span className="font-lora">
                    {review.isVerified ? 'Verified' : 'Posted'} {review.verifiedDate}
                  </span>
                  <div className="flex items-center">
                    <Icons.Share2 className="h-3 w-3 mr-1" />
                    <span className="font-poppins">Share</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button 
            onClick={handleViewAllVerified}
            className="font-poppins bg-primary-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            View All Reviews
          </button>
        </div>
      </div>

      {/* Social card modal */}
      {showSocialCard && components.SocialShareButtons && generateSocialCard(reviewsToShow.find(r => r.id === showSocialCard))}
    </section>
  );
};

export default WordPressFeaturedReviews;