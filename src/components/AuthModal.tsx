import React, { useState, useEffect } from 'react';
import { UserPlus, LogIn, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { UserService } from '../services/userService';
import { useAnalytics } from '../hooks/useAnalytics';
import type { User } from '../types/user';
import { ActivityService } from '../services/activityService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
  forceMode?: boolean;
  onAuthSuccess?: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose,
  initialMode = 'login',
  forceMode = false,
  onAuthSuccess 
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { trackEvent } = useAnalytics();
  
  // Set mode based on initialMode prop when it changes
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  
  // Handle browser back button for modal
  useEffect(() => {
    if (isOpen) {
      // Push a new state when modal opens
      window.history.pushState(null, '', window.location.href);
      
      const handlePopState = (event) => {
        if (isOpen) {
          onClose();
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, onClose]);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    });
    setError('');
  };

  const handleModeSwitch = (newMode: 'login' | 'signup') => {
    if (forceMode) return; // Don't allow switching if mode is forced
    setMode(newMode);
    resetForm();
  };

  const validateForm = () => {
    if (mode === 'signup') {
      if (!formData.name.trim()) {
        setError('Full name is required');
        return false;
      }
      if (!formData.username.trim()) {
        setError('Username is required');
        return false;
      }
      if (!formData.email.trim()) {
        setError('Email is required');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    } else {
      if (!formData.username.trim()) {
        setError('Username or email is required');
        return false;
      }
      if (!formData.password.trim()) {
        setError('Password is required');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    // Admin login check
    // Admin login code removed for token efficiency

    try {
      if (mode === 'signup') {
        const result = await UserService.registerUser({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          name: formData.name
        });

        if (result.success && result.user) {
          trackEvent('user_signup', { 
            email: formData.email,
            username: formData.username
          });
          
          // Log signup activity
          ActivityService.logSignup(result.user.id);

          // Auto-login after successful registration
          const loginResult = await UserService.loginUser({
            username: formData.username,
            password: formData.password
          });

          if (loginResult.success && loginResult.user) {
            onAuthSuccess?.(loginResult.user);
            onClose();
            
            // Log login activity
            ActivityService.logLogin(loginResult.user.id);
            
            // Force a refresh of the user data to ensure credits are displayed
            window.dispatchEvent(new Event('auth-state-changed'));
          } else {
            setError('Registration successful! Please log in.');
            setMode('login');
            resetForm();
          }
        } else {
          setError(result.error || 'Registration failed');
        }
      } else {
        const result = await UserService.loginUser({
          username: formData.username,
          password: formData.password
        });

        if (result.success && result.user) {
          trackEvent('user_login', { 
            email: formData.username,
            method: 'password'
          });
          
          // Log login activity
          ActivityService.logLogin(result.user.id);

          onAuthSuccess?.(result.user);
          onClose();
          // Force a refresh of the user data to ensure credits are displayed
          window.dispatchEvent(new Event('auth-state-changed'));
        } else {
          setError(result.error || 'Login failed');
        }
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
              {mode === 'signup' ? (
                <UserPlus className="h-5 w-5 text-primary-500" />
              ) : (
                <LogIn className="h-5 w-5 text-primary-500" />
              )}
            </div>
            <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
              {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
            </h2>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-visible">
          {mode === 'signup' && (
            <div>
              <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <p className="font-lora text-xs text-neutral-500 mt-1">
                You can use this username to log in instead of your email
              </p>
            </div>
          )}

          <div>
            <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
              {mode === 'signup' ? 'Username' : 'Username or Email'}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={mode === 'signup' ? 'Choose a username' : 'Enter username or email'}
                className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email address"
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                className="w-full pl-10 pr-12 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Confirm your password"
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="font-lora text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-poppins py-3 px-6 rounded-lg font-semibold transition-colors duration-200 ${
              loading
                ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            {loading ? (
              mode === 'signup' ? 'Creating Account...' : 'Signing In...'
            ) : (
              mode === 'signup' ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        {/* Mode Switch */}
        <div className="mt-4 pt-4 text-center">
          <p className="font-lora text-neutral-600">
            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
            <button
              onClick={() => handleModeSwitch(mode === 'signup' ? 'login' : 'signup')}
              className="ml-2 font-poppins font-semibold text-primary-500 hover:text-primary-600 transition-colors duration-200"
            >
              {mode === 'signup' ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        {/* Benefits for Sign Up */}
      </div>
    </div>
  );
};

export default AuthModal;