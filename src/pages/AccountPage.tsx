import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Camera, CreditCard, Save, X, Zap, Award } from 'lucide-react';
import { UserService } from '../services/userService';
import type { User as UserType } from '../types/user';
import CreditsManager from '../components/CreditsManager';
import ReferralProgram from '../components/ReferralProgram';
import { supabase } from '../services/supabaseClient';
import { formatCredits, formatReviewCount } from '../utils/formatters';

const AccountPage = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'credits'>('profile');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const userData = await UserService.getCurrentUser();
      if (userData) {
        setUser(userData);
        setFormData({
          ...formData,
          name: userData.name,
          email: userData.email,
          bio: userData.bio || ''
        });
      }
    } catch (error) {
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploadingAvatar(true);
    setAvatarError(null);
    setError('');
    setSuccess('');
    
    // Create a preview immediately for better UX
    const reader = new FileReader();
    reader.onload = (e) => {
      if (user) {
        setUser({ ...user, avatar: e.target?.result as string });
      }
    };
    reader.readAsDataURL(file);
    
    // Upload to storage
    const uploadAvatar = async () => {
      try {
        // Get current user session to ensure we're authenticated
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          throw new Error('User not authenticated');
        }
        
        // Create a unique filename
        // Simplified path structure to match RLS policy
        const fileExt = file.name.split('.').pop();
        const filePath = `${session.user.id}/avatars/avatar.${fileExt}`;
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('review-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) throw uploadError;
        
        // Get the public URL
        const { data } = supabase.storage
          .from('review-images')
          .getPublicUrl(filePath);
          
        if (!data.publicUrl) throw new Error('Failed to get public URL');
        
        // Update user profile in database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: data.publicUrl })
          .eq('id', session.user.id);
          
        if (updateError) throw updateError;
        
        // Update local user state with the permanent URL
        setUser({ ...user, avatar: data.publicUrl });
        setSuccess('Profile image updated successfully');
      } catch (error) {
        console.error('Error uploading avatar:', error);
        setAvatarError('Failed to upload image. Please try again.');
        // Keep the preview but show error
      } finally {
        setIsUploadingAvatar(false);
      }
    };
    
    // Start upload process
    uploadAvatar();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      if (!user) return;
      
      const result = await UserService.updateUser(user.id, {
        name: formData.name,
        email: formData.email,
        bio: formData.bio
      });
      
      if (result.success && result.user) {
        setUser(result.user);
        setSuccess('Profile updated successfully');
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate passwords
    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // In a real app, this would call an API to update the password
    setSuccess('Password updated successfully');
    setFormData({
      ...formData,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
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
            Not Logged In
          </h1>
          <p className="font-lora text-neutral-600 mb-6">
            Please log in to access your account settings.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile Information', icon: User },
    { id: 'security', label: 'Password & Security', icon: Lock }
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* User Profile Header - Scrollable */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Account Settings Title */}
          <div>
            <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
              Account Settings
            </h2>
            <p className="font-lora text-neutral-600">
              Manage your profile, security, and payment information
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation - Sticky */}
      <div className="sticky top-16 z-40 bg-white border-b border-neutral-200 shadow-sm">
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
                    {tab.id === 'profile' ? 'Profile' : 
                     tab.id === 'security' ? 'Security' : 'Credits'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="space-y-6">
          {/* Content based on active tab */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6">
                  Profile Information
                </h3>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <X className="h-5 w-5 text-red-500 mr-2" />
                      <p className="font-lora text-red-700">{error}</p>
                    </div>
                  </div>
                )}
                
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <Save className="h-5 w-5 text-green-500 mr-2" />
                      <p className="font-lora text-green-700">{success}</p>
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSubmitProfile} className="space-y-6">
                  {/* Avatar Upload Section */}
                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Profile Picture
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={user.avatar || 'https://images.pexels.com/photos/1126993/pexels-photo-1126993.jpeg?auto=compress&cs=tinysrgb&w=150'}
                          alt={user.name}
                          className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                        />
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                          </div>
                        )}
                        <label className="absolute bottom-0 right-0 bg-primary-500 text-white p-2 rounded-full cursor-pointer hover:bg-primary-600 transition-colors duration-200 shadow-lg">
                          <Camera className="h-4 w-4" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                            disabled={isUploadingAvatar}
                          />
                        </label>
                      </div>
                      <div className="flex-1">
                        <p className="font-lora text-sm text-neutral-600 mb-2">
                          Upload a profile picture to personalize your account and appear in community activity.
                        </p>
                        {avatarError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-center">
                              <X className="h-4 w-4 text-red-500 mr-2" />
                              <p className="font-lora text-red-700 text-sm">{avatarError}</p>
                            </div>
                          </div>
                        )}
                        {isUploadingAvatar && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
                              <p className="font-lora text-blue-700 text-sm">Uploading your profile picture...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        readOnly
                        className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <p className="font-lora text-xs text-neutral-500 mt-1">
                      Email address cannot be changed after account creation.
                    </p>
                  </div>
                  
                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Tell us about yourself and your reviewing experience..."
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          name: user.name,
                          email: user.email,
                          bio: user.bio || ''
                        });
                        setError('');
                        setSuccess('');
                      }}
                      className="font-poppins border border-neutral-200 text-neutral-700 px-6 py-3 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div>
                <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6">
                  Password & Security
                </h3>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <X className="h-5 w-5 text-red-500 mr-2" />
                      <p className="font-lora text-red-700">{error}</p>
                    </div>
                  </div>
                )}
                
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <Save className="h-5 w-5 text-green-500 mr-2" />
                      <p className="font-lora text-green-700">{success}</p>
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSubmitPassword} className="space-y-6">
                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                      <input
                        type="password"
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                      <input
                        type="password"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <p className="font-lora text-xs text-neutral-500 mt-1">
                      Password must be at least 8 characters
                    </p>
                  </div>
                  
                  <div>
                    <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                    >
                      Update Password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        });
                        setError('');
                        setSuccess('');
                      }}
                      className="font-poppins border border-neutral-200 text-neutral-700 px-6 py-3 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;