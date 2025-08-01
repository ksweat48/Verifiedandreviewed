import type { User } from '../types/user';
import { supabase } from './supabaseClient';

export class UserService {
  // Get current user from WordPress
  static async getCurrentUser(): Promise<User | null> {
    try {
      console.log('🔍 UserService.getCurrentUser() called');
      
      // Check if Supabase is properly configured
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.warn('Supabase not configured. Using mock user data.');
        // Return mock user data
        return {
          id: '1',
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150',
          role: 'user',
          credits: 200,
          level: 3,
          joinDate: '2023-06-15',
          bio: 'Food enthusiast and travel blogger. Love discovering hidden gems!',
          status: 'active',
          lastLogin: new Date().toISOString()
        };
      }

      // Check for auth token
      console.log('🔍 Checking Supabase session...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 Session result:', session ? 'Session found' : 'No session', session?.user?.id);
      if (!session) return null;

      // Mock user data for demo (replace with actual WordPress API call)
      try {
        // Try to get user from Supabase
        console.log('🔍 Getting authenticated user from Supabase...');
        const { data: { user: authUser } } = await supabase.auth.getUser();
        console.log('🔍 Auth user result:', authUser ? 'User found' : 'No user', authUser?.id);
        if (!authUser) throw new Error('No authenticated user');
        
        console.log('🔍 Fetching user profile from profiles table...');
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, email, username, name, avatar_url, credits, level, review_count, bio, created_at, updated_at, is_business_owner, role')
          .eq('id', authUser.id)
          .single();
          
        console.log('🔍 Profile query result:', { profile: profile ? 'Profile found' : 'No profile', error: error ? error.message : 'No error' });
        
        if (error || !profile) throw error;
        
        console.log('✅ Successfully fetched user profile:', profile.id, profile.name);
        return {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          email: profile.email,
          avatar: profile.avatar_url,
          role: profile.role || 'user',
          credits: profile.credits,
          reviewCount: profile.review_count,
          level: profile.level,
          joinDate: profile.created_at,
          bio: profile.bio,
          status: 'active',
          lastLogin: new Date().toISOString()
        };
      } catch (error) {
        console.error('❌ Error fetching user profile from Supabase:', error);
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
        
        // Fallback to mock user if Supabase fails
        console.warn('⚠️ Returning null instead of mock user to debug the issue');
        return null;
      }

    } catch (error) {
      console.error('❌ Outer error in getCurrentUser:', error);
      return null;
    }
  }

  // Register new user
  static async registerUser(userData: {
    username: string;
    email: string;
    password: string;
    name: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Try to register with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            username: userData.username
          }
        }
      });
      
      if (error) {
        throw error;
      }
      
      // The profile will be created by the database trigger
      const newUser: User = {
        id: data.user?.id || '0',
        username: userData.username,
        name: userData.name,
        email: userData.email,
        credits: 200,
        role: 'author',
        reviewCount: 0,
        level: 1,
        joinDate: new Date().toISOString(),
        status: 'active'
      };

      return {
        success: true,
        user: newUser
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  // Login user
  static async loginUser(credentials: {
    username: string;
    password: string;
  }): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      let email = credentials.username;
      
      // If username doesn't contain @, it's a username - look up the email
      if (!credentials.username.includes('@')) {
        console.log('🔍 Looking up email for username:', credentials.username);
        
        // Query the profiles table to find the email by username
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', credentials.username)
          .single();
        
        console.log('🔍 Username lookup result:', { profile, error: profileError });
        
        if (profileError || !profile) {
          console.error('❌ Username lookup failed:', profileError);
          
          // Check if the username exists but with different casing
          const { data: caseInsensitiveProfile, error: caseError } = await supabase
            .from('profiles')
            .select('email, username')
            .ilike('username', credentials.username)
            .single();
          
          if (caseError || !caseInsensitiveProfile) {
            // Also check if they're trying to use their email as username
            const { data: emailProfile, error: emailError } = await supabase
              .from('profiles')
              .select('email')
              .eq('email', credentials.username)
              .single();
            
            if (!emailError && emailProfile) {
              email = emailProfile.email;
              console.log('✅ Found user by email instead of username');
            } else {
              throw new Error(`Username "${credentials.username}" not found. Please check your username or use your email address.`);
            }
          } else {
            email = caseInsensitiveProfile.email;
            console.log('✅ Found email with case-insensitive search:', email);
          }
        } else {
          email = profile.email;
          console.log('✅ Found email for username:', email);
        }
      }
      
      // Now login with the email (either provided directly or looked up from username)
      console.log('🔐 Attempting login with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: credentials.password
      });
      
      if (error) {
        console.error('❌ Supabase auth error:', error);
        throw error;
      }
      
      if (data.session) {
        localStorage.setItem('wp_token', data.session.access_token);
        
        const user = await this.getCurrentUser();
        
        return {
          success: true,
          token: data.session.access_token,
          user: user || undefined
        };
      } else {
        throw new Error('No session returned from login');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  // Update user profile
  static async updateUser(userId: string, updates: Partial<User>): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const token = localStorage.getItem('wp_token');
      if (!token) throw new Error('Not authenticated');

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock successful update
      const currentUser = await this.getCurrentUser();
      if (!currentUser) throw new Error('User not found');

      const updatedUser = { ...currentUser, ...updates };
      
      return {
        success: true,
        user: updatedUser
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed'
      };
    }
  }

  // Logout user
  static logout(): void {
    try {
      // Clear all browser storage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear all cookies
        document.cookie.split(";").forEach(cookie => {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
      }

      // Sign out from Supabase
      supabase.auth.signOut();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    // Only check Supabase session
    return !!supabase.auth.getSession();
  }

  // Get user level based on review count
  static getUserLevel(reviewCount: number): number {
    return Math.floor(reviewCount / 10) + 1;
  }

  // Get progress to next level
  static getLevelProgress(reviewCount: number): { current: number; next: number; progress: number } {
    const currentLevel = this.getUserLevel(reviewCount);
    const reviewsInCurrentLevel = reviewCount % 10;
    const progress = (reviewsInCurrentLevel / 10) * 100;
    
    return {
      current: currentLevel,
      next: currentLevel + 1,
      progress
    };
  }
}