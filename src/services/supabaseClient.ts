import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Debug: Log the actual values being used
console.log('🔍 Supabase Configuration Debug:');
console.log('  VITE_SUPABASE_URL:', supabaseUrl);
console.log('  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');
console.log('  Environment variables loaded:', {
  url: !!supabaseUrl,
  key: !!supabaseAnonKey,
  urlLength: supabaseUrl.length,
  keyLength: supabaseAnonKey.length
});

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

// Validate Supabase credentials
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `
❌ Supabase Configuration Error:

Missing environment variables in your .env file:
${!supabaseUrl ? '- VITE_SUPABASE_URL' : ''}
${!supabaseAnonKey ? '- VITE_SUPABASE_ANON_KEY' : ''}

To fix this:
1. Create a .env file in your project root (if it doesn't exist)
2. Add these variables from your Supabase project dashboard:
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
3. Restart your development server

Find these values at: https://supabase.com/dashboard/project/[your-project]/settings/api
  `;
  
  console.error(errorMessage);
  
  if (isDevelopment) {
    // Show user-friendly error in development
    setTimeout(() => {
      alert(errorMessage);
    }, 1000);
  }
}

// Create the Supabase client with proper error handling
export const supabase = (() => {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      // Return a mock client that throws helpful errors
      return {
        auth: {
          getSession: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
          getUser: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
          signInWithPassword: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
          signUp: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
          signOut: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
        },
        from: () => ({
          select: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
          insert: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
          update: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
          delete: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.'))
        }),
        storage: {
          from: () => ({
            upload: () => Promise.reject(new Error('Supabase not configured. Please check your .env file.')),
            getPublicUrl: () => ({ data: { publicUrl: '' } })
          })
        }
      };
    }
    
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    throw error;
  }
})();

// Database types
export type Profile = {
  id: string;
  email: string;
  username: string;
  username: string;
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
  business_type?: 'product' | 'service' | 'hybrid';
  primary_offering?: string;
  created_at: string;
  updated_at: string;
  phone_number?: string;
  short_description?: string;
  website_url?: string;
  social_media?: string[];
  price_range?: string;
  service_area?: string;
  owner_user_id?: string;
  is_mobile_business?: boolean;
  is_virtual?: boolean;
  is_virtual?: boolean;
  latitude?: number;
  longitude?: number;
  distance?: number;
  duration?: number;
  // Reviews array for platform businesses
  reviews?: Array<{
    text: string;
    author: string;
    authorImage?: string;
    images?: Array<{ url: string; alt?: string }>;
    thumbsUp: boolean;
  }>;
  // Dynamic properties added during search processing
  isExactMatch?: boolean;
  isPlatformBusiness?: boolean;
  similarity?: number;
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