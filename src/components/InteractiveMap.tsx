import React, { useState } from 'react';
import { MapPin, Filter, Search } from 'lucide-react';

const InteractiveMap = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', name: 'All Locations', count: 847 },
    { id: 'healthy', name: 'Healthy Restaurants', count: 156 },
    { id: 'restaurants', name: 'Restaurants', count: 89 },
    { id: 'vegan', name: 'Vegan', count: 234 },
    { id: 'hotels', name: 'Hotels', count: 198 },
    { id: 'retail', name: 'Retail & Grocery', count: 170 },
    { id: 'wellness', name: 'Wellness', count: 127 },
    { id: 'products', name: 'Products & Services', count: 93 }
  ];

  const quickFilters = [
    'Clean Bathrooms',
    'Health Score 90+',
    'Drive-thru',
    'Black-owned',
    'Women-owned',
    'Veteran-owned'
  ];

  return (
    <section className="py-16 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-cinzel text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            Explore Reviewed Locations
          </h2>
          <p className="font-lora text-lg text-neutral-600 max-w-2xl mx-auto">
            Interactive map of all verified and reviewed places. Filter by category to find exactly what you're looking for.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-neutral-200">
              <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                <Filter className="h-5 w-5 mr-2 text-primary-500" />
                Filter Locations
              </h3>

              <div className="space-y-2">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${
                      activeFilter === filter.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-lora font-medium text-sm">{filter.name}</span>
                      <span className={`text-xs ${activeFilter === filter.id ? 'text-white' : 'text-neutral-500'}`}>
                        {filter.count}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick Filters */}
              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h4 className="font-poppins font-semibold text-neutral-700 mb-3 text-sm">Quick Filters</h4>
                <div className="space-y-2">
                  {quickFilters.map((filter) => (
                    <label key={filter} className="flex items-center">
                      <input type="checkbox" className="rounded border-neutral-300 text-primary-500 focus:ring-primary-500 mr-2" />
                      <span className="font-lora text-xs text-neutral-600">{filter}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Map Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-neutral-200">
              <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-8 h-80 flex items-center justify-center relative overflow-hidden">
                {/* Map Pins */}
                <div className="absolute top-8 left-12 bg-primary-500 text-white p-2 rounded-full shadow-lg">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="absolute top-16 right-16 bg-primary-500 text-white p-2 rounded-full shadow-lg">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="absolute bottom-12 left-20 bg-primary-500 text-white p-2 rounded-full shadow-lg">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="absolute bottom-16 right-12 bg-primary-500 text-white p-2 rounded-full shadow-lg">
                  <MapPin className="h-4 w-4" />
                </div>

                {/* Map Placeholder Content */}
                <div className="text-center z-10">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPin className="h-8 w-8 text-primary-500" />
                  </div>
                  <h3 className="font-cinzel text-2xl font-semibold text-neutral-900 mb-3">
                    Interactive Map View
                  </h3>
                  <p className="font-lora text-neutral-600 mb-4">
                    Explore {filters.find(f => f.id === activeFilter)?.count} verified locations
                  </p>
                  <button className="font-poppins bg-primary-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200">
                    Load Full Map
                  </button>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mt-4 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search locations by name, address, or category..."
                className="w-full pl-12 pr-6 py-3 border border-neutral-200 rounded-xl font-lora text-neutral-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InteractiveMap;