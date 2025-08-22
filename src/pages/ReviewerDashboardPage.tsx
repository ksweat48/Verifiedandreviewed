import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { UserService } from '../services/userService';
import { BusinessService } from '../services/businessService';
import { ReviewService } from '../services/reviewService';
import type { User as UserType } from '../types/user';
import MyBusinessesSection from '../components/MyBusinessesSection';
import MyReviewsSection from '../components/MyReviewsSection';
import MyFavoritesSection from '../components/MyFavoritesSection';
import RecentActivitySection from '../components/RecentActivitySection';
import CreditsManager from '../components/CreditsManager';
import ReferralProgram from '../components/ReferralProgram';
import { formatCredits, formatReviewCount, formatStat } from '../utils/formatters';

const ReviewerDashboardPage = () => {
  const location = useLocation();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'businesses' | 'credits'>('overview');
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [favoritedAIBusinesses, setFavoritedAIBusinesses] = useState<any[]>([]);

  // Handle navigation state to set active tab
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await UserService.getCurrentUser();
        setUser(userData);
        
        if (userData) {
          setLoadingReviews(true);
          const reviews = await ReviewService.getUserReviews(userData.id);
          
          // Transform reviews to match expected format
          const formattedReviews = reviews.map(review => ({
            id: review.id,
            businessId: review.business_id,
            businessName: review.businesses?.name || 'Unknown Business',
            location: review.businesses?.location || 'Unknown Location',
            rating: review.rating,
            status: review.status,
            isVerified: true,
            publishDate: review.created_at,
            views: review.views || 0,
            image_urls: review.image_urls || [],
            review_text: review.review_text
          }));
          
          setUserReviews(formattedReviews);
          setLoadingReviews(false);
          
          // Fetch favorited AI businesses
          const favorites = await BusinessService.getUserFavorites(userData.id);
          setFavoritedAIBusinesses(favorites);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
        setLoadingReviews(false);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, []);

  // Calculate review progress for next level
  const getReviewProgress = (reviewCount: number) => {
    const reviewsPerLevel = 10;
    const currentLevelReviews = reviewCount % reviewsPerLevel;
    const progress = (currentLevelReviews / reviewsPerLevel) * 100;
    const reviewsNeeded = reviewsPerLevel - currentLevelReviews;
    
    return {
      progress,
      reviewsNeeded: reviewsNeeded === reviewsPerLevel ? 0 : reviewsNeeded,
      currentLevelReviews,
      totalForLevel: reviewsPerLevel
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-neutral-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
            Please Log In
          </h1>
          <p className="font-lora text-neutral-600">
            Access your dashboard by logging in to your account.
          </p>
        </div>
      </div>
    );
  }

  const reviewProgress = getReviewProgress(user.reviewCount);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Icons.User },
    { id: 'reviews', label: 'My Reviews', icon: Icons.ThumbsUp },
    { id: 'favorites', label: 'Favorites', icon: Icons.Heart },
    { id: 'businesses', label: 'My Businesses', icon: Icons.Award },
    { id: 'credits', label: 'Credits', icon: Icons.Zap }
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Tab Navigation - Sticky */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex flex-col items-center px-2 py-3 font-poppins text-xs font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'text-primary-600 border-b-2 border-primary-500'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <IconComponent className="h-5 w-5 mb-1" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">
                    {tab.id === 'overview' ? 'Home' : 
                     tab.id === 'reviews' ? 'Reviews' :
                     tab.id === 'favorites' ? 'Favorites' :
                     tab.id === 'businesses' ? 'Business' : 'Credits'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <Icons.ThumbsUp className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-poppins text-xl font-bold text-neutral-900">
                      {formatReviewCount(userReviews.length)}
                    </h3>
                    <p className="font-lora text-sm text-neutral-600">Total Reviews</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <Icons.Award className="h-5 w-5 text-accent-600" />
                  </div>
                  <div>
                    <h3 className="font-poppins text-xl font-bold text-neutral-900">
                      {user.level}
                    </h3>
                    <p className="font-lora text-sm text-neutral-600">Current Level</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <Icons.Eye className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-poppins text-xl font-bold text-neutral-900">
                      {formatStat(userReviews.reduce((total, review) => total + (review.views || 0), 0))}
                    </h3>
                    <p className="font-lora text-sm text-neutral-600">Total Views</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            {/* Review Level Progress */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 flex items-center">
                  <Icons.Award className="h-5 w-5 mr-2 text-primary-500" />
                  Level Progress
                </h3>
                <div className="flex items-center gap-2">
                  <div className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-poppins font-semibold">
                    Level {user.level}
                  </div>
                  <div className="bg-accent-100 text-accent-700 px-3 py-1 rounded-full text-sm font-poppins font-semibold">
                    {formatCredits(user.credits, user.role)} credits
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-lora text-neutral-600">
                    Reviews for Level {user.level}:
                  </span>
                  <span className="font-poppins font-semibold text-neutral-900">
                    {reviewProgress.currentLevelReviews} / {reviewProgress.totalForLevel}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-neutral-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-primary-500 to-accent-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${reviewProgress.progress}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="font-lora text-neutral-600">
                    Progress to Level {user.level + 1}
                  </span>
                  <span className="font-poppins font-semibold text-primary-600">
                    {reviewProgress.reviewsNeeded === 0 
                      ? 'Ready to level up!' 
                      : `${reviewProgress.reviewsNeeded} more reviews needed`
                    }
                  </span>
                </div>
              </div>
            </div>

            <RecentActivitySection />
          </div>
        )}

        {activeTab === 'reviews' && (
          <MyReviewsSection reviews={userReviews} />
        )}

        {activeTab === 'favorites' && (
          <MyFavoritesSection 
            businesses={favoritedAIBusinesses} 
            onRemoveFavorite={async (recommendationId) => {
              const success = await BusinessService.removeFavorite(recommendationId);
              if (success) {
                setFavoritedAIBusinesses(prev => prev.filter(b => b.id !== recommendationId));
              }
            }}
          />
        )}

        {activeTab === 'businesses' && (
          <MyBusinessesSection user={user} />
        )}

        {activeTab === 'credits' && (
          <div className="space-y-6">
            <CreditsManager 
              currentCredits={user.credits || 0}
             userRole={user.role}
              onPurchase={async (packageId, withAutoRefill) => {
                console.log('Purchase package:', packageId, 'with auto-refill:', withAutoRefill);
                await new Promise(resolve => setTimeout(resolve, 1500));
                return true;
              }}
            />
            
            <ReferralProgram 
              userId={parseInt(user.id)} 
              userName={user.name} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewerDashboardPage;