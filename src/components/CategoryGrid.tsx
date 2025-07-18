import React from 'react';
import * as Icons from 'lucide-react';

const CategoryGrid = () => {
  const handleCategoryClick = (categoryName: string) => {
    // Scroll to reviews section and filter by category
    const reviewsSection = document.querySelector('#reviews');
    if (reviewsSection) {
      reviewsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // You can add category filtering logic here
    console.log(`Filtering by category: ${categoryName}`);
  };

  // Use static categories with UPDATED names - no more WordPress dependency for display
  const categories = [
    { id: 1, count: 156, description: '', link: '#', name: 'Healthy Restaurants', slug: 'healthy-restaurants', taxonomy: 'category', parent: 0 },
    { id: 2, count: 89, description: '', link: '#', name: 'Restaurants', slug: 'restaurants', taxonomy: 'category', parent: 0 },
    { id: 3, count: 234, description: '', link: '#', name: 'Vegan', slug: 'vegan', taxonomy: 'category', parent: 0 }
  ];

  const iconMap: { [key: string]: any } = {
    'healthy-restaurants': Icons.Apple,
    'restaurants': Icons.Utensils,
    'vegan': Icons.Leaf,
    'hotels': Icons.Building,
    'retail-grocery': Icons.ShoppingBag,
    'wellness': Icons.Heart,
    'products-services': Icons.Package,
  };

  const colorMap: { [key: string]: { bg: string; border: string; icon: string } } = {
    'healthy-restaurants': { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600' },
    'restaurants': { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600' },
    'vegan': { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
    'hotels': { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
    'retail-grocery': { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600' },
    'wellness': { bg: 'bg-pink-50', border: 'border-pink-200', icon: 'text-pink-600' },
    'products-services': { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600' },
  };

  return (
    <section id="categories" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            Explore Categories
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            Discover verified reviews across all your favorite categories, from healthy eats to wellness experiences.
          </p>
        </div>

        {/* Inline Category Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {categories.map((category, index) => {
            const IconComponent = iconMap[category.slug] || Package;
            const colors = colorMap[category.slug] || colorMap['products-services'];
            const trending = category.count > 100; // Mark as trending if more than 100 posts

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.name)}
                className={`${colors.bg} ${colors.border} border rounded-full px-4 py-2 hover:shadow-md transition-all duration-300 cursor-pointer group relative flex items-center`}
              >
                {trending && (
                  <div className="absolute -top-1 -right-1 bg-primary-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                    <span className="text-xs">•</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <div className={`${colors.icon} group-hover:scale-110 transition-transform duration-200`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  
                  <span className="font-poppins text-sm font-medium text-neutral-900">
                    {category.name}
                  </span>
                  
                  <span className="font-poppins text-xs text-neutral-500">
                    ({category.count})
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Category Description */}
        <div className="text-center">
          <p className="font-lora text-neutral-600">
            Click any category to explore verified reviews in that area
          </p>
        </div>
      </div>
    </section>
  );
};

export default CategoryGrid;