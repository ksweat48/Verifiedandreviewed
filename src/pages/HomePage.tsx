import React, { Suspense, lazy } from 'react';
import { AISearchHero } from '../components/AISearchHero';

const FeaturedBlogSection = lazy(() => import('../components/FeaturedBlogSection'));
const ExploreArea = lazy(() => import('../components/ExploreArea'));
const WeeklyReviewDigest = lazy(() => import('../components/WeeklyReviewDigest'));

interface HomePageProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

// Enhanced loading component for critical sections
const CriticalSectionLoader = ({ title }: { title: string }) => (
  <div className="min-h-[400px] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
      <h3 className="font-cinzel text-xl font-bold text-neutral-900 mb-2">
        Loading {title}
      </h3>
      <p className="font-lora text-neutral-600">
        Preparing your experience...
      </p>
    </div>
  </div>
);

// Standard loading component for secondary sections
const StandardSectionLoader = ({ title }: { title: string }) => (
  <div className="h-64 flex items-center justify-center bg-white">
    <div className="text-center">
      <div className="animate-pulse">
        <div className="h-8 w-32 bg-neutral-200 rounded mx-auto mb-4"></div>
        <div className="h-4 w-48 bg-neutral-200 rounded mx-auto mb-2"></div>
        <div className="h-4 w-36 bg-neutral-200 rounded mx-auto"></div>
      </div>
      <p className="font-lora text-sm text-neutral-500 mt-4">
        Loading {title}...
      </p>
    </div>
  </div>
);
const HomePage: React.FC<HomePageProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  return (
    <>
      <AISearchHero isAppModeActive={isAppModeActive} setIsAppModeActive={setIsAppModeActive} />
      
      {!isAppModeActive && (
        <>
          <Suspense fallback={<CriticalSectionLoader title="Explore Area" />}>
            <ExploreArea />
          </Suspense>
      
          <Suspense fallback={<StandardSectionLoader title="Featured Articles" />}>
            <FeaturedBlogSection />
          </Suspense>
        </>
      )}
    </>
  );
};

export default HomePage;