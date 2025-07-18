import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { useWordPressPosts } from '../hooks/useWordPress';
  
const FeaturedBlogSection = () => {
  const navigate = useNavigate();
  const { posts, loading } = useWordPressPosts({ 
    per_page: 6,
    orderby: 'date',
    order: 'desc'
  });
  
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Check scroll buttons visibility
  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      if (scrollContainerRef.current) {
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      }
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, [posts]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      const newScrollLeft = direction === 'left' 
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;
      
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  const formatPost = (post: any) => {
    const acf = post.acf;
    const featuredImage = post._embedded?.['wp:featuredmedia']?.[0];
    
    // Create a short excerpt from WordPress content
    const wordpressContent = post.content.rendered.replace(/<[^>]*>/g, '') || 'Review content coming soon...';
    const shortExcerpt = wordpressContent.length > 120 ? wordpressContent.substring(0, 120) + '...' : wordpressContent;
    
    return {
      id: post.id,
      slug: post.slug,
      title: post.title.rendered,
      date: new Date(post.date).toLocaleDateString(),
      excerpt: shortExcerpt,
      featuredImage: featuredImage?.source_url || acf?.business_image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      businessName: acf?.business_name || post.title.rendered.replace(' Review', ''),
      isVerified: acf?.is_verified === true
    };
  };

  const handlePostClick = (slug: string) => {
    navigate(`/post/${slug}`);
  };

  const formattedPosts = posts.filter(post => post.acf?.is_verified === true).map(formatPost).slice(0, 3);
  
  // If no verified posts, use regular posts
  const postsToShow = formattedPosts.length > 0 ? formattedPosts : posts.map(formatPost).slice(0, 3);

  if (loading || postsToShow.length === 0) {
    return null;
  }

  return (
    <section className="py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-cinzel text-xl font-bold text-neutral-900">
            Featured Articles
          </h2>
          
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`p-2 rounded-full border border-neutral-200 ${
                canScrollLeft 
                  ? 'text-neutral-600 hover:bg-neutral-50' 
                  : 'text-neutral-300 cursor-not-allowed'
              }`}
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`p-2 rounded-full border border-neutral-200 ${
                canScrollRight 
                  ? 'text-neutral-600 hover:bg-neutral-50' 
                  : 'text-neutral-300 cursor-not-allowed'
              }`}
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Desktop: Grid layout */}
        <div className="hidden md:flex md:space-x-6">
          {postsToShow.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-md transition-all duration-300 cursor-pointer group flex-1"
              onClick={() => handlePostClick(post.slug)}
            >
              <div className="flex p-4">
                <div className="flex-shrink-0 mr-4">
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden">
                    <img
                      src={post.featuredImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {post.isVerified && (
                      <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full px-2 py-0.5 flex items-center">
                        <Shield className="h-2 w-2 mr-0.5" />
                        <span className="font-poppins text-[8px] font-bold">VERIFIED</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center text-neutral-500 mb-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span className="font-lora text-xs">{post.date}</span>
                  </div>
                  
                  <h3 className="font-poppins text-base font-semibold text-neutral-900 mb-1 group-hover:text-primary-500 transition-colors duration-200 line-clamp-1">
                    {post.title}
                  </h3>
                  
                  <p className="font-lora text-xs text-neutral-600 line-clamp-2">
                    {post.excerpt}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Horizontal scroll */}
        <div className="md:hidden relative">
          <div 
            ref={scrollContainerRef}
            className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x"
          >
            {postsToShow.map((post) => (
              <div
                key={post.id}
                className="flex-shrink-0 w-[85%] snap-start bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 cursor-pointer"
                onClick={() => handlePostClick(post.slug)}
              >
                <div className="flex p-4">
                  <div className="flex-shrink-0 mr-3">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden">
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                      
                      {post.isVerified && (
                        <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full px-1.5 py-0.5 flex items-center">
                          <Shield className="h-2 w-2 mr-0.5" />
                          <span className="font-poppins text-[8px] font-bold">VERIFIED</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center text-neutral-500 mb-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="font-lora text-xs">{post.date}</span>
                    </div>
                    
                    <h3 className="font-poppins text-base font-semibold text-neutral-900 mb-1 line-clamp-1">
                      {post.title}
                    </h3>
                    
                    <p className="font-lora text-xs text-neutral-600 line-clamp-2">
                      {post.excerpt}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Mobile scroll indicators */}
          <div className="flex justify-center mt-4 gap-1">
            {postsToShow.map((_, index) => (
              <div 
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === 0 ? 'bg-primary-500' : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedBlogSection;