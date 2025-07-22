import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, Calendar, User, ArrowLeft, Share2, Heart, MessageCircle, Shield, CheckCircle, Image } from 'lucide-react';
import { useWordPressPost } from '../hooks/useWordPress';
import { ReviewService } from '../services/reviewService';

const InlineImageGallery = React.lazy(() => import('../components/InlineImageGallery'));

const SinglePostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [commentName, setCommentName] = useState('');
  const [commentEmail, setCommentEmail] = useState('');
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  const { post, loading, error } = useWordPressPost(slug || '');

  // Scroll to top when component mounts or slug changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Fetch user reviews for this business
  useEffect(() => {
    const fetchUserReviews = async () => {
      if (!post || !post.acf?.business_name) return;
      
      setLoadingReviews(true);
      try {
        // For now, we'll use a simple approach - in a full implementation,
        // you'd need to map WordPress posts to Supabase businesses
        // This is a placeholder that shows the structure
        const reviews = await ReviewService.getBusinessReviews('placeholder-business-id');
        setUserReviews(reviews);
      } catch (error) {
        console.error('Error fetching user reviews:', error);
        setUserReviews([]);
      } finally {
        setLoadingReviews(false);
      }
    };
    
    fetchUserReviews();
  }, [post]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-neutral-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3">
                <div className="h-64 bg-neutral-200 rounded-2xl mb-6"></div>
                <div className="space-y-4">
                  <div className="h-8 bg-neutral-200 rounded w-3/4"></div>
                  <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
                  <div className="h-4 bg-neutral-200 rounded w-full"></div>
                  <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="h-48 bg-neutral-200 rounded-2xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
            Review Not Found
          </h1>
          <p className="font-lora text-neutral-600 mb-6">
            The review you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/blog')}
            className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            Back to Reviews
          </button>
        </div>
      </div>
    );
  }

  const acf = post.acf;
  const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
  
  // Extract gallery images from ACF fields - ENSURE WE HAVE DEMO IMAGES
  const galleryImages = [
    acf?.gallery_image_1,
    acf?.gallery_image_2,
    acf?.gallery_image_3,
    acf?.gallery_image_4,
    acf?.gallery_image_5
  ].filter(Boolean); // Remove empty/null values
  
  // If no gallery images from ACF, use demo images for testing
  // Use gallery images from ACF if available, otherwise use demo images
  const finalGalleryImages = galleryImages;
  
  const reviewData = {
    title: post.title.rendered,
    // Use WordPress content field with proper formatting
    content: post.content.rendered,
    date: new Date(post.date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    featuredImage: featuredImage?.source_url || acf?.business_image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
    businessName: acf?.business_name || post.title.rendered.replace(' Review', ''),
    location: acf?.location || 'Location',
    rating: acf?.rating || 5,
    healthScore: acf?.health_score || 95,
    category: acf?.category || 'general',
    isVerified: acf?.is_verified === true,
    // Create excerpt from WordPress content for meta/sharing
    excerpt: post.excerpt.rendered.replace(/<[^>]*>/g, '').substring(0, 160) + '...',
    verifiedDate: acf?.verified_date || new Date(post.date).toLocaleDateString(),
    galleryImages: finalGalleryImages,
    features: {
      cleanBathrooms: acf?.clean_bathrooms || false,
      driveThru: acf?.drive_thru || false,
      blackOwned: acf?.black_owned || false,
      womenOwned: acf?.women_owned || false,
      veteranOwned: acf?.veteran_owned || false,
      veganOptions: acf?.vegan_options || false
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle comment submission here
    alert('Comment submitted! (This is a demo - comments would be saved to WordPress)');
    setComment('');
    setCommentName('');
    setCommentEmail('');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: reviewData.title,
        text: `Check out this review of ${reviewData.businessName}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Back Button */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center font-lora text-neutral-600 hover:text-primary-500 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reviews
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Article */}
          <article className="lg:col-span-3">
            {/* Featured Image */}
            <div className="relative mb-6">
              <img
                src={reviewData.featuredImage}
                alt={reviewData.businessName}
                className="w-full h-64 md:h-96 object-cover rounded-2xl"
              />
              
              {/* Verification Badge */}
              {reviewData.isVerified && (
                <div className="absolute top-6 right-6 bg-green-500 text-white rounded-full px-4 py-2 flex items-center shadow-lg">
                  <Shield className="h-5 w-5 mr-2" />
                  <span className="font-poppins text-sm font-bold">VERIFIED</span>
                </div>
              )}

              {/* Health Score Badge - ONLY for verified posts */}
              {reviewData.isVerified && (
                <div className="absolute bottom-6 left-6 bg-white rounded-full px-4 py-2 shadow-lg">
                  <span className="font-poppins text-lg font-bold text-primary-500">
                    Health Score: {reviewData.healthScore}
                  </span>
                </div>
              )}
            </div>

            {/* INLINE GALLERY IMAGES - RIGHT UNDER FEATURED IMAGE */}
            <React.Suspense fallback={<div className="h-32 bg-neutral-100 rounded-lg animate-pulse mb-8"></div>}>
              {reviewData.galleryImages.length > 0 && (
                <InlineImageGallery 
                  images={reviewData.galleryImages}
                  className="mb-8"
                />
              )}
            </React.Suspense>

            {/* Article Header */}
            <header className="mb-8">
              <h1 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
                {reviewData.businessName}
              </h1>
              
              <div className="flex flex-wrap items-center gap-6 mb-6">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-neutral-500 mr-2" />
                  <span className="font-lora text-neutral-600">{reviewData.location}</span>
                </div>
                
                <div className="flex items-center">
                  <div className="flex text-yellow-400 mr-2">
                    {[...Array(reviewData.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-current" />
                    ))}
                  </div>
                  <span className="font-poppins font-semibold text-neutral-700">
                    {reviewData.rating}/5
                  </span>
                </div>

                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-neutral-500 mr-2" />
                  <span className="font-lora text-neutral-600">{reviewData.date}</span>
                </div>

                {/* Gallery Image Count Badge */}
                {reviewData.galleryImages.length > 0 && (
                  <div className="flex items-center">
                    <Image className="h-5 w-5 text-primary-500 mr-2" />
                    <span className="font-lora text-neutral-600">
                      {reviewData.galleryImages.length} gallery images
                    </span>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2 mb-6">
                {Object.entries(reviewData.features).map(([key, value]) => {
                  if (!value) return null;
                  const featureNames: { [key: string]: string } = {
                    cleanBathrooms: 'Clean Bathrooms',
                    driveThru: 'Drive-thru',
                    blackOwned: 'Black-owned',
                    womenOwned: 'Women-owned',
                    veteranOwned: 'Veteran-owned',
                    veganOptions: 'Vegan Options'
                  };
                  
                  return (
                    <span
                      key={key}
                      className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-lora flex items-center"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {featureNames[key]}
                    </span>
                  );
                })}
              </div>

              {/* Share Button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleShare}
                  className="flex items-center font-poppins bg-neutral-100 text-neutral-700 px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors duration-200"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Review
                </button>
                
                <button className="flex items-center font-poppins text-neutral-600 hover:text-red-500 transition-colors duration-200">
                  <Heart className="h-4 w-4 mr-2" />
                  Save
                </button>
              </div>
            </header>

            {/* Article Content - WordPress Content with Full Formatting and Proper Typography */}
            <div className="wordpress-content mb-12">
              <div 
                dangerouslySetInnerHTML={{ __html: reviewData.content }}
              />
            </div>

            {/* Comments Section */}
            <section className="border-t border-neutral-200 pt-12">
              <div className="space-y-8">
                {/* User Reviews Section */}
                <div>
                  <h3 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6 flex items-center">
                    <Star className="h-6 w-6 mr-3 text-yellow-500" />
                    User Reviews
                  </h3>
                  
                  {loadingReviews ? (
                    <div className="space-y-4">
                      {[1, 2].map(i => (
                        <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 animate-pulse">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-neutral-200 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-neutral-200 rounded w-1/4"></div>
                              <div className="h-4 bg-neutral-200 rounded w-full"></div>
                              <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : userReviews.length > 0 ? (
                    <div className="space-y-6">
                      {userReviews.map((review) => (
                        <div key={review.id} className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                          <div className="flex items-start gap-4">
                            <img
                              src={review.profiles?.avatar_url || 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100'}
                              alt={review.profiles?.name || 'Anonymous'}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h5 className="font-poppins font-semibold text-neutral-900">
                                  {review.profiles?.name || 'Anonymous'}
                                </h5>
                                <div className="flex items-center">
                                  <div className="flex text-yellow-400 mr-2">
                                    {[...Array(review.rating)].map((_, i) => (
                                      <Star key={i} className="h-4 w-4 fill-current" />
                                    ))}
                                  </div>
                                  <span className="font-poppins text-sm font-semibold text-neutral-700">
                                    {review.rating}/5
                                  </span>
                                </div>
                                <span className="text-sm text-neutral-500">
                                  {new Date(review.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="font-lora text-neutral-700 leading-relaxed mb-3">
                                {review.review_text}
                              </p>
                              
                              {/* Review Images */}
                              {review.image_urls && review.image_urls.length > 0 && (
                                <div className="flex gap-2 mt-3">
                                  {review.image_urls.slice(0, 3).map((imageUrl: string, index: number) => (
                                    <img
                                      key={index}
                                      src={imageUrl}
                                      alt={`Review image ${index + 1}`}
                                      className="w-16 h-16 object-cover rounded-lg"
                                    />
                                  ))}
                                  {review.image_urls.length > 3 && (
                                    <div className="w-16 h-16 bg-neutral-100 rounded-lg flex items-center justify-center">
                                      <span className="font-poppins text-xs text-neutral-600">
                                        +{review.image_urls.length - 3}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-neutral-50 rounded-2xl p-8 text-center">
                      <Star className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                      <h4 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                        No User Reviews Yet
                      </h4>
                      <p className="font-lora text-neutral-600">
                        Be the first to leave a review for this business!
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Comments Section */}
                <div>
                  <h3 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6 flex items-center">
                    <MessageCircle className="h-6 w-6 mr-3" />
                    Comments
                  </h3>

                  {/* Comment Form */}
                  <form onSubmit={handleCommentSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 mb-8">
                    <h4 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                      Leave a Comment
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input
                        type="text"
                        value={commentName}
                        onChange={(e) => setCommentName(e.target.value)}
                        placeholder="Your Name"
                        required
                        className="px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <input
                        type="email"
                        value={commentEmail}
                        onChange={(e) => setCommentEmail(e.target.value)}
                        placeholder="Your Email"
                        required
                        className="px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your thoughts about this review..."
                      required
                      rows={4}
                      className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
                    />
                    
                    <button
                      type="submit"
                      className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                    >
                      Post Comment
                    </button>
                  </form>

                  {/* Sample Comments */}
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-primary-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="font-poppins font-semibold text-neutral-900">Sarah M.</h5>
                            <span className="font-lora text-sm text-neutral-500">2 days ago</span>
                          </div>
                          <p className="font-lora text-neutral-700 leading-relaxed">
                            Great review! I visited this place last week and had a similar experience. 
                            The cleanliness standards really are impressive, and the staff was very helpful.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-accent-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="font-poppins font-semibold text-neutral-900">Mike R.</h5>
                            <span className="font-lora text-sm text-neutral-500">1 week ago</span>
                          </div>
                          <p className="font-lora text-neutral-700 leading-relaxed">
                            Thanks for the honest review! The health score system is really helpful 
                            for making decisions about where to eat.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Review Summary */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                  Review Summary
                </h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-lora text-neutral-600">Overall Rating</span>
                    <div className="flex items-center">
                      <div className="flex text-yellow-400 mr-2">
                        {[...Array(reviewData.rating)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <span className="font-poppins font-semibold">{reviewData.rating}/5</span>
                    </div>
                  </div>
                  
                  {/* Health Score - ONLY for verified posts */}
                  {reviewData.isVerified && (
                    <div className="flex justify-between items-center">
                      <span className="font-lora text-neutral-600">Health Score</span>
                      <span className="font-poppins font-semibold text-primary-500">
                        {reviewData.healthScore}/100
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="font-lora text-neutral-600">Verified</span>
                    <span className={`font-poppins font-semibold ${reviewData.isVerified ? 'text-green-500' : 'text-neutral-500'}`}>
                      {reviewData.isVerified ? 'Yes' : 'No'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-lora text-neutral-600">Visit Date</span>
                    <span className="font-poppins text-neutral-700">
                      {reviewData.verifiedDate}
                    </span>
                  </div>

                  {/* Gallery Count */}
                  {reviewData.galleryImages.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="font-lora text-neutral-600">Photos</span>
                      <span className="font-poppins text-neutral-700">
                        {reviewData.galleryImages.length + 1} images
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Gallery Images Preview */}
              {reviewData.galleryImages.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                  <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                    <Image className="h-5 w-5 mr-2 text-primary-500" />
                    Gallery Images
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {reviewData.galleryImages.slice(0, 4).map((image, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                        <img 
                          src={image} 
                          alt={`Gallery ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                    {reviewData.galleryImages.length > 4 && (
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-neutral-100 flex items-center justify-center">
                        <span className="font-poppins text-sm font-semibold text-neutral-600">+{reviewData.galleryImages.length - 4}</span>
                      </div>
                    )}
                  </div>
                  <p className="font-lora text-xs text-neutral-500 mt-3 text-center">
                    Scroll up to see the full gallery
                  </p>
                </div>
              )}

              {/* Related Reviews */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                  Related Reviews
                </h3>
                <div className="space-y-4">
                  <div className="cursor-pointer group">
                    <h4 className="font-lora font-medium text-neutral-900 group-hover:text-primary-500 transition-colors duration-200 mb-1">
                      Ocean View Restaurant
                    </h4>
                    <p className="font-lora text-xs text-neutral-600">
                      Miami Beach, FL • 5/5 stars
                    </p>
                  </div>
                  <div className="cursor-pointer group">
                    <h4 className="font-lora font-medium text-neutral-900 group-hover:text-primary-500 transition-colors duration-200 mb-1">
                      Fresh Market Co-op
                    </h4>
                    <p className="font-lora text-xs text-neutral-600">
                      Portland, OR • 4/5 stars
                    </p>
                  </div>
                  <div className="cursor-pointer group">
                    <h4 className="font-lora font-medium text-neutral-900 group-hover:text-primary-500 transition-colors duration-200 mb-1">
                      Zen Wellness Center
                    </h4>
                    <p className="font-lora text-xs text-neutral-600">
                      Austin, TX • 5/5 stars
                    </p>
                  </div>
                </div>
              </div>

              {/* Newsletter Signup */}
              <div className="bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl p-6 text-white">
                <h3 className="font-poppins text-lg font-semibold mb-3">
                  Stay Updated
                </h3>
                <p className="font-lora text-sm opacity-90 mb-4">
                  Get weekly updates on new reviews and exclusive content.
                </p>
                <button className="w-full bg-white text-primary-500 font-poppins font-semibold py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors duration-200">
                  Subscribe Now
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SinglePostPage;