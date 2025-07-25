import React, { Suspense } from 'react';
import AISearchHero from '../components/AISearchHero';

const FeaturedBlogSection = React.lazy(() => import('../components/FeaturedBlogSection'));
const ExploreArea = React.lazy(() => import('../components/ExploreArea'));
const WeeklyReviewDigest = React.lazy(() => import('../components/WeeklyReviewDigest'));

interface HomePageProps {
  isAppModeActive: boolean;
  setIsAppModeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

const HomePage: React.FC<HomePageProps> = ({ isAppModeActive, setIsAppModeActive }) => {
  return (
    <>
      <AISearchHero isAppModeActive={isAppModeActive} setIsAppModeActive={setIsAppModeActive} />
      
      {!isAppModeActive && (
        <>
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading featured blogs...</div>}>
            <FeaturedBlogSection />
          </Suspense>
      
          <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading explore area...</div>}>
            <ExploreArea />
          </Suspense>
      
          <Suspense fallback={<div className="h-32 flex items-center justify-center">Loading digest...</div>}>
            <WeeklyReviewDigest />
          </Suspense>
        </>
      )}
    </>
  );
};

export default HomePage;