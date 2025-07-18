import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, Calendar, User, ArrowLeft, Share2, Heart, MessageCircle, Shield, CheckCircle, Image } from 'lucide-react';
import { useWordPressPost } from '../hooks/useWordPress';

const SinglePostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentName, setCommentName] = useState('');
  const [commentEmail, setCommentEmail] = useState('');

  const { post, loading, error } = useWordPressPost(slug || '');
  
  // Lazy load components to reduce initial bundle size
  const [RecommendationButton, setRecommendationButton] = useState<React.ComponentType<any> | null>(null);
  const [InlineImageGallery, setInlineImageGallery] = useState<React.ComponentType<any> | null>(null);

  // Scroll to top when component mounts or slug changes
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Dynamically import components
    import('../components/RecommendationButton').then(module => {
      setRecommendationButton(() => module.default);
    });
    
    import('../components/InlineImageGallery').then(module => {
      setInlineImageGallery(() => module.default);
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading review...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">Review Not Found</h2>
          <p className="text-neutral-600 mb-6">The review you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Parse review data from post content
  const acf = post.acf || {};
  const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
  
  // Extract gallery images from ACF fields - ENSURE WE HAVE DEMO IMAGES
  let galleryImages = [
    acf?.gallery_image_1,
    acf?.gallery_image_2,
    acf?.gallery_image_3,
    acf?.gallery_image_4,
    acf?.gallery_image_5
  ].filter(Boolean); // Remove empty/null values
  
  const reviewData = {
    title: post.title.rendered,
    // Use WordPress content field with proper formatting
    content: post.content.rendered,
    businessName: acf?.business_name || post.title.rendered,
    rating: parseInt(acf?.rating) || 5,
    location: acf?.location || 'Location not specified',
    visitDate: acf?.visit_date || new Date(post.date).toISOString().split('T')[0],
    excerpt: post.excerpt.rendered.replace(/<[^>]*>/g, '').substring(0, 160) + '...',
    verifiedDate: acf?.verified_date || new Date(post.date).toLocaleDateString(),
    isVerified: acf?.is_verified === true,
    galleryImages: galleryImages,
    features: {
      cleanBathrooms: acf?.clean_bathrooms || false,
      driveThru: acf?.drive_thru || false,
      goodForKids: acf?.good_for_kids || false,
      petFriendly: acf?.pet_friendly || false,
      wheelchair: acf?.wheelchair_accessible || false,
      parking: acf?.parking_available || false,
      wifi: acf?.wifi_available || false,
      outdoorSeating: acf?.outdoor_seating || false
    },
    reviewerName: acf?.reviewer_name || 'Anonymous Reviewer',
    reviewerAvatar: acf?.reviewer_avatar || null,
    reviewerLocation: acf?.reviewer_location || null
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title.rendered,
          text: `Check out this review of ${reviewData.businessName}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Back</span>
            </button>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isLiked 
                    ? 'bg-red-50 text-red-600 border border-red-200' 
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                <span className="text-sm font-medium">{likeCount}</span>
              </button>
              
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                <span className="text-sm font-medium">Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <article className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          {/* Featured Image */}
          {post.featured_media_url && (
            <div className="aspect-video w-full overflow-hidden">
              <img
                src={post.featured_media_url}
                alt={post.title.rendered}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-8">
            {/* Business Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                    {reviewData.businessName}
                  </h1>
                  
                  <div className="flex items-center gap-4 text-neutral-600 mb-3">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{reviewData.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">
                        Visited {new Date(reviewData.visitDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {reviewData.isVerified && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200">
                    <Shield className="h-4 w-4" />
                    <span className="text-sm font-medium">Verified Review</span>
                  </div>
                )}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-6 w-6 ${
                        i < reviewData.rating
                          ? 'text-yellow-400 fill-current'
                          : 'text-neutral-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold text-neutral-900">
                  {reviewData.rating}.0
                </span>
                <span className="text-neutral-600">out of 5</span>
              </div>

              {/* Recommendation Button for Unverified Posts */}
              {RecommendationButton && (
                <RecommendationButton
                  postId={post.id}
                  postSlug={post.slug}
                  businessName={reviewData.businessName}
                  isVerified={reviewData.isVerified}
                />
              )}
            </div>

            {/* INLINE GALLERY IMAGES - RIGHT UNDER FEATURED IMAGE */}
            {InlineImageGallery && reviewData.galleryImages.length > 0 && (
              <InlineImageGallery 
                images={reviewData.galleryImages}
                className="mb-8"
              />
            )}

            {/* Review Content */}
            <div className="prose prose-lg max-w-none mb-8">
              <div 
                dangerouslySetInnerHTML={{ __html: post.content.rendered }}
                className="text-neutral-700 leading-relaxed"
              />
            </div>

            {/* Reviewer Info */}
            <div className="border-t border-neutral-200 pt-6 mb-8">
              <div className="flex items-center gap-3">
                {reviewData.reviewerAvatar ? (
                  <img
                    src={reviewData.reviewerAvatar}
                    alt={reviewData.reviewerName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold text-lg">
                      {reviewData.reviewerName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-neutral-900">{reviewData.reviewerName}</h4>
                  <p className="text-sm text-neutral-600">Verified Customer</p>
                </div>
              </div>
            </div>

            {/* Engagement Section */}
            <div className="border-t border-neutral-200 pt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-neutral-900">Community Feedback</h3>
                <button
                  onClick={() => setShowCommentForm(!showCommentForm)}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="font-medium">Add Comment</span>
                </button>
              </div>

              {/* Comment Form */}
              {showCommentForm && (
                <div className="bg-neutral-50 rounded-xl p-6 mb-6">
                  <h4 className="font-semibold text-neutral-900 mb-4">Share your thoughts</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Your name"
                        value={commentName}
                        onChange={(e) => setCommentName(e.target.value)}
                        className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <input
                        type="email"
                        placeholder="Your email"
                        value={commentEmail}
                        onChange={(e) => setCommentEmail(e.target.value)}
                        className="px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <textarea
                      placeholder="Write your comment..."
                      rows={4}
                      className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <button className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition-colors font-medium">
                        Post Comment
                      </button>
                      <button
                        onClick={() => setShowCommentForm(false)}
                        className="text-neutral-600 hover:text-neutral-900 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Comments */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                  <div className="flex items-start gap-4">
                    <img
                      src="https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100"
                      alt="Sarah M."
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="font-poppins font-semibold text-neutral-900">Sarah M.</h5>
                        <span className="text-sm text-neutral-500">2 days ago</span>
                      </div>
                      <p className="text-neutral-700 leading-relaxed">
                        Great review! I had a similar experience at this place. The service was exceptional and the atmosphere was perfect for a date night.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                  <div className="flex items-start gap-4">
                    <img
                      src="https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100"
                      alt="Mike R."
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="font-poppins font-semibold text-neutral-900">Mike R.</h5>
                        <span className="text-sm text-neutral-500">1 week ago</span>
                      </div>
                      <p className="text-neutral-700 leading-relaxed">
                        Thanks for the detailed review! I've been looking for a good place like this in the area. Definitely going to check it out this weekend.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
};

export default SinglePostPage;