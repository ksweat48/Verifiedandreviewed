import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Package, Apple, Utensils, Leaf, Building, ShoppingBag, Heart } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: any;
  count: number;
  color: string;
  iconColor: string;
}

interface HorizontalCategorySliderProps {
  selectedCategory: string;
  onCategorySelect: (categoryId: string) => void;
}

// Static categories - moved from mockData
const categories = [
  { id: 'all', name: 'All Categories', count: 847 },
  { id: 'healthy-restaurants', name: 'Healthy Restaurants', count: 156 },
  { id: 'restaurants', name: 'Restaurants', count: 89 },
  { id: 'vegan', name: 'Vegan', count: 234 },
  { id: 'hotels', name: 'Hotels', count: 198 },
  { id: 'retail-grocery', name: 'Retail & Grocery', count: 170 },
  { id: 'wellness', name: 'Wellness', count: 127 },
  { id: 'products-services', name: 'Products & Services', count: 93 }
];

const HorizontalCategorySlider: React.FC<HorizontalCategorySliderProps> = ({
  selectedCategory,
  onCategorySelect
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Map the simple category objects to the full Category interface
  const iconMap: { [key: string]: any } = {
    'all': Package,
    'healthy-restaurants': Apple,
    'restaurants': Utensils,
    'vegan': Leaf,
    'hotels': Building,
    'retail-grocery': ShoppingBag,
    'wellness': Heart,
    'products-services': Package
  };
  
  const colorMap: { [key: string]: { color: string, iconColor: string } } = {
    'all': { color: 'bg-neutral-50 border-neutral-200', iconColor: 'text-neutral-600' },
    'healthy-restaurants': { color: 'bg-green-50 border-green-200', iconColor: 'text-green-600' },
    'restaurants': { color: 'bg-orange-50 border-orange-200', iconColor: 'text-orange-600' },
    'vegan': { color: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600' },
    'hotels': { color: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600' },
    'retail-grocery': { color: 'bg-purple-50 border-purple-200', iconColor: 'text-purple-600' },
    'wellness': { color: 'bg-pink-50 border-pink-200', iconColor: 'text-pink-600' },
    'products-services': { color: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600' }
  };
  
  const categoryObjects: Category[] = categories.map(category => ({
    id: category.id,
    name: category.name,
    slug: category.id,
    icon: iconMap[category.id] || Package,
    count: category.count,
    color: colorMap[category.id]?.color || 'bg-neutral-50 border-neutral-200',
    iconColor: colorMap[category.id]?.iconColor || 'text-neutral-600'
  }));

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, []);

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

  return (
    <div className="relative">
      {/* Left Scroll Button */}
      <button
        onClick={() => scroll('left')}
        className={`absolute left-0 top-1/2 transform -translate-y-1/2 z-10 w-10 h-10 bg-white border border-neutral-200 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          canScrollLeft 
            ? 'opacity-100 hover:bg-neutral-50 hover:shadow-xl' 
            : 'opacity-0 pointer-events-none'
        }`}
        style={{ marginLeft: '-20px' }}
      >
        <ChevronLeft className="h-5 w-5 text-neutral-600" />
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitScrollbar: { display: 'none' }
        }}
      >
        {categoryObjects.map((category) => {
          const IconComponent = category.icon;
          const isSelected = selectedCategory === category.id;
          const trending = category.count > 100;

          return (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.id)}
              className={`flex-shrink-0 relative ${
                isSelected 
                  ? 'bg-primary-500 border-primary-500 text-white shadow-lg transform scale-105' 
                  : `${category.color} border hover:shadow-md hover:scale-102`
              } rounded-full px-4 py-3 transition-all duration-300 cursor-pointer group flex items-center min-w-max`}
            >
              {trending && !isSelected && (
                <div className="absolute -top-1 -right-1 bg-primary-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                  <span className="text-xs">•</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <IconComponent className={`h-5 w-5 ${
                  isSelected ? 'text-white' : category.iconColor
                } group-hover:scale-110 transition-transform duration-200`} />
                
                <span className={`font-poppins text-sm font-medium whitespace-nowrap ${
                  isSelected ? 'text-white' : 'text-neutral-900'
                }`}>
                  {category.name}
                </span>
                
                <span className={`font-poppins text-xs ${
                  isSelected ? 'text-white opacity-90' : 'text-neutral-500'
                } bg-black bg-opacity-10 px-2 py-1 rounded-full`}>
                  {category.count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right Scroll Button */}
      <button
        onClick={() => scroll('right')}
        className={`absolute right-0 top-1/2 transform -translate-y-1/2 z-10 w-10 h-10 bg-white border border-neutral-200 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          canScrollRight 
            ? 'opacity-100 hover:bg-neutral-50 hover:shadow-xl' 
            : 'opacity-0 pointer-events-none'
        }`}
        style={{ marginRight: '-20px' }}
      >
        <ChevronRight className="h-5 w-5 text-neutral-600" />
      </button>

      {/* Scroll Indicators */}
      <div className="flex justify-center mt-4 space-x-1">
        {Array.from({ length: Math.ceil(categoryObjects.length / 4) }).map((_, index) => (
          <div
            key={index}
            className="w-2 h-2 rounded-full bg-neutral-200 transition-colors duration-200"
          />
        ))}
      </div>
    </div>
  );
};

export default HorizontalCategorySlider;