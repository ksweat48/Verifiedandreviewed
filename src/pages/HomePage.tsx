import React from 'react';
import AISearchHero from '../components/AISearchHero';
import FeaturedBlogSection from '../components/FeaturedBlogSection';
import ExploreArea from '../components/ExploreArea';
import WeeklyReviewDigest from '../components/WeeklyReviewDigest';

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
          <ExploreArea />
          <FeaturedBlogSection />
        </>
      )}
    </>
  );
};

export default HomePage;