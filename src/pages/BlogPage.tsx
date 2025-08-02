import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, MapPin, Calendar, ArrowRight, Star, Info, Shield } from 'lucide-react';
import { useWordPressPosts } from '../hooks/useWordPress';
import { WordPressPost } from '../types/wordpress';
// Lazy load components
const PendingBadgeTooltip = lazy(() => import('../components/PendingBadgeTooltip'));


interface BlogPageProps {
  verified?: boolean;
}

const BlogPage: React.FC<BlogPageProps> = ({ verified = false }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Add the missing destructuring of the hook return value
  const { posts, loading, error, totalPages, total } = useWordPressPosts({
    per_page: postsPerPage,
    page: currentPage,
    search: searchTerm || undefined,
    categories: selectedCategory !== 'all' ? selectedCategory : undefined
  });
  
  // Add state for health score tooltip
  const [hoveredHealthScore, setHoveredHealthScore] = useState<number | null>(null);
  
  const postsPerPage = 10;
  
  // Update search term when URL search params change
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch) {
      setSearchTerm(urlSearch);
      setCurrentPage(1); // Reset to first page when searching
    }
  }, [searchParams]);

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'healthy-restaurants', name: 'Healthy Restaurants' },
    { id: 'restaurants', name: 'Restaurants' },
    { id: 'vegan', name: 'Vegan' },
    { id: 'hotels', name: 'Hotels' },
    { id: 'retail-grocery', name: 'Retail & Grocery' },
    { id: 'wellness', name: 'Wellness' },
    { id: 'products-services', name: 'Products & Services' }
  ];

  const formatWordPressReview = (post: WordPressPost) => {
    const acf = post.acf;
    const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
    
    // Create a short excerpt from WordPress content (not ACF field) for blog listing (3-4 lines max)
    const wordpressContent = post.content.rendered.replace(/<[^>]*>/g, '') || 'Review content coming soon...';
    const shortExcerpt = wordpressContent.length > 160 ? wordpressContent.substring(0, 160) + '...' : wordpressContent;
    
    return {
      id: post.id,
      title: post.title.rendered,
      slug: post.slug,
      date: new Date(post.date).toLocaleDateString(),
      excerpt: shortExcerpt, // Short excerpt from WordPress content for listing
      featuredImage: featuredImage?.source_url || acf?.business_image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      businessName: acf?.business_name || 'Business Name',
      location: acf?.location || 'Location',
      rating: acf?.rating || 5,
      healthScore: acf?.health_score || 95,
      category: acf?.category || 'general',
      isVerified: acf?.is_verified === true,
      reviewText: shortExcerpt
    };
  };

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

  const handlePostClick = (slug: string) => {
    navigate(`/post/${slug}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
    // Update URL with search params
    if (searchTerm.trim()) {
      navigate(`${location.pathname}?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate(location.pathname);
    }
  };

  // Filter posts by verification status if needed
  const filteredPosts = verified 
    ? posts.filter(post => post.acf?.is_verified === true)
    : posts;

  const formattedPosts = filteredPosts.map(formatWordPressReview);

  const pageTitle = verified ? 'Verified Reviews' : 'All Reviews';
  const pageDescription = verified 
    ? 'Browse our collection of verified reviews from actual visits and experiences.'
    : 'Explore all our reviews, including both verified experiences and recent additions.';

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <section className="py-16 bg-white border-b border-neutral-200 bg-gradient-to-br from-primary-50 to-accent-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="font-cinzel text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
              Verified Reviews
            </h1>
            <p className="font-lora text-xl text-neutral-600 max-w-2xl mx-auto">
              Browse our collection of verified reviews from actual visits and experiences.
            </p>
          </div>

          {/* Search and Filter Bar */}
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <form onSubmit={handleSearch} className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search reviews by business name, location, or content..."
                    className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora text-neutral-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </form>
              
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-neutral-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 border border-neutral-200 rounded-lg font-lora text-neutral-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Count */}
            <div className="text-center">
              <p className="font-lora text-neutral-600">
                {loading ? 'Loading...' : `Showing ${formattedPosts.length} of ${total} reviews`}
                {searchTerm && (
                  <span className="ml-2">
                    for "<span className="font-semibold text-primary-600">{searchTerm}</span>"
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content - Posts */}
            <div className="lg:col-span-3">
              {loading ? (
                <div className="space-y-6">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 animate-pulse">
                      <div className="flex gap-6">
                        <div className="w-48 h-32 bg-neutral-200 rounded-lg"></div>
                        <div className="flex-1 space-y-3">
                          <div className="h-6 bg-neutral-200 rounded w-3/4"></div>
                          <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
                          <div className="h-4 bg-neutral-200 rounded w-full"></div>
                          <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="font-lora text-red-600">Error loading reviews: {error}</p>
                </div>
              ) : formattedPosts.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                  <h3 className="font-cinzel text-xl font-semibold text-neutral-900 mb-2">
                    No reviews found
                  </h3>
                  <p className="font-lora text-neutral-600 mb-4">
                    {searchTerm 
                      ? `No reviews match your search for "${searchTerm}"`
                      : 'No reviews found matching your criteria.'
                    }
                  </p>
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        navigate(location.pathname);
                      }}
                      className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {formattedPosts.map((post) => (
                    <article
                      key={post.id}
                      className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow duration-200 cursor-pointer group"
                      onClick={() => handlePostClick(post.slug)}
                    >
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Featured Image */}
                        <div className="md:w-48 md:flex-shrink-0 relative">
                          <img
                            src={post.featuredImage}
                            alt={post.businessName}
                            className="w-full h-48 md:h-32 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                          />
                          
                          {/* Status Badge */}
                          <div className="absolute top-3 left-3">
                            {post.isVerified ? (
                              <div className="bg-green-500 text-white rounded-full px-3 py-1 flex items-center">
                                <Shield className="h-3 w-3 mr-1" />
                                <span className="font-poppins text-xs font-bold">VERIFIED</span>
                              </div>
                            ) : (
                              <Suspense fallback={
                                <div className="bg-yellow-500 text-white rounded-full px-3 py-1 flex items-center">
                                  <span className="font-poppins text-xs font-bold">PENDING</span>
                                </div>
                              }>
                                <PendingBadgeTooltip
                                  postId={post.id}
                                  postSlug={post.slug}
                                  businessName={post.businessName}
                                />
                              </Suspense>
                            )}
                          </div>
                        </div>
                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h2 className="font-cinzel text-xl font-semibold text-neutral-900 mb-2 group-hover:text-primary-500 transition-colors duration-200">
                                {post.businessName}
                              </h2>
                              
                              <div className="flex items-center gap-4 mb-3">
                                <div className="flex items-center">
                                  <MapPin className="h-4 w-4 text-neutral-500 mr-1" />
                                  <span className="font-lora text-sm text-neutral-600">{post.location}</span>
                                </div>
                                
                                <div className="flex items-center">
                                  <div className="flex text-yellow-400 mr-2">
                                    {[...Array(post.rating)].map((_, i) => (
                                      <Star key={i} className="h-4 w-4 fill-current" />
                                    ))}
                                  </div>
                                  <span className="font-poppins text-sm font-semibold text-neutral-700">
                                    {post.rating}/5
                                  </span>
                                </div>

                                {/* Health Score Badge - ONLY for verified posts */}
                                {post.isVerified && (
                                  <div 
                                    className="relative"
                                    onMouseEnter={() => setHoveredHealthScore(post.id)}
                                    onMouseLeave={() => setHoveredHealthScore(null)}
                                  >
                                    <div className={`${getHealthScoreColor(post.healthScore).bgLight} ${getHealthScoreColor(post.healthScore).text} px-3 py-1 rounded-full flex items-center cursor-help`}>
                                      <span className="font-poppins text-xs font-bold mr-1">
                                        Health: {post.healthScore}
                                      </span>
                                      <Info className="h-3 w-3" />
                                    </div>
                                    
                                    {hoveredHealthScore === post.id && (
                                      <HealthScoreTooltip score={post.healthScore} />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Short Excerpt from WordPress Content - 3-4 lines max */}
                          <p className="font-lora text-neutral-700 text-sm leading-relaxed mb-4 line-clamp-3">
                            {post.reviewText}
                          </p>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-neutral-500">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span className="font-lora text-xs">{post.date}</span>
                            </div>
                            
                            <div className="flex items-center font-poppins text-primary-500 font-semibold text-sm group-hover:text-primary-600 transition-colors duration-200">
                              <span>More Reviews</span>
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-4 py-2 rounded-lg font-poppins font-medium ${
                          currentPage === pageNum
                            ? 'bg-primary-500 text-white'
                            : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                {/* Search Widget */}
                {!searchTerm && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                      Quick Search
                    </h3>
                    <form onSubmit={handleSearch}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search reviews..."
                          className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg font-lora text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </form>
                  </div>
                )}

                {/* Categories Widget */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                  <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                    Categories
                  </h3>
                  <div className="space-y-2">
                    {categories.map(category => (
                      <button
                        key={category.id}
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setCurrentPage(1);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg font-lora text-sm transition-colors duration-200 ${
                          selectedCategory === category.id
                            ? 'bg-primary-100 text-primary-700'
                            : 'text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Health Score Legend */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                  <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                    Health Score Guide
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">✅</span>
                      <div>
                        <div className="font-poppins text-sm font-semibold text-green-700">80-100</div>
                        <div className="font-lora text-xs text-neutral-600">Exceptionally clean</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-lg mr-2">🔵</span>
                      <div>
                        <div className="font-poppins text-sm font-semibold text-blue-700">70-79</div>
                        <div className="font-lora text-xs text-neutral-600">Good standards</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-lg mr-2">⚠️</span>
                      <div>
                        <div className="font-poppins text-sm font-semibold text-yellow-700">65-69</div>
                        <div className="font-lora text-xs text-neutral-600">Fair standards</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-lg mr-2">🔴</span>
                      <div>
                        <div className="font-poppins text-sm font-semibold text-red-700">Under 65</div>
                        <div className="font-lora text-xs text-neutral-600">Needs improvement</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Posts Widget */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                  <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                    Recent Reviews
                  </h3>
                  <div className="space-y-4">
                    {formattedPosts.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        className="cursor-pointer group"
                        onClick={() => handlePostClick(post.slug)}
                      >
                        <h4 className="font-lora text-sm font-medium text-neutral-900 group-hover:text-primary-500 transition-colors duration-200 mb-1">
                          {post.businessName}
                        </h4>
                        <p className="font-lora text-xs text-neutral-600">
                          {post.location} • {post.date}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Newsletter Signup Widget */}
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BlogPage;