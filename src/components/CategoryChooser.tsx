import React from 'react';
import { Apple, Utensils, Leaf, Building, ShoppingBag, Heart, Package, Flame } from 'lucide-react';

const CategoryChooser = () => {
  const categories = [
    {
      name: 'Healthy Fast Food',
      icon: Apple,
      color: 'bg-green-50 border-green-200',
      iconColor: 'text-green-600',
      description: 'Fresh, nutritious quick meals',
      trending: true,
      count: 156
    },
    {
      name: 'Traditional Fast Food',
      icon: Utensils,
      color: 'bg-orange-50 border-orange-200',
      iconColor: 'text-orange-600',
      description: 'Classic comfort food favorites',
      trending: false,
      count: 89
    },
    {
      name: 'Vegan',
      icon: Leaf,
      color: 'bg-emerald-50 border-emerald-200',
      iconColor: 'text-emerald-600',
      description: 'Plant-based dining options',
      trending: true,
      count: 234
    },
    {
      name: 'Hotels',
      icon: Building,
      color: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
      description: 'Accommodations & stays',
      trending: false,
      count: 198
    },
    {
      name: 'Retail & Grocery',
      icon: ShoppingBag,
      color: 'bg-purple-50 border-purple-200',
      iconColor: 'text-purple-600',
      description: 'Shopping & everyday essentials',
      trending: true,
      count: 170
    },
    {
      name: 'Wellness',
      icon: Heart,
      color: 'bg-pink-50 border-pink-200',
      iconColor: 'text-pink-600',
      description: 'Health & self-care services',
      trending: false,
      count: 127
    },
    {
      name: 'Products & Services',
      icon: Package,
      color: 'bg-indigo-50 border-indigo-200',
      iconColor: 'text-indigo-600',
      description: 'Various products & services',
      trending: false,
      count: 93
    }
  ];

  return (
    <section id="categories" className="py-20 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-cinzel text-4xl md:text-5xl font-semibold text-neutral-900 mb-6">
            Explore Categories
          </h2>
          <p className="font-lora text-xl text-neutral-600 max-w-3xl mx-auto leading-relaxed">
            Discover verified reviews across all your favorite categories, from healthy eats to wellness experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
          {categories.map((category, index) => {
            const IconComponent = category.icon;
            return (
              <div
                key={category.name}
                className={`${category.color} border-2 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 cursor-pointer group hover:-translate-y-2 relative`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {category.trending && (
                  <div className="absolute -top-3 -right-3 bg-primary-500 text-white rounded-full px-4 py-2 flex items-center shadow-lg">
                    <Icons.Flame className="h-4 w-4 mr-1" />
                    <span className="font-poppins text-xs font-bold">TRENDING</span>
                  </div>
                )}
                
                <div className="text-center">
                  <div className={`w-16 h-16 ${category.iconColor} mx-auto mb-6 group-hover:scale-110 transition-transform duration-200`}>
                    <IconComponent className="h-16 w-16" />
                  </div>
                  
                  <h3 className="font-cinzel text-xl font-semibold text-neutral-900 mb-3">
                    {category.name}
                  </h3>
                  
                  <p className="font-lora text-neutral-600 mb-4 leading-relaxed">
                    {category.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="font-poppins text-sm text-neutral-500">
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

        {/* Filter Section */}
        <div className="bg-white rounded-3xl p-10 shadow-lg">
          <h3 className="font-cinzel text-3xl font-semibold text-neutral-900 mb-8 text-center">
            Filter Your Search
          </h3>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {[
              'Clean Bathrooms',
              'Health Score 90+',
              'Drive-thru',
              'Black-owned',
              'Women-owned',
              'Veteran-owned'
            ].map((filter) => (
              <button
                key={filter}
                className="font-poppins bg-neutral-50 border-2 border-neutral-200 text-neutral-700 px-6 py-3 rounded-full hover:bg-primary-500 hover:text-white hover:border-primary-500 transition-all duration-200"
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="text-center">
            <button className="font-poppins bg-primary-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center mx-auto">
              <Flame className="h-5 w-5 mr-2" />
              View Trending Reviews
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoryChooser;