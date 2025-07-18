import React, { useState, useEffect } from 'react';
import { Camera, Star, Zap, Eye, Building, Plus } from 'lucide-react';
import RecentActivitySection from './RecentActivitySection';
import MyReviewsSection from './MyReviewsSection';
import CreditUsageInfo from './CreditUsageInfo';
import MyBusinessesSection from './MyBusinessesSection';
import { BusinessService } from '../services/businessService';
import { addMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  credits?: number;
  reviewCount: number;
  level: number;
  joinDate: string;
  bio?: string;
  role?: string;
}

interface UserReview {
  id: number;
  businessName: string;
  location: string;
  rating: number;
  status: 'published' | 'pending' | 'draft';
  isVerified: boolean;
  publishDate: string;
  views: number;
}

interface UserDashboardProps {
  user: UserProfile | null;
  loading?: boolean;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ 
  user: propUser, 
  loading: propLoading = false 
}) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(propUser);
  const [activeTab, setActiveTab] = useState<'overview' | 'my-reviews' | 'my-businesses'>('overview'); 
  const [myBusinessesCount, setMyBusinessesCount] = useState(0);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(propLoading);

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
      setLoading(false);
    } else if (!loading) {
      loadUserData();
    }
  }, [propUser, loading]);

  // Fetch user's businesses count
  useEffect(() => {
    const fetchMyBusinessesCount = async () => {
      if (user && user.id) {
        try {
          const userBusinesses = await BusinessService.getUserBusinesses(user.id);
          setMyBusinessesCount(userBusinesses.length);
        } catch (err) {
          console.error('Error fetching user businesses count:', err);
          setMyBusinessesCount(0); // Fallback to 0 on error
        }
      }
    };
    fetchMyBusinessesCount();
  }, [user]);

  const loadUserData = () => {
    // Instead of using mock data, we'll fetch real data
    if (user && user.id) {
      // Fetch user's reviews
      const fetchUserReviews = async () => {
        try {
          const { data, error } = await supabase
            .from('user_reviews')
            .select('*, businesses(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
            
          if (error) throw error;
          
          if (data) {
            const formattedReviews = data.map(review => ({
              id: review.id,
              businessName: review.businesses?.name || 'Unknown Business',
              location: review.businesses?.location || 'Unknown Location',
              rating: review.rating,
              status: review.status,
              isVerified: review.businesses?.is_verified || false,
              publishDate: review.created_at,
              views: 0 // We don't track views yet
            }));
            
            setReviews(formattedReviews);
          }
        } catch (err) {
          console.error('Error fetching user reviews:', err);
          setReviews([]);
        }
      };
      
      fetchUserReviews();
    } else {
      setReviews([]);
    }
  };

  const getNextLevelProgress = () => {
    if (!user) return 0;
    const reviewsInCurrentLevel = user.reviewCount % 10;
    return (reviewsInCurrentLevel / 10) * 100;
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Handle avatar upload (integrate with WordPress media library)
      const reader = new FileReader();
      reader.onload = (e) => {
        if (user) {
          setUser({ ...user, avatar: e.target?.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddBusiness = () => {
    navigate('/add-business');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-neutral-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative">
                <img
                  src={user.avatar}
                  alt={user.name || "User"}
                  className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <label className="absolute bottom-0 right-0 bg-primary-500 text-white p-1 rounded-full cursor-pointer hover:bg-primary-600 transition-colors duration-200">
                  <Camera className="h-3 w-3" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
              
              <div className="ml-4">
                <h1 className="font-cinzel text-2xl font-bold text-neutral-900">
                  {user.name}
                </h1>
                <div className="flex items-center gap-4 mt-1">
                  <span className="font-lora text-neutral-600">Level {user.level} Reviewer</span>
                  <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-semibold">
                    {user.credits >= 999999 ? 'Unlimited Credits' : 'Available Credits'}
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleAddBusiness}
              className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Business
            </button>
          </div>
          
          {/* Credits Overview */}
          <div className="mt-6 bg-white rounded-lg p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Zap className="h-5 w-5 text-primary-500 mr-2" />
                <span className="font-poppins text-sm font-semibold text-neutral-700">
                  {user.role === 'administrator' || user.credits >= 999999 ? 'Unlimited Credits' : 'Available Credits'}
                </span>
              </div>
                {user.role === 'administrator' || user.credits >= 999999 ? (
                  <div className="bg-yellow-50 px-3 py-1 rounded-full">
                    <span className="font-poppins text-lg font-bold text-yellow-700">
                      {user.role === 'administrator' ? '∞ Admin' : '∞'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-primary-50 px-3 py-1 rounded-full">
                    <span className="font-poppins text-lg font-bold text-primary-700">
                      {user.credits || 0}
                    </span>
                  </div>
                )}
            </div>
            
            {user.role !== 'administrator' && user.credits < 999999 && (
              <div className="text-xs text-neutral-500 mb-3">
                Next refill: {addMonths(new Date(user.joinDate), 1).toLocaleDateString()} • +100 credits
              </div>
            )}
            
            {user.role !== 'administrator' && user.credits < 999999 && <CreditUsageInfo />}
            
            {(user.role === 'administrator' || user.credits >= 999999) && (
              <div className="bg-yellow-100 rounded-lg p-3 mt-3">
                <p className="font-lora text-sm text-yellow-800">
                  {user.role === 'administrator' 
                    ? 'Administrator account with unlimited credits and full platform access.' 
                    : 'Account with unlimited credits.'}
                </p>
              </div>
            )}
          </div>

          {/* Level Progress */}
          <div className="mt-6 bg-neutral-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-poppins text-sm font-semibold text-neutral-700">
                Progress to Level {user.level + 1}
              </span>
              <span className="font-lora text-sm text-neutral-600">
                {user.reviewCount % 10}/10 reviews
              </span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getNextLevelProgress()}%` }}
              ></div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6">
            <div className="flex space-x-1 bg-neutral-100 rounded-lg p-1">
              {[
                { id: 'overview', name: 'Overview' },
                { id: 'my-reviews', name: 'My Reviews' },
                { id: 'my-businesses', name: 'My Businesses' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 px-4 rounded-md font-poppins font-medium transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Stats Cards */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Star className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-lora text-sm text-neutral-600">Total Reviews</p> 
                    <p className="font-poppins text-2xl font-bold text-neutral-900">
                      {user.role === 'administrator' ? '∞' : user.reviewCount}
                    </p>
                  </div>
                  {user.role !== 'administrator' && user.credits < 999999 && (
                    <div className="flex flex-col items-end">
                      <p className="font-lora text-xs text-neutral-500">Credits earned</p>
                      <p className="font-poppins text-sm font-semibold text-primary-600">
                        +{user.reviewCount} <Zap className="h-3 w-3 inline" />
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Eye className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-lora text-sm text-neutral-600">Total Views</p>
                    <p className="font-poppins text-2xl font-bold text-neutral-900">
                      {user.role === 'administrator' ? '∞' : user.reviewCount * 10}
                    </p>
                  </div>
                  {user.role !== 'administrator' && user.credits < 999999 && (
                    <div className="flex flex-col items-end">
                      <p className="font-lora text-xs text-neutral-500">Credits earned</p>
                      <p className="font-poppins text-sm font-semibold text-primary-600">
                        +{user.reviewCount} <Zap className="h-3 w-3 inline" />
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="font-lora text-sm text-neutral-600">My Businesses</p>
                    <div className="flex items-center">
                      <p className="font-poppins text-2xl font-bold text-neutral-900 mr-3">
                        {myBusinessesCount}
                      </p>
                      <button
                        onClick={handleAddBusiness}
                        className="bg-blue-100 text-blue-600 p-1 rounded-full hover:bg-blue-200 transition-colors duration-200"
                        title="Add Business"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Section */}
            <RecentActivitySection />
          </div>
        )}

        {/* My Businesses Tab */}
        {activeTab === 'my-businesses' && (
          <MyBusinessesSection user={user} />
        )}

        {/* Reviews Tab */}
        {activeTab === 'my-reviews' && (
          <MyReviewsSection reviews={reviews} />
        )}
      </div>
    </div>
  );
};

export default UserDashboard;