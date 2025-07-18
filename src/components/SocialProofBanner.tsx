import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

const SocialProofBanner = () => {
  const [stats, setStats] = useState({
    totalReviews: 0,
    monthlyViews: 0,
    avgRating: 0,
    subscriberCount: 0
  });

  const [currentStat, setCurrentStat] = useState(0);

  // Animate counters on component mount
  useEffect(() => {
    const targetStats = {
      totalReviews: 800,
      monthlyViews: 120000,
      avgRating: 4.8,
      subscriberCount: 3000
    };

    const duration = 2000;
    const steps = 60;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      
      setStats({
        totalReviews: Math.floor(targetStats.totalReviews * progress),
        monthlyViews: Math.floor(targetStats.monthlyViews * progress),
        avgRating: Number((targetStats.avgRating * progress).toFixed(1)),
        subscriberCount: Math.floor(targetStats.subscriberCount * progress)
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setStats(targetStats);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, []);

  // Rotate through different stats
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStat(prev => (prev + 1) % 4);
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const statItems = [
    {
      icon: Star,
      value: stats.totalReviews.toString(),
      label: 'Verified Reviews',
      color: 'text-yellow-500'
    },
    {
      icon: Star,
      value: `${(stats.monthlyViews / 1000).toFixed(0)}K`,
      label: 'Monthly Views',
      color: 'text-blue-500'
    },
    {
      icon: Star,
      value: stats.avgRating.toFixed(1),
      label: 'Average Rating',
      color: 'text-green-500'
    },
    {
      icon: Star,
      value: `${(stats.subscriberCount / 1000).toFixed(1)}K`,
      label: 'Subscribers',
      color: 'text-purple-500'
    }
  ];

  return (
    <div className="bg-gradient-to-r from-primary-500 to-accent-500 text-white py-3 sticky top-16 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          {/* Mobile: Show rotating single stat */}
          <div className="sm:hidden">
            {statItems.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div
                  key={index}
                  className={`flex items-center transition-opacity duration-500 ${
                    currentStat === index ? 'opacity-100' : 'opacity-0 absolute'
                  }`}
                >
                  <IconComponent className={`h-5 w-5 mr-2 ${stat.color}`} />
                  <span className="font-poppins text-lg font-bold mr-1">
                    {stat.value}
                  </span>
                  <span className="font-lora text-sm opacity-90">
                    {stat.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Desktop: Show all stats */}
          <div className="hidden sm:flex items-center justify-center gap-8">
            {statItems.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="flex items-center">
                  <IconComponent className={`h-5 w-5 mr-2 ${stat.color}`} />
                  <div>
                    <span className="font-poppins text-lg font-bold mr-1">
                      {stat.value}
                    </span>
                    <span className="font-lora text-sm opacity-90">
                      {stat.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pulsing indicator */}
          <div className="ml-4 flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
            <span className="font-lora text-xs opacity-75">Live Updates</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialProofBanner;