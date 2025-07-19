import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

// Create a mock client for development if credentials are missing
if ((!supabaseUrl || !supabaseAnonKey) && isDevelopment) {
  console.warn('Supabase credentials missing in development. Using mock client. Please check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
} else if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing. Please check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Create the client or a mock client if credentials are missing
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: !!(supabaseUrl && supabaseAnonKey),
      autoRefreshToken: !!(supabaseUrl && supabaseAnonKey)
    }
  }
);

// Database types
export type Profile = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  credits: number;
  level: number;
  review_count: number;
  bio?: string;
  created_at: string;
  updated_at: string;
};

export type CreditTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: 'search' | 'ai-search' | 'review-reward' | 'referral-reward' | 'monthly-refill' | 'purchase' | 'signup-bonus';
  description: string;
  created_at: string;
};

export type Business = {
  id: string;
  name: string;
  address: string;
  location: string;
  category: string;
  tags: string[];
  description: string;
  image_url: string;
  gallery_urls?: string[];
  hours?: string;
  days_closed?: string;
  is_verified: boolean;
  thumbs_up: number;
  thumbs_down: number;
  sentiment_score: number;
  created_at: string;
  updated_at: string;
  phone_number?: string;
  short_description?: string;
  website_url?: string;
  social_media?: string[];
  price_range?: string;
  service_area?: string;
  owner_user_id?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  duration?: number;
};

export type BusinessRating = {
  id: string;
  business_id: string;
  user_id: string;
  is_thumbs_up: boolean;
  created_at: string;
};

export type BusinessVisit = {
  id: string;
  business_id: string;
  user_id: string;
  visited_at: string;
};

export type BusinessRecommendation = {
  id: string;
  name: string;
  address: string;
  location: string;
  category?: string;
  description?: string;
  image_url?: string;
  recommended_by: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};