import React, { useState, useEffect } from 'react';
import { MapPin, Star, Shield, TrendingUp, Clock, Users, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWordPressPosts } from '../hooks/useWordPress';
import { useAnalytics } from '../hooks/useAnalytics';
import type { WordPressPost } from '../types/wordpress';

interface LocationAwareReviewsProps {
  maxDistance?: number; // miles
}

const LocationAwareReviews: React.FC<LocationAwareReviewsProps> = ({ maxDistance = 10 }) => {
  const navigate = useNavigate();
  const [verifiedReviews, setVerifiedReviews] = useState<WordPressPost[]>([]);
  const [popularReviews, setPopularReviews] = useState<WordPressPost[]>([]);
  
  // Lazy load PendingBadgeTooltip component
  const [PendingBadgeTooltip, setPendingBadgeTooltip] = useState<React.ComponentType<any> | null>(null);
  
  // Load PendingBadgeTooltip component lazily
  useEffect(() => import('./PendingBadgeTooltip').then(module => setPendingBadgeTooltip(() => module.default)), []);
  
  const { posts: recentReviews, loading } = useWordPressPosts({ 
    per_page: 12,
    orderby: 'date',
    order: 'desc'
  });

  // Sort verified reviews by location proximity and always show them
  useEffect(() => {
    if (recentReviews.length > 0) {
      const verified = recentReviews.filter(post => post.acf?.is_verified);
      
      // Show all verified reviews by date
      setVerifiedReviews(verified.slice(0, 6));
    }
  }, [recentReviews]);

  // Generate popular reviews (Level 3+ reviewers)
  useEffect(() => {
    if (recentReviews.length > 0) {
      // Filter reviews from high-level reviewers and shuffle
      const highLevelReviews = recentReviews.filter(post => {
        const reviewerLevel = getReviewerLevel(post.author);
        return reviewerLevel >= 3;
      });
      
      // Shuffle array
      const shuffled = [...highLevelReviews].sort(() => Math.random() - 0.5);
      setPopularReviews(shuffled.slice(0, 6));
    }
  }, [recentReviews]);

  // Mock function to get business coordinates (replace with actual data)
  const getBusinessCoordinates = (businessName: string) => {
    const mockCoords: { [key: string]: { lat: number; lng: number } } = {
      'Green Garden Cafe': { lat: 47.6062, lng: -122.3321 }, // Seattle
      'Ocean View Restaurant': { lat: 25.7617, lng: -80.1918 }, // Miami
      'Fresh Market Co-op': { lat: 45.5152, lng: -122.6784 }, // Portland
    };
    return mockCoords[businessName];
  };

  // Mock function to get reviewer level (replace with actual user data)
  const getReviewerLevel = (authorId: number): number => {
    // Mock reviewer levels based on author ID
    const levels: { [key: number]: number } = {
      1: 5, // High level reviewer
      2: 3, // Mid level reviewer
      3: 1, // New reviewer
    };
    return levels[authorId] || 1;
  };

  const handleReviewClick = (slug: string) => {
    navigate(`/post/${slug}`);
  };

  const ReviewCard = ({ review, badge, isNearby }: { review: any; badge?: string; isNearby?: boolean }) => (
    <div 
      className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer"
      onClick={() => handleReviewClick(review.slug)}
    >
      <div className="relative">
        <img
          src={review.image}
          alt={review.businessName}
          className="w-full h-48 object-cover"
        />
        
        {badge && (
          <div className="absolute top-3 left-3 bg-green-500 text-white rounded-full px-3 py-1 flex items-center">
            <Shield className="h-3 w-3 mr-1" />
            <span className="font-poppins text-xs font-bold">{badge}</span>
          </div>
        )}
        
        {isNearby && (
          <div className="absolute top-3 right-3 bg-blue-500 text-white rounded-full px-2 py-1">
            <span className="font-poppins text-xs font-bold">NEARBY</span>
          </div>
        )}
        
        {review.reviewerLevel >= 3 && (
          <div className="absolute bottom-3 right-3 bg-purple-500 text-white rounded-full px-2 py-1">
            <span className="font-poppins text-xs font-bold">L{review.reviewerLevel}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2 hover:text-primary-500 transition-colors duration-200">
          {review.businessName}
        </h3>
        
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center">
            <MapPin className="h-4 w-4 text-neutral-500 mr-1" />
            <span className="font-lora text-sm text-neutral-600">{review.location}</span>
          </div>
          
          <div className="flex items-center">
            <div className="flex text-yellow-400 mr-1">
              {[...Array(review.rating)].map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-current" />
              ))}
            </div>
            <span className="font-poppins text-sm font-semibold text-neutral-700">
              {review.rating}/5
            </span>
          </div>
        </div>

        <p className="font-lora text-neutral-700 text-sm leading-relaxed line-clamp-2">
          {review.excerpt}
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-12">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-8 bg-neutral-200 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(j => (
                <div key={j} className="bg-neutral-200 rounded-2xl h-64"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const formatReview = (post: WordPressPost) => {
    const acf = post.acf;
    const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
    
    return {
      id: post.id,
      title: post.title.rendered,
      slug: post.slug,
      businessName: acf?.business_name || 'Business Name',
      location: acf?.location || 'Location',
      rating: acf?.rating || 5,
      healthScore: acf?.health_score || 95,
      image: featuredImage?.source_url || acf?.business_image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      isVerified: acf?.is_verified === true,
      reviewerLevel: getReviewerLevel(post.author),
      excerpt: post.content.rendered.replace(/<[^>]*>/g, '').substring(0, 120) + '...'
    };
  };

  return (
    <div className="space-y-12">
      {/* Verified Reviews (Always Show, Prioritized by Location) */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-neutral-900 mb-2 flex items-center">
              <Shield className="h-8 w-8 mr-3 text-green-500" />
              Verified Reviews
            </h2>
            <p className="font-lora text-neutral-600">
              All verified reviews from our team visits
            </p>
          </div>
        </div>

        {verifiedReviews.length === 0 ? (
          <div className="bg-neutral-50 rounded-2xl p-8 text-center">
            <Shield className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
              No Verified Reviews Yet
            </h3>
            <p className="font-lora text-neutral-600">
              We haven't completed any verified reviews yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {verifiedReviews.map(post => {
              const review = formatReview(post);
              return (
                <ReviewCard 
                  key={post.id} 
                  review={review} 
                  badge="VERIFIED"
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Reviews */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-neutral-900 flex items-center">
            <Clock className="h-8 w-8 mr-3 text-blue-500" />
            Recent Reviews
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recentReviews.slice(0, 6).map(post => (
            <ReviewCard 
              key={post.id} 
              review={formatReview(post)} 
            />
          ))}
        </div>
      </section>

      {/* Popular Reviews (High-Level Reviewers) */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-neutral-900 mb-2 flex items-center">
              <TrendingUp className="h-8 w-8 mr-3 text-purple-500" />
              Popular Reviews
            </h2>
            <p className="font-lora text-neutral-600">
              From our top-rated reviewers (Level 3+)
            </p>
          </div>
        </div>

        {popularReviews.length === 0 ? (
          <div className="bg-neutral-50 rounded-2xl p-8 text-center">
            <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
              No High-Level Reviews Yet
            </h3>
            <p className="font-lora text-neutral-600">
              Popular reviews from experienced reviewers will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {popularReviews.map(post => (
              <ReviewCard 
                key={post.id} 
                review={formatReview(post)} 
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default LocationAwareReviews;