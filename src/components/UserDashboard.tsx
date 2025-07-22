import React from 'react';
import { User, Star, MapPin, Calendar, Award } from 'lucide-react';
import type { User as UserType } from '../types/user';

interface UserDashboardProps {
  user: UserType | null;
  loading: boolean;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, loading }) => {
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No user data</h3>
          <p className="mt-1 text-sm text-gray-500">Unable to load user information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name || 'User'}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-blue-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user.name || 'Anonymous User'}
              </h1>
              <p className="text-gray-600">{user.email}</p>
              <div className="flex items-center mt-2 space-x-4">
                <div className="flex items-center text-sm text-gray-500">
                  <Award className="h-4 w-4 mr-1" />
                  Level {user.level}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Star className="h-4 w-4 mr-1" />
                  {user.review_count} Reviews
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Star className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Reviews</p>
                <p className="text-2xl font-semibold text-gray-900">{user.review_count}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Award className="h-8 w-8 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Current Level</p>
                <p className="text-2xl font-semibold text-gray-900">{user.level}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Member Since</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {user.created_at ? new Date(user.created_at).getFullYear() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        {user.bio && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-3">About</h2>
            <p className="text-gray-600">{user.bio}</p>
          </div>
        )}

        {/* Recent Activity Placeholder */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
          <div className="text-center py-8">
            <MapPin className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start exploring and reviewing businesses to see your activity here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;