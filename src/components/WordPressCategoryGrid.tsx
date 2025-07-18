import React from 'react';
import { Apple, Utensils, Leaf, Building, ShoppingBag, Heart, Package } from 'lucide-react';
import { useWordPressCategories } from '../hooks/useWordPress';

const WordPressCategoryGrid = () => {
  const { categories, loading, error } = useWordPressCategories();

  const iconMap: { [key: string]: any } = {
    'healthy-fast-food': Apple,
    'traditional-fast-food': Utensils,
    'vegan': Leaf,
    'hotels': Building,
    'retail-grocery': ShoppingBag,
    'wellness': Heart,
    'products-services': Package,
  };

  const colorMap: { [key: string]: { bg: string; border: string; icon: string } } = {
    'healthy-fast-food': { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600' },
    'traditional-fast-food': { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600' },
    'vegan': { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
    'hotels': { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
    'retail-grocery': { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600' },
    'wellness': { bg: 'bg-pink-50', border: 'border-pink-200', icon: 'text-pink-600' },
    'products-services': { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600' },
  };

  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
              Explore Categories
            </h2>
            <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
              Loading categories from WordPress...
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="bg-neutral-100 rounded-2xl h-48 animate-pulse"></div>
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
          <div className="text-center">
            <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
              Explore Categories
            </h2>
            <p className="font-lora text-lg text-red-600">
              Unable to load categories. Using default categories.
            </p>
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
            Explore Categories
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            Discover verified reviews across all your favorite categories, from healthy eats to wellness experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((category, index) => {
            const IconComponent = iconMap[category.slug] || Package;
            const colors = colorMap[category.slug] || colorMap['products-services'];
            const trending = category.count > 10; // Mark as trending if more than 10 posts

            return (
              <div
                key={category.id}
                className={`${colors.bg} ${colors.border} border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group relative`}
              >
                {trending && (
                  <div className="absolute -top-2 -right-2 bg-primary-500 text-white rounded-full px-3 py-1 text-xs font-poppins font-bold">
                    Trending
                  </div>
                )}
                
                <div className="text-center">
                  <div className={`w-12 h-12 ${colors.icon} mx-auto mb-4 group-hover:scale-110 transition-transform duration-200`}>
                    <IconComponent className="h-12 w-12" />
                  </div>
                  
                  <h3 className="font-cinzel text-lg font-semibold text-neutral-900 mb-2">
                    {category.name}
                  </h3>
                  
                  <p className="font-lora text-sm text-neutral-600 mb-4">
                    {category.description || `Discover ${category.name.toLowerCase()} reviews`}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="font-lora text-sm text-neutral-500">
                      {category.count} reviews
                    </span>
                    <div className="text-primary-500 font-poppins text-sm font-semibold group-hover:text-primary-600 transition-colors duration-200">
                      View Reviews →
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WordPressCategoryGrid;