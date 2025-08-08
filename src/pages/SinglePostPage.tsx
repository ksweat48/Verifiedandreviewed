import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Star, ArrowLeft, Share2, Info, Shield } from 'lucide-react';
import { useWordPressPost } from '../hooks/useWordPress';
import { useAnalytics } from '../hooks/useAnalytics';
import InlineImageGallery from '../components/InlineImageGallery';

const SinglePostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { trackReviewView } = useAnalytics();
  const [hoveredHealthScore, setHoveredHealthScore] = useState<number | null>(null);
  
  const { post, loading, error } = useWordPressPost(slug || '');

  useEffect(() => {
    if (post) {
      // Track review view
      trackReviewView(post.id.toString(), post.acf?.business_name || 'Unknown', post.acf?.category || 'general');
    }
  }, [post, trackReviewView]);

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-500', text: 'text-green-700', bgLight: 'bg-green-100' };
    if (score >= 70) return { bg: 'bg-yellow-500', text: 'text-yellow-700', bgLight: 'bg-yellow-100' };
    if (score >= 50) return { bg: 'bg-red-500', text: 'text-red-700', bgLight: 'bg-red-100' };
    return { bg: 'bg-gray-800', text: 'text-gray-700', bgLight: 'bg-gray-100' };
  };

  const getHealthScoreDescription = (score: number) => {
    if (score >= 90) return 'Exceptionally clean & health-forward';
    if (score >= 70) return 'Adequate but with room for improvement';
    if (score >= 50) return 'Significant issues (not seal-eligible)';
    return 'May be listed publicly as not recommended';
  };

  const getHealthScoreIcon = (score: number) => {
    if (score >= 90) return '✅';
    if (score >= 70) return '⚠️';
    if (score >= 50) return '🔴';
    return '🚫';
  };

  const HealthScoreTooltip = ({ score }: { score: number }) => (
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-white border border-neutral-200 rounded-lg shadow-lg p-4 z-10">
      <div className="flex items-center mb-2">
        <span className="text-lg mr-2">{getHealthScoreIcon(score)}</span>
        <span className="font-poppins font-semibold text-neutral-900">
          Health Score: {score}/100
        </span>
      </div>
      <p className="font-lora text-sm text-neutral-700 mb-3">
        {getHealthScoreDescription(score)}
      </p>
      <div className="text-xs text-neutral-600">
        <p className="font-poppins font-semibold mb-1">Score based on:</p>
        <ul className="font-lora space-y-1">
          <li>• Food handling & sanitation</li>
          <li>• Visible mold, odor, or pest indicators</li>
          <li>• Cross-contamination risks</li>
          <li>• Water station conditions</li>
          <li>• Cleanliness of high-touch areas</li>
        </ul>
      </div>
    </div>
  );

  const handleShare = async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title.rendered,
          text: post.excerpt.rendered.replace(/<[^>]*>/g, ''),
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-64 bg-neutral-200 rounded mx-auto mb-4"></div>
          <div className="h-4 w-48 bg-neutral-200 rounded mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
            Post Not Found
          </h1>
          <p className="font-lora text-neutral-600 mb-6">
            The review you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/blog')}
            className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            View All Reviews
          </button>
        </div>
      </div>
    );
  }

  const acf = post.acf;
  const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
  
  // Collect all gallery images
  const galleryImages = [];
  for (let i = 1; i <= 5; i++) {
    const imageUrl = acf?.[`gallery_image_${i}`];
    if (imageUrl) {
      galleryImages.push(imageUrl);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center font-poppins text-neutral-600 hover:text-neutral-900 transition-colors duration-200"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>
            
            <button
              onClick={handleShare}
              className="flex items-center font-poppins text-neutral-600 hover:text-neutral-900 transition-colors duration-200"
            >
              <Share2 className="h-5 w-5 mr-2" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Business Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Featured Image */}
            <div className="md:w-1/3">
              <img
                src={featuredImage?.source_url || acf?.business_image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800'}
                alt={acf?.business_name || post.title.rendered}
                className="w-full h-64 md:h-48 object-cover rounded-lg"
              />
            </div>
            
            {/* Business Info */}
            <div className="md:w-2/3">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="font-cinzel text-3xl font-bold text-neutral-900 mb-2">
                    {acf?.business_name || post.title.rendered.replace(' Review', '')}
                  </h1>
                  
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-neutral-500 mr-1" />
                      <span className="font-lora text-neutral-600">{acf?.location || 'Location not specified'}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="flex text-yellow-400 mr-2">
                        {[...Array(acf?.rating || 5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <span className="font-poppins font-semibold text-neutral-700">
                        {acf?.rating || 5}/5
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Status Badge */}
                <div>
                  {acf?.is_verified ? (
                    <div className="bg-green-500 text-white rounded-full px-4 py-2 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      <span className="font-poppins text-sm font-bold">VERIFIED</span>
                    </div>
                  ) : (
                    <div className="bg-yellow-500 text-white rounded-full px-4 py-2 flex items-center">
                      <span className="font-poppins text-sm font-bold">PENDING</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Health Score - Only for verified posts */}
              {acf?.is_verified && acf?.health_score && (
                <div 
                  className="relative inline-block mb-4"
                  onMouseEnter={() => setHoveredHealthScore(post.id)}
                  onMouseLeave={() => setHoveredHealthScore(null)}
                >
                  <div className={`${getHealthScoreColor(acf.health_score).bgLight} ${getHealthScoreColor(acf.health_score).text} px-4 py-2 rounded-full flex items-center cursor-help`}>
                    <span className="font-poppins font-bold mr-2">
                      Health Score: {acf.health_score}/100
                    </span>
                    <Info className="h-4 w-4" />
                  </div>
                  
                  {hoveredHealthScore === post.id && (
                    <HealthScoreTooltip score={acf.health_score} />
                  )}
                </div>
              )}
              
              {/* Meta Info */}
              <div className="flex items-center text-neutral-500 text-sm">
                <Calendar className="h-4 w-4 mr-1" />
                <span className="font-lora">Published {new Date(post.date).toLocaleDateString()}</span>
                {acf?.verified_date && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="font-lora">Verified {new Date(acf.verified_date).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Review Content */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-neutral-200">
          <div 
            className="wordpress-content prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content.rendered }}
          />
          
          {/* Gallery Images - Inline after first paragraph */}
          {galleryImages.length > 0 && (
            <InlineImageGallery 
              images={galleryImages}
              className="my-8"
            />
          )}
        </div>

        {/* Business Features */}
        {(acf?.clean_bathrooms || acf?.drive_thru || acf?.vegan_options || acf?.black_owned || acf?.women_owned || acf?.veteran_owned) && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 mt-8">
            <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-4">
              Features & Amenities
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {acf?.clean_bathrooms && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="font-lora text-neutral-700">Clean Bathrooms</span>
                </div>
              )}
              
              {acf?.drive_thru && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span className="font-lora text-neutral-700">Drive-Thru</span>
                </div>
              )}
              
              {acf?.vegan_options && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="font-lora text-neutral-700">Vegan Options</span>
                </div>
              )}
              
              {acf?.black_owned && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  <span className="font-lora text-neutral-700">Black Owned</span>
                </div>
              )}
              
              {acf?.women_owned && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-pink-500 rounded-full mr-2"></div>
                  <span className="font-lora text-neutral-700">Women Owned</span>
                </div>
              )}
              
              {acf?.veteran_owned && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                  <span className="font-lora text-neutral-700">Veteran Owned</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/blog')}
            className="font-poppins bg-primary-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            View More Reviews
          </button>
        </div>
      </article>
    </div>
  );
};

export default SinglePostPage;