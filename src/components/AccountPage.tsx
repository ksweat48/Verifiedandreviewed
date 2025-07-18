import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { UserService } from '../services/userService';
import type { User } from '../types/user';
import CreditsManager from '../components/CreditsManager';

const AccountPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await UserService.getCurrentUser();
        setUser(userData);
      } catch (err) {
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Handle profile update logic
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Handle password update logic
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Handle avatar change logic
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm">
        <div className="md:flex">
          {/* Sidebar */}
          <div className="md:w-1/4 p-6 border-r border-neutral-200">
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-4">
                <img
                  src={user?.avatar || '/default-avatar.png'}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
                <label className="absolute bottom-0 right-0 bg-primary-500 text-white p-2 rounded-full cursor-pointer hover:bg-primary-600 transition-colors duration-200">
                  <Icons.Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
              <h2 className="font-poppins font-semibold text-xl text-neutral-800">
                {user?.name}
              </h2>
              <p className="text-neutral-500">{user?.email}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center px-4 py-3 rounded-lg font-poppins font-medium transition-colors duration-200 ${
                  activeTab === 'profile'
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icons.User className="h-5 w-5 mr-3" />
                Profile Information
              </button>
                
              <button
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center px-4 py-3 rounded-lg font-poppins font-medium transition-colors duration-200 ${
                  activeTab === 'security'
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icons.Lock className="h-5 w-5 mr-3" />
                Password & Security
              </button>
                
              <button
                onClick={() => setActiveTab('credits')}
                className={`w-full flex items-center px-4 py-3 rounded-lg font-poppins font-medium transition-colors duration-200 ${
                  activeTab === 'credits'
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icons.Zap className="h-5 w-5 mr-3" />
                Credits
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:w-3/4 p-6">
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <h3 className="font-poppins font-semibold text-2xl text-neutral-800 mb-6">
                  Profile Information
                </h3>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <Icons.X className="h-5 w-5 text-red-500 mr-2" />
                      <p className="font-lora text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <Icons.Save className="h-5 w-5 text-green-500 mr-2" />
                      <p className="font-lora text-green-700">{success}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="block font-poppins font-medium text-neutral-700"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <Icons.User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <input
                      type="text"
                      name="name"
                      id="name"
                      defaultValue={user?.name}
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block font-poppins font-medium text-neutral-700"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Icons.Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <input
                      type="email"
                      name="email"
                      id="email"
                      defaultValue={user?.email}
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary-500 text-white font-poppins font-medium py-2 px-4 rounded-lg hover:bg-primary-600 transition-colors duration-200"
                >
                  Save Changes
                </button>
              </form>
            )}

            {activeTab === 'security' && (
              <form onSubmit={handlePasswordUpdate} className="space-y-6">
                <h3 className="font-poppins font-semibold text-2xl text-neutral-800 mb-6">
                  Password & Security
                </h3>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <Icons.X className="h-5 w-5 text-red-500 mr-2" />
                      <p className="font-lora text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <Icons.Save className="h-5 w-5 text-green-500 mr-2" />
                      <p className="font-lora text-green-700">{success}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="currentPassword"
                    className="block font-poppins font-medium text-neutral-700"
                  >
                    Current Password
                  </label>
                  <div className="relative">
                    <Icons.Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <input
                      type="password"
                      name="currentPassword"
                      id="currentPassword"
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="newPassword"
                    className="block font-poppins font-medium text-neutral-700"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Icons.Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <input
                      type="password"
                      name="newPassword"
                      id="newPassword"
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirmPassword"
                    className="block font-poppins font-medium text-neutral-700"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Icons.Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <input
                      type="password"
                      name="confirmPassword"
                      id="confirmPassword"
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary-500 text-white font-poppins font-medium py-2 px-4 rounded-lg hover:bg-primary-600 transition-colors duration-200"
                >
                  Update Password
                </button>
              </form>
            )}

            {activeTab === 'credits' && <CreditsManager />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;