import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, Eye, EyeOff, User, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const SignupPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };
    checkUser();
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
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
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            username: formData.username
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        setSuccess(true);
        // Auto-redirect to dashboard after successful signup
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-2">
              Account Created!
            </h1>
            <p className="font-lora text-neutral-600 mb-6">
              Welcome to Verified & Reviewed! You've received 100 free credits to get started.
            </p>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="font-lora text-sm text-green-700">
                Redirecting to your dashboard...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-8 w-8 text-primary-500" />
            </div>
            <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-2">
              Create Account
            </h1>
            <p className="font-lora text-neutral-600">
              Join Verified & Reviewed and get 100 free credits
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="font-lora text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Enter your full name"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Choose a username"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <p className="font-lora text-xs text-neutral-500 mt-1">
                You can use this username to log in instead of your email
              </p>
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
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a password"
                  required
                  className="w-full pl-10 pr-12 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="font-lora text-xs text-neutral-500 mt-1">
                Must be at least 6 characters
              </p>
            </div>

            <div>
              <label className="font-poppins text-sm font-medium text-neutral-700 block mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-poppins py-3 px-6 rounded-lg font-semibold transition-colors duration-200 ${
                loading
                  ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Benefits */}
          <div className="mt-6 bg-primary-50 rounded-lg p-4">
            <h3 className="font-poppins font-semibold text-primary-900 mb-2">
              What you get:
            </h3>
            <ul className="font-lora text-sm text-primary-700 space-y-1">
              <li>• 100 free credits instantly</li>
              <li>• 50 free credits every month</li>
              <li>• AI-powered vibe matching</li>
              <li>• Save favorite businesses</li>
              <li>• Earn credits for reviews</li>
            </ul>
          </div>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="font-lora text-neutral-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-poppins font-semibold text-primary-500 hover:text-primary-600 transition-colors duration-200"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;