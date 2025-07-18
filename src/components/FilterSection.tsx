import React, { useState } from 'react';

const FilterSection = () => {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const filters = [
    'Clean Bathrooms',
    'Health Score 90+',
    'Drive-thru',
    'Black-owned',
    'Women-owned',
    'Veteran-owned'
  ];

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  const applyFilters = () => {
    // Scroll to reviews section with applied filters
    const reviewsSection = document.querySelector('#reviews');
    if (reviewsSection) {
      reviewsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    console.log('Applied filters:', activeFilters);
    // Add your filter logic here
  };

  return (
    <section className="py-12 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h3 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
            Filter Your Search
          </h3>
          <p className="font-lora text-neutral-600">
            Find exactly what you're looking for with our advanced filters
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => toggleFilter(filter)}
              className={`font-lora px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                activeFilters.includes(filter)
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white border-2 border-neutral-200 text-neutral-700 hover:border-primary-500 hover:text-primary-500'
              }`}
            >
              {filter}
              {activeFilters.includes(filter) && (
                <span className="ml-2">✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          {activeFilters.length > 0 && (
            <button
              onClick={clearAllFilters}
              className="font-poppins bg-neutral-200 text-neutral-700 px-6 py-2 rounded-lg font-medium hover:bg-neutral-300 transition-colors duration-200"
            >
              Clear All
            </button>
          )}
          
          <button
            onClick={applyFilters}
            className="font-poppins bg-primary-500 text-white px-8 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            Apply Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>
        </div>
      </div>
    </section>
  );
};

export default FilterSection;