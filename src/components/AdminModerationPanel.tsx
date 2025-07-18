import React, { useState, useEffect } from 'react';
import { Search, Calendar, Eye, Edit, Trash2, Star, Award, Shield, Check, X } from 'lucide-react';
import { mockModerationData } from '../data/mockData';

interface ModUser {
  id: number;
  name: string;
  email: string;
  role: string;
  reviewCount: number;
  level: number;
  joinDate: string;
  status: 'active' | 'inactive';
}

interface ModReview {
  id: number;
  userId: number;
  userName: string;
  businessName: string;
  businessAddress: string;
  rating: number;
  status: 'published' | 'pending' | 'draft';
  isVerified: boolean;
  publishDate: string;
  views: number;
  content: string;
}

const AdminModerationPanel = () => {
  const [users, setUsers] = useState<ModUser[]>(mockModerationData.users);
  const [reviews, setReviews] = useState<ModReview[]>(mockModerationData.reviews);
  const [activeTab, setActiveTab] = useState<'users' | 'reviews'>('reviews');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReviews, setSelectedReviews] = useState<number[]>([]);

  const handleReviewAction = (reviewId: number, action: 'approve' | 'reject' | 'verify' | 'delete') => {
    setReviews(prev => prev.map(review => {
      if (review.id === reviewId) {
        switch (action) {
          case 'approve':
            return { ...review, status: 'published' as const };
          case 'reject':
            return { ...review, status: 'draft' as const };
          case 'verify':
            return { ...review, isVerified: true };
          case 'delete':
            return review; // Handle deletion separately
          default:
            return review;
        }
      }
      return review;
    }));

    if (action === 'delete') {
      setReviews(prev => prev.filter(review => review.id !== reviewId));
    }
  };

  const handleBulkAction = (action: 'approve' | 'reject' | 'delete') => {
    if (selectedReviews.length === 0) return;

    selectedReviews.forEach(reviewId => {
      handleReviewAction(reviewId, action);
    });

    setSelectedReviews([]);
  };

  const toggleReviewSelection = (reviewId: number) => {
    setSelectedReviews(prev => 
      prev.includes(reviewId) 
        ? prev.filter(id => id !== reviewId)
        : [...prev, reviewId]
    );
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = review.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.businessAddress.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || review.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string, isVerified: boolean) => {
    if (isVerified) {
      return (
        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold flex items-center">
          <Icons.Shield className="h-3 w-3 mr-1" />
          Verified
        </span>
      );
    }
    
    switch (status) {
      case 'published':
        return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">Published</span>;
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">Pending</span>;
      case 'draft':
        return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">Draft</span>;
      default:
        return null;
    }
  };

  const getUserLevelBadge = (level: number) => {
    const colors = {
      1: 'bg-gray-100 text-gray-700',
      2: 'bg-blue-100 text-blue-700',
      3: 'bg-green-100 text-green-700',
      4: 'bg-purple-100 text-purple-700',
      5: 'bg-yellow-100 text-yellow-700'
    };
    
    return (
      <span className={`${colors[level as keyof typeof colors] || colors[5]} px-2 py-1 rounded-full text-xs font-semibold flex items-center`}>
        <Icons.Award className="h-3 w-3 mr-1" />
        Level {level}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
            Moderation Panel
          </h2>
          <p className="font-lora text-neutral-600">
            Manage users and moderate review submissions
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex space-x-1 bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-4 py-2 rounded-md font-poppins font-medium transition-colors duration-200 ${
                activeTab === 'reviews'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Reviews ({reviews.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-md font-poppins font-medium transition-colors duration-200 ${
                activeTab === 'users'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Users ({users.length})
            </button>
          </div>
        </div>
      </div>

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {/* Filters and Search */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search reviews by business name, reviewer, or location..."
                    className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
                
                {selectedReviews.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="font-poppins text-sm text-neutral-600">
                      {selectedReviews.length} selected
                    </span>
                    <button
                      onClick={() => handleBulkAction('approve')}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg font-poppins text-sm font-semibold hover:bg-green-600 transition-colors duration-200"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleBulkAction('reject')}
                      className="bg-yellow-500 text-white px-3 py-2 rounded-lg font-poppins text-sm font-semibold hover:bg-yellow-600 transition-colors duration-200"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg font-poppins text-sm font-semibold hover:bg-red-600 transition-colors duration-200"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReviews(filteredReviews.map(r => r.id));
                          } else {
                            setSelectedReviews([]);
                          }
                        }}
                        className="rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                      Business
                    </th>
                    <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                      Reviewer
                    </th>
                    <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                      Rating
                    </th>
                    <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredReviews.map((review) => (
                    <tr key={review.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedReviews.includes(review.id)}
                          onChange={() => toggleReviewSelection(review.id)}
                          className="rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                        />
                      </td>
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
                        <div className="font-lora text-neutral-900">{review.userName}</div>
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
                        {getStatusBadge(review.status, review.isVerified)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-lora text-sm text-neutral-600 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(review.publishDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => alert('View review details')}
                            className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="View"
                          >
                            <Icons.Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => alert('Edit review')}
                            className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                            title="Edit"
                          >
                            <Icons.Edit className="h-4 w-4" />
                          </button>
                          {!review.isVerified && (
                            <button
                              onClick={() => handleReviewAction(review.id, 'verify')}
                              className="p-2 text-neutral-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                              title="Mark as Verified"
                            >
                              <Icons.Shield className="h-4 w-4" />
                            </button>
                          )}
                          {review.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleReviewAction(review.id, 'approve')}
                                className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleReviewAction(review.id, 'reject')}
                                className="p-2 text-neutral-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors duration-200"
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleReviewAction(review.id, 'delete')}
                            className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                    User
                  </th>
                  <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                    Level
                  </th>
                  <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                    Reviews
                  </th>
                  <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                    Join Date
                  </th>
                  <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left font-poppins text-sm font-semibold text-neutral-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-poppins font-semibold text-neutral-900">
                          {user.name}
                        </div>
                        <div className="font-lora text-sm text-neutral-600">
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getUserLevelBadge(user.level)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-poppins font-semibold text-neutral-900">
                        {user.reviewCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-lora text-sm text-neutral-600">
                        {new Date(user.joinDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => alert('View user profile')}
                          className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => alert('Edit user')}
                          className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                          title="Edit User"
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
  );
};

export default AdminModerationPanel;