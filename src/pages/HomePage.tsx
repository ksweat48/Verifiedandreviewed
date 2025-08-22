import React, { Suspense, lazy } from 'react';

const AISearchHero = lazy(() => import('../components/AISearchHero')); 
const FeaturedBlogSection = lazy(() => import('../components/FeaturedBlogSection'));
const ExploreArea = lazy(() => import('../components/ExploreArea'));
const WeeklyReviewDigest = lazy(() => import('../components/WeeklyReviewDigest'));

interface HomePageProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const HomePage: React.FC<HomePageProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  return (
    <>
      <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading search...</div>}>
        <AISearchHero isAppModeActive={isAppModeActive} setIsAppModeActive={setIsAppModeActive} />
      </Suspense>
      
      {!isAppModeActive && (
        <>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading explore area...</div>}>
            <ExploreArea />
          </Suspense>
      
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading featured blogs...</div>}>
            <FeaturedBlogSection />
          </Suspense>
        </>
      )}
    </>
  );
};

export default HomePage;