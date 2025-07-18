import React, { useState } from 'react';
import { Check } from 'lucide-react';
import HorizontalCategorySlider from './HorizontalCategorySlider';
import { mockFilters } from '../data/mockData';
import HorizontalFilterSlider from './HorizontalFilterSlider';

const CategoryFilterSystem = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    // Clear filters when switching categories
    setSelectedFilters([]);
  };

  const handleFilterToggle = (filterId: string) => {
    setSelectedFilters(prev => 
      prev.includes(filterId) 
        ? prev.filter(f => f !== filterId)
        : [...prev, filterId]
    );
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
  };

  const applyFilters = () => {
    // Scroll to reviews section with applied filters
    const reviewsSection = document.querySelector('#reviews');
    if (reviewsSection) {
      reviewsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    console.log('Applied filters:', {
      category: selectedCategory,
      filters: selectedFilters
    });
    
    // Here you would implement the actual filtering logic
    // This could update a global state or call an API
  };

  const hasActiveFilters = selectedFilters.length > 0;
  const showFilters = selectedCategory !== 'all'; // Only show filters when a category is selected
  const showActionButtons = selectedCategory !== 'all' || hasActiveFilters;

  return (
    <section id="categories" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            Find Your Perfect Experience
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            Select a category and apply filters to discover exactly what you're looking for.
          </p>
        </div>

        {/* Horizontal Category Slider */}
        <div className="mb-8">
          <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6 text-center">
            Choose Category
          </h3>
          <HorizontalCategorySlider
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        </div>

        {/* Horizontal Filter Slider - Only shows when category is selected */}
        <HorizontalFilterSlider
          selectedFilters={selectedFilters}
          onFilterToggle={handleFilterToggle}
          onClearAll={clearAllFilters}
          isVisible={showFilters}
        />

        {/* Action Buttons - Only show when category is selected or filters are active */}
        {showActionButtons && (
          <div className="text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={applyFilters}
                className="font-poppins bg-primary-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-600 hover:scale-105 shadow-lg transition-all duration-200"
              >
                View Results {hasActiveFilters ? `(${selectedFilters.length} filters)` : ''}
              </button>
              
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedFilters([]);
                }}
                className="font-poppins text-neutral-600 hover:text-neutral-800 underline hover:scale-105 transition-all duration-200"
              >
                Reset All
              </button>
            </div>
          </div>
        )}

        {/* Results Preview */}
        {showActionButtons && (
          <div className="mt-8 text-center animate-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <Check className="h-4 w-4 text-green-600 mr-2" />
              <span className="font-lora text-sm text-green-700">
                {selectedCategory !== 'all' 
                  ? `Ready to show ${selectedCategory.replace('-', ' ')} results`
                  : 'Filters ready to apply'
                }
                {hasActiveFilters && ` with ${selectedFilters.length} additional filter${selectedFilters.length > 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Custom CSS for hiding scrollbar */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        @keyframes slide-in-from-top-4 {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slide-in-from-bottom-4 {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes zoom-in-50 {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-in {
          animation-fill-mode: both;
        }
        
        .slide-in-from-top-4 {
          animation: slide-in-from-top-4 0.5s ease-out;
        }
        
        .slide-in-from-bottom-4 {
          animation: slide-in-from-bottom-4 0.3s ease-out;
        }
        
        .zoom-in-50 {
          animation: zoom-in-50 0.2s ease-out;
        }
        
        .duration-200 {
          animation-duration: 0.2s;
        }
        
        .duration-300 {
          animation-duration: 0.3s;
        }
        
        .duration-500 {
          animation-duration: 0.5s;
        }
      `}</style>
    </section>
  );
};

export default CategoryFilterSystem;