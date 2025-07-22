import React, { useState, useEffect } from 'react';
import { Users, Building, MessageSquare, Settings, BarChart3, Shield, Zap, RefreshCw } from 'lucide-react';
import { BusinessService } from '../services/businessService';
import { ReviewService } from '../services/reviewService';
import { UserService } from '../services/userService';
import EmbeddingGenerationTest from './EmbeddingGenerationTest';
import OpenAIConnectionTest from './OpenAIConnectionTest';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'businesses' | 'reviews' | 'users' | 'tools'>('overview');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    verifiedBusinesses: 0,
    pendingReviews: 0,
    totalUsers: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load businesses
      const businessData = await BusinessService.getBusinesses({ adminView: true });
      setBusinesses(businessData);
      
      // Load pending reviews
      const reviewData = await ReviewService.getPendingReviews();
      setPendingReviews(reviewData);
      
      // Calculate stats
      setStats({
        totalBusinesses: businessData.length,
        verifiedBusinesses: businessData.filter(b => b.is_verified).length,
        pendingReviews: reviewData.length,
        totalUsers: 150 // Mock data
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReview = async (reviewId: string) => {
    const success = await ReviewService.approveReview(reviewId);
    if (success) {
      setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
      setStats(prev => ({ ...prev, pendingReviews: prev.pendingReviews - 1 }));
    }
  };

  const handleRejectReview = async (reviewId: string) => {
    const success = await ReviewService.rejectReview(reviewId);
    if (success) {
      setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
      setStats(prev => ({ ...prev, pendingReviews: prev.pendingReviews - 1 }));
    }
  };

  const handleToggleBusinessVerification = async (businessId: string, currentStatus: boolean) => {
    const success = await BusinessService.updateBusinessVerificationStatus(businessId, !currentStatus);
    if (success) {
      setBusinesses(prev => prev.map(b => 
        b.id === businessId ? { ...b, is_verified: !currentStatus } : b
      ));
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'businesses', label: 'Businesses', icon: Building },
    { id: 'reviews', label: 'Reviews', icon: MessageSquare },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'tools', label: 'Tools', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-cinzel text-3xl font-bold text-neutral-900">
                Admin Dashboard
              </h1>
              <p className="font-lora text-neutral-600 mt-1">
                Manage businesses, reviews, and platform settings
              </p>
            </div>
            
            <button
              onClick={loadDashboardData}
              className="flex items-center font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                        <Building className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-poppins text-2xl font-bold text-neutral-900">
                          {stats.totalBusinesses}
                        </h3>
                        <p className="font-lora text-neutral-600">Total Businesses</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                        <Shield className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-poppins text-2xl font-bold text-neutral-900">
                          {stats.verifiedBusinesses}
                        </h3>
                        <p className="font-lora text-neutral-600">Verified</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                        <MessageSquare className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div>
                        <h3 className="font-poppins text-2xl font-bold text-neutral-900">
                          {stats.pendingReviews}
                        </h3>
                        <p className="font-lora text-neutral-600">Pending Reviews</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                        <Users className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-poppins text-2xl font-bold text-neutral-900">
                          {stats.totalUsers}
                        </h3>
                        <p className="font-lora text-neutral-600">Total Users</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'businesses' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6">
                  Manage Businesses
                </h3>
                
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-neutral-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {businesses.map((business) => (
                      <div key={business.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
                        <div>
                          <h4 className="font-poppins font-semibold text-neutral-900">
                            {business.name}
                          </h4>
                          <p className="font-lora text-sm text-neutral-600">
                            {business.location} • {business.category}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-poppins font-semibold ${
                            business.is_verified 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {business.is_verified ? 'Verified' : 'Pending'}
                          </span>
                          
                          <button
                            onClick={() => handleToggleBusinessVerification(business.id, business.is_verified)}
                            className="font-poppins bg-primary-500 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-primary-600 transition-colors duration-200"
                          >
                            {business.is_verified ? 'Unverify' : 'Verify'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6">
                  Pending Reviews ({pendingReviews.length})
                </h3>
                
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-neutral-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : pendingReviews.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <p className="font-lora text-neutral-600">No pending reviews</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingReviews.map((review) => (
                      <div key={review.id} className="border border-neutral-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-poppins font-semibold text-neutral-900">
                              {review.businesses?.name || 'Unknown Business'}
                            </h4>
                            <p className="font-lora text-sm text-neutral-600 mb-2">
                              By {review.profiles?.name || 'Anonymous'} • {review.profiles?.email}
                            </p>
                            <p className="font-lora text-neutral-700">
                              {review.review_text}
                            </p>
                          </div>
                          
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleApproveReview(review.id)}
                              className="font-poppins bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors duration-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectReview(review.id)}
                              className="font-poppins bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors duration-200"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6">
                  User Management
                </h3>
                <p className="font-lora text-neutral-600">
                  User management features coming soon...
                </p>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="space-y-8">
                <OpenAIConnectionTest />
                <EmbeddingGenerationTest />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;