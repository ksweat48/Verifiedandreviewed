import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Building, Search, Filter, Brain,
  Settings, ChevronDown, Eye, Edit, Trash2, 
  Shield, AlertTriangle, CheckCircle, XCircle, 
  RefreshCw, BarChart2, TrendingUp, Calendar, 
  Clock, ArrowRight, EyeOff, MessageSquare, MapPin, Star
} from 'lucide-react';
import { BusinessService } from '../services/businessService';
import { supabase } from '../services/supabaseClient';
import type { Business } from '../services/supabaseClient';
import BusinessProfileModal from './BusinessProfileModal';

// Lazy load AI integration test components
const OpenAIConnectionTest = React.lazy(() => import('./OpenAIConnectionTest'));
const EmbeddingGenerationTest = React.lazy(() => import('./EmbeddingGenerationTest'));

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'businesses' | 'users' | 'reviews' | 'analytics' | 'ai-integrations' | 'settings'>('businesses');
  const [reviewsTab, setReviewsTab] = useState<'pending' | 'all'>('pending');
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [pendingBusinesses, setPendingBusinesses] = useState<Business[]>([]);
  const [verifiedBusinesses, setVerifiedBusinesses] = useState<Business[]>([]);
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [processingBusinessId, setProcessingBusinessId] = useState<string | null>(null);
  const [processingReviewId, setProcessingReviewId] = useState<string | null>(null);
  const [isBusinessProfileModalOpen, setIsBusinessProfileModalOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, [refreshTrigger]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch all businesses from Supabase
      const businesses = await BusinessService.getBusinesses({ adminView: true });
      setAllBusinesses(businesses);
      
      // Filter for pending and verified businesses
      const pending = businesses.filter(b => !b.is_verified);
      const verified = businesses.filter(b => b.is_verified);
      
      setPendingBusinesses(pending);
      setVerifiedBusinesses(verified);
      
      // Fetch users from Supabase
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*');
        
      if (userError) throw userError;
      setUsers(userData || []);
      
      // Fetch user reviews from Supabase
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('user_reviews')
        .select(`
          *,
          profiles!inner(name, email),
          businesses!inner(name, address)
        `)
        .order('created_at', { ascending: false });
        
      if (reviewsError) throw reviewsError;
      
      const formattedReviews = (reviewsData || []).map(review => ({
        id: review.id,
        userId: review.user_id,
        userName: review.profiles.name,
        userEmail: review.profiles.email,
        businessId: review.business_id,
        businessName: review.businesses.name,
        businessAddress: review.businesses.address,
        reviewText: review.review_text,
        rating: review.rating,
        status: review.status,
        imageUrls: review.image_urls || [],
        createdAt: review.created_at
      }));
      
      setUserReviews(formattedReviews);
      setPendingReviews(formattedReviews.filter(r => r.status === 'pending'));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleVerifyBusiness = async (businessId: string) => {
    setProcessingBusinessId(businessId);
    try {
      const success = await BusinessService.updateBusinessVerificationStatus(businessId, true);
      if (success) {
        // Update local state
        setAllBusinesses(prev => 
          prev.map(b => b.id === businessId ? { ...b, is_verified: true } : b)
        );
        setPendingBusinesses(prev => prev.filter(b => b.id !== businessId));
        setVerifiedBusinesses(prev => [
          ...prev, 
          allBusinesses.find(b => b.id === businessId)!
        ].filter(Boolean));
      }
    } catch (error) {
      console.error('Error verifying business:', error);
    } finally {
      setProcessingBusinessId(null);
    }
  };

  const handleRejectBusiness = async (businessId: string) => {
    // In a real app, this might move the business to a rejected state
    // For now, we'll just delete it
    await handleDeleteBusiness(businessId);
  };

  const handleDeleteBusiness = async (businessId: string) => {
    setProcessingBusinessId(businessId);
    try {
      const success = await BusinessService.deleteBusiness(businessId);
      if (success) {
        // Update local state
        setAllBusinesses(prev => prev.filter(b => b.id !== businessId));
        setPendingBusinesses(prev => prev.filter(b => b.id !== businessId));
        setVerifiedBusinesses(prev => prev.filter(b => b.id !== businessId));
      }
    } catch (error) {
      console.error('Error deleting business:', error);
    } finally {
      setProcessingBusinessId(null);
    }
  };

  const handleApproveReview = async (reviewId: string) => {
    setProcessingReviewId(reviewId);
    try {
      const { error } = await supabase
        .from('user_reviews')
        .update({ status: 'approved' })
        .eq('id', reviewId);
      
      if (error) throw error;
      
      // Update local state
      setUserReviews(prev => 
        prev.map(r => r.id === reviewId ? { ...r, status: 'approved' } : r)
      );
      setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (error) {
      console.error('Error approving review:', error);
    } finally {
      setProcessingReviewId(null);
    }
  };

  const handleRejectReview = async (reviewId: string) => {
    setProcessingReviewId(reviewId);
    try {
      const { error } = await supabase
        .from('user_reviews')
        .update({ status: 'rejected' })
        .eq('id', reviewId);
      
      if (error) throw error;
      
      // Update local state
      setUserReviews(prev => 
        prev.map(r => r.id === reviewId ? { ...r, status: 'rejected' } : r)
      );
      setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (error) {
      console.error('Error rejecting review:', error);
    } finally {
      setProcessingReviewId(null);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    setProcessingReviewId(reviewId);
    try {
      const { error } = await supabase
        .from('user_reviews')
        .delete()
        .eq('id', reviewId);
      
      if (error) throw error;
      
      // Update local state
      setUserReviews(prev => prev.filter(r => r.id !== reviewId));
      setPendingReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (error) {
      console.error('Error deleting review:', error);
    } finally {
      setProcessingReviewId(null);
    }
  };

  const handleToggleVisibility = async (businessId: string, currentVisibility: boolean) => {
    setProcessingBusinessId(businessId);
    try {
      const success = await BusinessService.updateBusinessVisibility(businessId, !currentVisibility);
      if (success) {
        // Update local state
        setAllBusinesses(prev => 
          prev.map(b => b.id === businessId ? { ...b, is_visible_on_platform: !currentVisibility } : b)
        );
        setPendingBusinesses(prev => 
          prev.map(b => b.id === businessId ? { ...b, is_visible_on_platform: !currentVisibility } : b)
        );
        setVerifiedBusinesses(prev => 
          prev.map(b => b.id === businessId ? { ...b, is_visible_on_platform: !currentVisibility } : b)
        );
      }
    } catch (error) {
      console.error('Error toggling business visibility:', error);
    } finally {
      setProcessingBusinessId(null);
    }
  };

  const handleViewBusiness = async (businessId: string) => {
    try {
      const business = await BusinessService.getBusinessById(businessId);
      if (business) {
        setSelectedBusinessForProfile(business);
        setIsBusinessProfileModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching business details:', error);
    }
  };

  const handleEditBusiness = (businessId: string) => {
    navigate(`/add-business?edit=${businessId}`);
  };

  const handleAddBusiness = () => {
    navigate('/add-business');
  };

  // Filter businesses based on search term and category
  const filterBusinesses = (businesses: Business[]) => {
    return businesses.filter(business => {
      const matchesSearch = searchTerm === '' || 
        business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (business.location && business.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (business.description && business.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || business.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  };

  const filteredAllBusinesses = filterBusinesses(allBusinesses);
  const filteredPendingBusinesses = filterBusinesses(pendingBusinesses);
  const filteredVerifiedBusinesses = filterBusinesses(verifiedBusinesses);

  // Calculate KPIs from real data
  const totalBusinesses = allBusinesses.length;
  const dailyActiveBusinesses = allBusinesses.filter(b => 
    b.is_visible_on_platform && new Date(b.updated_at).toDateString() === new Date().toDateString()
  ).length;
  
  // Calculate business growth (placeholder - in a real app this would compare to previous period)
  const businessGrowth = totalBusinesses > 0 ? '+5%' : '0%';

  const renderBusinessTable = (businesses: Business[], title: string, icon: React.ReactNode, count: number) => {
    return (
      <div className="mb-8">
        <div className="flex items-center mb-4">
          {icon}
          <h3 className="font-poppins text-xl font-semibold text-neutral-900 ml-2">
            {title} ({count})
          </h3>
        </div>
        
        {businesses.length === 0 ? (
          <div className="bg-neutral-50 rounded-lg p-6 text-center">
            <p className="font-lora text-neutral-600">No businesses found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Business</th>
                    <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Category</th>
                    <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Location</th>
                    <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Status</th>
                    <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Visibility</th>
                    <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4">
                        <div className="font-poppins font-semibold text-neutral-900">{business.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-lora text-neutral-600">{business.category || 'Uncategorized'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-lora text-neutral-600">{business.location || 'No location'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                          business.is_verified 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {business.is_verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleVisibility(business.id, business.is_visible_on_platform || false)}
                          disabled={processingBusinessId === business.id}
                          className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                            business.is_visible_on_platform 
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {processingBusinessId === business.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin inline" />
                          ) : business.is_visible_on_platform ? (
                            <>
                              <Eye className="h-3 w-3 inline mr-1" />
                              Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 inline mr-1" />
                              Hidden
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditBusiness(business.id)}
                            className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleViewBusiness(business.id)}
                            className="p-1 bg-neutral-500 text-white rounded hover:bg-neutral-600"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {!business.is_verified && (
                            <button
                              onClick={() => handleVerifyBusiness(business.id)}
                              disabled={processingBusinessId === business.id}
                              className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                              title="Verify"
                            >
                              {processingBusinessId === business.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Shield className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteBusiness(business.id)}
                            disabled={processingBusinessId === business.id}
                            className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                            title="Delete"
                          >
                            {processingBusinessId === business.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="font-cinzel text-3xl font-bold text-neutral-900">
            Dashboard
          </h1>
          <p className="font-lora text-neutral-600 mt-1">
            Monitor performance, manage businesses, and control platform settings
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-poppins font-medium whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <LayoutDashboard className="h-5 w-5 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('businesses')}
              className={`px-6 py-4 font-poppins font-medium whitespace-nowrap ${
                activeTab === 'businesses'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Building className="h-5 w-5 inline mr-2" />
              Businesses
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-4 font-poppins font-medium whitespace-nowrap ${
                activeTab === 'users'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Users className="h-5 w-5 inline mr-2" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-6 py-4 font-poppins font-medium whitespace-nowrap ${
                activeTab === 'reviews'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <MessageSquare className="h-5 w-5 inline mr-2" />
              Reviews ({pendingReviews.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-4 font-poppins font-medium whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <BarChart2 className="h-5 w-5 inline mr-2" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('ai-integrations')}
              className={`px-6 py-4 font-poppins font-medium whitespace-nowrap ${
                activeTab === 'ai-integrations'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Brain className="h-5 w-5 inline mr-2" />
              AI Integrations
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 font-poppins font-medium whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Settings className="h-5 w-5 inline mr-2" />
              Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div>
            <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6">
              Platform Overview
            </h2>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <Building className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-lora text-neutral-600">Total Businesses</p>
                    <p className="font-poppins text-2xl font-bold text-neutral-900">
                      {totalBusinesses}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                    <Clock className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-lora text-neutral-600">Daily Active Businesses</p>
                    <p className="font-poppins text-2xl font-bold text-neutral-900">
                      {dailyActiveBusinesses}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-lora text-neutral-600">Business Growth</p>
                    <p className="font-poppins text-2xl font-bold text-neutral-900">
                      {businessGrowth}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Recent Activity */}
            <div className="bg-white rounded-lg p-6 shadow-sm mb-8">
              <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
                Recent Activity
              </h3>
              
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-neutral-200 rounded w-full mb-4"></div>
                  <div className="h-8 bg-neutral-200 rounded w-full mb-4"></div>
                  <div className="h-8 bg-neutral-200 rounded w-full"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {allBusinesses.slice(0, 5).map((business, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-neutral-100">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                          business.is_verified ? 'bg-green-100' : 'bg-yellow-100'
                        }`}>
                          {business.is_verified ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-poppins font-semibold text-neutral-900">{business.name}</p>
                          <p className="font-lora text-sm text-neutral-600">
                            {business.is_verified ? 'Verified' : 'Pending verification'} • {new Date(business.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewBusiness(business.id)}
                        className="font-poppins text-primary-500 text-sm hover:text-primary-600"
                      >
                        View <ArrowRight className="h-4 w-4 inline" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'businesses' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
                Business Management
              </h2>
              
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search businesses..."
                    className="pl-10 pr-4 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="pl-4 pr-10 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Retail">Retail</option>
                    <option value="Service">Service</option>
                    <option value="Health & Wellness">Health & Wellness</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Professional">Professional</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400 pointer-events-none" />
                </div>
                
                <button
                  onClick={handleAddBusiness}
                  className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                >
                  Add Business
                </button>
                
                <button
                  onClick={handleRefreshData}
                  className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  title="Refresh Data"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <Building className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-lora text-neutral-600">Total Businesses</p>
                    <p className="font-poppins text-2xl font-bold text-neutral-900">
                      {totalBusinesses}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                    <Clock className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-lora text-neutral-600">Daily Active Businesses</p>
                    <p className="font-poppins text-2xl font-bold text-neutral-900">
                      {dailyActiveBusinesses}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-lora text-neutral-600">Business Growth</p>
                    <p className="font-poppins text-2xl font-bold text-neutral-900">
                      {businessGrowth}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* All Platform Businesses */}
            {renderBusinessTable(
              filteredAllBusinesses,
              'All Platform Businesses',
              <Building className="h-6 w-6 text-blue-500" />,
              filteredAllBusinesses.length
            )}
            
            {/* Pending Approval */}
            {renderBusinessTable(
              filteredPendingBusinesses,
              'Pending Approval',
              <AlertTriangle className="h-6 w-6 text-yellow-500" />,
              filteredPendingBusinesses.length
            )}
            
            {/* Verified Businesses */}
            {renderBusinessTable(
              filteredVerifiedBusinesses,
              'Verified Businesses',
              <Shield className="h-6 w-6 text-green-500" />,
              filteredVerifiedBusinesses.length
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6">
              User Management
            </h2>
            
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-64 bg-neutral-200 rounded-lg"></div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr>
                        <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Name</th>
                        <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Email</th>
                        <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Role</th>
                        <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Level</th>
                        <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Credits</th>
                        <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Joined</th>
                        <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-neutral-50">
                          <td className="px-6 py-4">
                            <div className="font-poppins font-semibold text-neutral-900">{user.name || 'Unnamed User'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-lora text-neutral-600">{user.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                              user.role === 'admin' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {user.role || 'user'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-poppins font-semibold text-neutral-900">{user.level || 1}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-poppins font-semibold text-neutral-900">{user.credits || 0}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-lora text-neutral-600">
                              {new Date(user.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => alert(`View user profile for ${user.name || 'Unnamed User'}`)}
                                className="p-1 bg-neutral-500 text-white rounded hover:bg-neutral-600"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => alert(`Edit user ${user.name || 'Unnamed User'}`)}
                                className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
                Review Management
              </h2>
              
              <div className="flex space-x-1 bg-neutral-100 rounded-lg p-1">
                <button
                  onClick={() => setReviewsTab('pending')}
                  className={`px-4 py-2 rounded-md font-poppins font-medium transition-colors duration-200 ${
                    reviewsTab === 'pending'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Pending ({pendingReviews.length})
                </button>
                <button
                  onClick={() => setReviewsTab('all')}
                  className={`px-4 py-2 rounded-md font-poppins font-medium transition-colors duration-200 ${
                    reviewsTab === 'all'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  All Reviews ({userReviews.length})
                </button>
              </div>
            </div>
            
            {/* Reviews Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Business</th>
                      <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Reviewer</th>
                      <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Rating</th>
                      <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Status</th>
                      <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Date</th>
                      <th className="px-6 py-3 text-left font-poppins text-sm font-semibold text-neutral-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {(reviewsTab === 'pending' ? pendingReviews : userReviews).map((review) => (
                      <tr key={review.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-poppins font-semibold text-neutral-900">
                              {review.businessName}
                            </div>
                            <div className="font-lora text-sm text-neutral-600 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {review.businessAddress}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-poppins font-semibold text-neutral-900">{review.userName}</div>
                            <div className="font-lora text-sm text-neutral-600">{review.userEmail}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex text-yellow-400 mr-2">
                              {[...Array(review.rating)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-current" />
                              ))}
                            </div>
                            <span className="font-poppins text-sm font-semibold">
                              {review.rating}/5
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                            review.status === 'approved' 
                              ? 'bg-green-100 text-green-700' 
                              : review.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : review.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {review.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-lora text-sm text-neutral-600 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(review.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => alert(`Review: "${review.reviewText}"`)}
                              className="p-1 bg-neutral-500 text-white rounded hover:bg-neutral-600"
                              title="View Review"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            {review.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveReview(review.id)}
                                  disabled={processingReviewId === review.id}
                                  className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                                  title="Approve Review"
                                >
                                  {processingReviewId === review.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleRejectReview(review.id)}
                                  disabled={processingReviewId === review.id}
                                  className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                  title="Reject Review"
                                >
                                  {processingReviewId === review.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                </button>
                              </>
                            )}
                            
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              disabled={processingReviewId === review.id}
                              className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                              title="Delete Review"
                            >
                              {processingReviewId === review.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {(reviewsTab === 'pending' ? pendingReviews : userReviews).length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                  <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                    {reviewsTab === 'pending' ? 'No Pending Reviews' : 'No Reviews Found'}
                  </h3>
                  <p className="font-lora text-neutral-600">
                    {reviewsTab === 'pending' 
                      ? 'All reviews have been processed.' 
                      : 'No user reviews have been submitted yet.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6">
              Analytics
            </h2>
            
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="font-lora text-neutral-600 text-center py-12">
                Analytics dashboard coming soon
              </p>
            </div>
          </div>
        )}

        {activeTab === 'ai-integrations' && (
          <div>
            <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6">
              AI Integrations
            </h2>
            
            <div className="space-y-8">
              {/* OpenAI Connection Test */}
              <div>
                <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-4">
                  OpenAI API Connection
                </h3>
                <React.Suspense fallback={
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
                    <div className="animate-pulse">
                      <div className="h-8 bg-neutral-200 rounded w-1/3 mb-4"></div>
                      <div className="h-4 bg-neutral-200 rounded w-full mb-2"></div>
                      <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                    </div>
                  </div>
                }>
                  <OpenAIConnectionTest />
                </React.Suspense>
              </div>
              
              {/* Embedding Generation Test */}
              <div>
                <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-4">
                  Embedding Generation
                </h3>
                <React.Suspense fallback={
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-neutral-200">
                    <div className="animate-pulse">
                      <div className="h-8 bg-neutral-200 rounded w-1/3 mb-4"></div>
                      <div className="h-4 bg-neutral-200 rounded w-full mb-2"></div>
                      <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                    </div>
                  </div>
                }>
                  <EmbeddingGenerationTest />
                </React.Suspense>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div>
            <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-6">
              Platform Settings
            </h2>
            
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="font-lora text-neutral-600 text-center py-12">
                Settings dashboard coming soon
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Business Profile Modal */}
      <BusinessProfileModal
        isOpen={isBusinessProfileModalOpen}
        onClose={() => setIsBusinessProfileModalOpen(false)}
        business={selectedBusinessForProfile}
      />
    </div>
  );
};

export default AdminDashboard;