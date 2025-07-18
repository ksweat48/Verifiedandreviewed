import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Check, Filter } from 'lucide-react';

interface Filter {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

interface HorizontalFilterSliderProps {
  selectedFilters: string[];
  onFilterToggle: (filterId: string) => void;
  onClearAll: () => void;
  isVisible: boolean;
}

// Static filters - moved from mockData
const filters = [
  'Clean Bathrooms',
  'Health Score 90+',
  'Drive-thru',
  'Black-owned',
  'Women-owned',
  'Veteran-owned'
];

const HorizontalFilterSlider: React.FC<HorizontalFilterSliderProps> = ({
  selectedFilters,
  onFilterToggle,
  onClearAll,
  isVisible
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Convert string array to Filter objects
  const filterObjects: Filter[] = filters.map(filter => {
    // Create an ID from the filter name
    const id = filter.toLowerCase().replace(/\s+/g, '-');
    
    // Assign appropriate icons based on filter type
    let icon = '✅';
    if (filter.includes('Bathroom')) icon = '🚿';
    if (filter.includes('Health Score')) icon = '⭐';
    if (filter.includes('Drive')) icon = '🚗';
    if (filter.includes('Black')) icon = '✊🏿';
    if (filter.includes('Women')) icon = '👩';
    if (filter.includes('Veteran')) icon = '🇺🇸';
    
    return {
      id,
      name: filter,
      description: `Filter for ${filter}`,
      icon
    };
  });

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
  }, [isVisible]);

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

  if (!isVisible) {
    return null;
  }

  return (
    <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Filter className="h-5 w-5 text-primary-500 mr-2" />
          <h3 className="font-poppins text-xl font-semibold text-neutral-900">
            Refine Your Search
          </h3>
        </div>
        
        {selectedFilters.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center font-poppins text-sm text-neutral-600 hover:text-red-500 transition-colors duration-200"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All ({selectedFilters.length})
          </button>
        )}
      </div>

      <div className="relative">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 z-10 w-10 h-10 bg-white border border-neutral-200 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
            canScrollLeft 
              ? 'opacity-100 hover:bg-neutral-50 hover:shadow-xl hover:scale-105' 
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
            msOverflowStyle: 'none'
          }}
        >
          {filterObjects.map((filter) => {
            const isSelected = selectedFilters.includes(filter.id);

            return (
              <button
                key={filter.id}
                onClick={() => onFilterToggle(filter.id)}
                className={`flex-shrink-0 ${
                  isSelected 
                    ? 'bg-primary-500 border-primary-500 text-white shadow-lg transform scale-105' 
                    : 'bg-white border-neutral-200 text-neutral-700 hover:border-primary-500 hover:text-primary-500 hover:shadow-md hover:scale-102'
                } border-2 rounded-full px-4 py-3 transition-all duration-300 flex items-center min-w-max group`}
                title={filter.description}
              >
                <span className="text-lg mr-2">{filter.icon}</span>
                <span className="font-lora text-sm font-medium whitespace-nowrap">
                  {filter.name}
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 ml-2 animate-in zoom-in-50 duration-200" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className={`absolute right-0 top-1/2 transform -translate-y-1/2 z-10 w-10 h-10 bg-white border border-neutral-200 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
            canScrollRight 
              ? 'opacity-100 hover:bg-neutral-50 hover:shadow-xl hover:scale-105' 
              : 'opacity-0 pointer-events-none'
          }`}
          style={{ marginRight: '-20px' }}
        >
          <ChevronRight className="h-5 w-5 text-neutral-600" />
        </button>
      </div>

      {/* Active Filters Display */}
      {selectedFilters.length > 0 && (
        <div className="mt-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-poppins text-sm font-semibold text-primary-900">
                Active Filters:
              </span>
              {selectedFilters.map((filterId) => {
                const filter = filters.find(f => f.id === filterId);
                return (
                  <span
                    key={filterId}
                    className="inline-flex items-center bg-primary-500 text-white rounded-full px-3 py-1 text-xs font-medium shadow-sm"
                  >
                    <span className="mr-1">{filter?.icon}</span>
                    {filter?.name}
                    <button
                      onClick={() => onFilterToggle(filterId)}
                      className="ml-2 hover:text-primary-200 transition-colors duration-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Scroll Progress Indicators */}
      <div className="flex justify-center mt-4 space-x-1">
        {Array.from({ length: Math.ceil(filters.length / 6) }).map((_, index) => (
          <div
            key={index}
            className="w-2 h-2 rounded-full bg-neutral-200 transition-colors duration-200"
          />
        ))}
      </div>
    </div>
  );
};

export default HorizontalFilterSlider;