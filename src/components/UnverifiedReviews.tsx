import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, MapPin, Clock, Eye, ArrowRight, Shield } from 'lucide-react';
import { useWordPressPosts } from '../hooks/useWordPress';
import { useAnalytics } from '../hooks/useAnalytics';
import type { WordPressPost } from '../types/wordpress';

const UnverifiedReviews = () => {
  const navigate = useNavigate();
  const { posts, loading, error } = useWordPressPosts({ 
    per_page: 8,
    orderby: 'date',
    order: 'desc'
  });
  const { trackReviewView } = useAnalytics();
  
  // Lazy load PendingBadgeTooltip component
  const [PendingBadgeTooltip, setPendingBadgeTooltip] = React.useState<React.ComponentType<any> | null>(null);
  
  React.useEffect(() => import('./PendingBadgeTooltip').then(module => setPendingBadgeTooltip(() => module.default)), []);

  const formatWordPressReview = (post: WordPressPost) => {
    const acf = post.acf;
    const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
    
    // Create a very short excerpt from WordPress content (not ACF field) for the feed (1-2 lines max)
    const wordpressContent = post.content.rendered.replace(/<[^>]*>/g, '') || 'Review content coming soon...';
    const shortExcerpt = wordpressContent.length > 80 ? wordpressContent.substring(0, 80) + '...' : wordpressContent;
    
    return {
      id: post.id,
      slug: post.slug,
      name: acf?.business_name || post.title.rendered.replace(' Review', '').replace(' - ', ' - '),
      category: acf?.category || 'General',
      rating: acf?.rating || 4,
      image: featuredImage?.source_url || acf?.business_image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      healthScore: acf?.health_score || 85,
      location: acf?.location || 'Location TBD',
      excerpt: shortExcerpt, // Very short excerpt from WordPress content for compact display
      verifiedDate: acf?.verified_date || new Date(post.date).toLocaleDateString(),
      isVerified: acf?.is_verified === true,
      link: post.link
    };
  };

  const handleReviewView = (review: any) => {
    trackReviewView(review.id.toString(), review.name, review.category);
    navigate(`/post/${review.slug}`);
  };

  const handleViewAllReviews = () => {
    navigate('/blog');
  };

  if (loading) {
    return (
      <section className="py-12 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-neutral-900 mb-4">
              Recent Reviews
            </h2>
            <p className="font-lora text-neutral-600">
              Loading recent reviews...
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl h-64 animate-pulse"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || posts.length === 0) {
    return null; // Don't show this section if no posts or error
  }

  // Show ALL recent reviews (both verified and unverified)
  const allRecentReviews = posts
    .map(formatWordPressReview)
    .slice(0, 8); // Show up to 8 recent reviews

  // If no reviews at all, don't show the section
  if (allRecentReviews.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-neutral-900 mb-4">
            Recent Reviews
          </h2>
          <p className="font-lora text-neutral-600">
            Latest experiences and reviews from our community
          </p>
        </div>

        {/* All Recent Reviews Grid - Compact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {allRecentReviews.map((review, index) => (
            <div
              key={review.id}
              className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group"
              onClick={() => handleReviewView(review)}
            >
              <div className="relative">
                <img
                  src={review.image}
                  alt={review.name}
                  className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  {review.isVerified ? (
                    <div className="bg-green-500 text-white rounded-full px-3 py-1 flex items-center">
                      <Shield className="h-3 w-3 mr-1" />
                      <span className="font-poppins text-xs font-bold">VERIFIED</span>
                    </div>
                  ) : PendingBadgeTooltip ? (
                    <PendingBadgeTooltip
                      postId={review.id}
                      postSlug={review.slug}
                      businessName={review.name}
                    />
                  ) : (
                    <div className="bg-yellow-500 text-white rounded-full px-3 py-1 flex items-center">
                      <span className="font-poppins text-xs font-bold">PENDING</span>
                    </div>
                  )}
                </div>

                {/* Rating */}
                <div className="absolute top-3 right-3 bg-white bg-opacity-90 rounded-full px-2 py-1 flex items-center">
                  <Star className="h-3 w-3 text-yellow-400 fill-current mr-1" />
                  <span className="font-poppins text-xs font-bold text-neutral-700">
                    {review.rating}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-2">
                  <span className="font-poppins text-xs text-primary-500 font-semibold uppercase tracking-wide">
                    {review.category.replace('-', ' ')}
                  </span>
                </div>

                <h3 className="font-poppins text-sm font-semibold text-neutral-900 mb-1 line-clamp-1 group-hover:text-primary-500 transition-colors duration-200">
                  {review.name}
                </h3>

                <div className="flex items-center text-neutral-500 mb-2">
                  <MapPin className="h-3 w-3 mr-1" />
                  <span className="font-lora text-xs truncate">{review.location}</span>
                </div>

                {/* Very Short Excerpt from WordPress Content - Only 1-2 lines */}
                <p className="font-lora text-xs text-neutral-600 leading-relaxed line-clamp-2 mb-3">
                  {review.excerpt}
                </p>

                {/* Read More Link */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center text-neutral-400">
                    <Clock className="h-3 w-3 mr-1" />
                    <span className="font-lora">{review.verifiedDate}</span>
                  </div>
                  <div className="flex items-center text-primary-500 font-poppins font-semibold group-hover:text-primary-600 transition-colors duration-200">
                    <span>Read More</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View More Button */}
        <div className="text-center mt-8">
          <button 
            onClick={handleViewAllReviews}
            className="font-poppins bg-neutral-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-neutral-700 transition-colors duration-200 text-sm flex items-center mx-auto"
          >
            View All Reviews
            <ArrowRight className="h-4 w-4 ml-2" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default UnverifiedReviews;