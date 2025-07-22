import React, { useState, useEffect } from 'react';
import { User, Zap, Award, Calendar, MapPin, ThumbsUp, ThumbsDown, Edit, Trash2, Eye } from 'lucide-react';
import { UserService } from '../services/userService';
import { ReviewService } from '../services/reviewService';
import type { User as UserType } from '../types/user';
import MyBusinessesSection from '../components/MyBusinessesSection';
import MyReviewsSection from '../components/MyReviewsSection';
import RecentActivitySection from '../components/RecentActivitySection';
import CreditsManager from '../components/CreditsManager';
import ReferralProgram from '../components/ReferralProgram';

const ReviewerDashboardPage = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'businesses' | 'credits'>('overview');
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

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
            views: Math.floor(Math.random() * 100) + 10,
            image_urls: review.image_urls || [],
            review_text: review.review_text
          }));
          
          setUserReviews(formattedReviews);
          setLoadingReviews(false);
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'reviews', label: 'My Reviews', icon: ThumbsUp },
    { id: 'businesses', label: 'My Businesses', icon: Award },
    { id: 'credits', label: 'Credits', icon: Zap }
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-cinzel text-3xl font-bold text-neutral-900">
                Dashboard
              </h1>
              <p className="font-lora text-neutral-600 mt-1">
                Welcome back, {user.name}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="bg-primary-100 text-primary-700 px-4 py-2 rounded-lg">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-2" />
                  <span className="font-poppins font-semibold">
                    {user.credits || 0} credits
                  </span>
                </div>
              </div>
              
              <div className="bg-accent-100 text-accent-700 px-4 py-2 rounded-lg">
                <div className="flex items-center">
                  <Award className="h-4 w-4 mr-2" />
                  <span className="font-poppins font-semibold">
                    Level {user.level}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 mb-6">
              <div className="flex flex-col items-center">
                <img
                  src={user.avatar || 'https://images.pexels.com/photos/1126993/pexels-photo-1126993.jpeg?auto=compress&cs=tinysrgb&w=100'}
                  alt={user.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg mb-4"
                />
                <h2 className="font-poppins text-xl font-semibold text-neutral-900 mb-1">
                  {user.name}
                </h2>
                <p className="font-lora text-neutral-600 mb-2">
                  Level {user.level} Reviewer
                </p>
                <div className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-poppins font-semibold">
                  {user.reviewCount} Reviews
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200">
              <div className="p-2">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full flex items-center px-4 py-3 rounded-lg font-poppins font-medium transition-colors duration-200 ${
                        activeTab === tab.id
                          ? 'bg-primary-50 text-primary-600'
                          : 'text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <IconComponent className="h-5 w-5 mr-3" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                        <ThumbsUp className="h-6 w-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-poppins text-2xl font-bold text-neutral-900">
                          {user.reviewCount}
                        </h3>
                        <p className="font-lora text-neutral-600">Total Reviews</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center mr-4">
                        <Award className="h-6 w-6 text-accent-600" />
                      </div>
                      <div>
                        <h3 className="font-poppins text-2xl font-bold text-neutral-900">
                          {user.level}
                        </h3>
                        <p className="font-lora text-neutral-600">Current Level</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                        <Zap className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-poppins text-2xl font-bold text-neutral-900">
                          {user.credits || 0}
                        </h3>
                        <p className="font-lora text-neutral-600">Credits</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <RecentActivitySection />
              </div>
            )}

            {activeTab === 'reviews' && (
              <MyReviewsSection reviews={userReviews} />
            )}

            {activeTab === 'businesses' && (
              <MyBusinessesSection user={user} />
            )}

            {activeTab === 'credits' && (
              <div className="space-y-8">
                <CreditsManager 
                  currentCredits={user.credits || 0}
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
      </div>
    </div>
  );
};

export default ReviewerDashboardPage;