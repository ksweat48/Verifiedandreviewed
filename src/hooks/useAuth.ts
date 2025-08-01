import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Profile } from '../services/supabaseClient';

export const useAuth = () => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        // If Supabase is not properly configured, return early
        if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
          console.warn('Supabase not configured. Authentication disabled.');
          setLoading(false);
          return;
        }
        
        // If Supabase is not properly configured, return early
        if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
          console.warn('Supabase not configured. Authentication disabled.');
          setLoading(false);
          return;
        }
        
        setLoading(true);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth session error:', error);
          throw error;
        }
        
        if (session) {
          // Get user profile data
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, username, name, avatar_url, credits, level, review_count, bio, created_at, updated_at, is_business_owner, role')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) throw profileError;
          
          setUser({
            ...profile,
            id: session.user.id
          });
          setIsAuthenticated(true);
        }
      } catch (err) {
        setError('Failed to authenticate');
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          try {
            // Get user profile data
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('id, email, username, name, avatar_url, credits, level, review_count, bio, created_at, updated_at, is_business_owner, role')
              .eq('id', session.user.id)
              .single();
            
            if (error) throw error;
            
            if (profile) {
              setUser({
                ...profile,
                id: session.user.id
              });
              setIsAuthenticated(true);
            }
          } catch (err) {
            console.error('Error fetching user profile:', err);
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    );
    
    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // Immediately fetch user profile after successful login
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (!profileError && profile) {
          setUser({
            ...profile,
            id: data.user.id
          });
          setIsAuthenticated(true);
        }
      }
      
      return true;
    } catch (err) {
      setError('Failed to sign in');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name,
            email,
            created_at: new Date().toISOString()
          });
        
        if (profileError) throw profileError;
      }
      
      return true;
    } catch (err) {
      setError('Failed to sign up');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async (): Promise<boolean> => {
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      setUser(null);
      setIsAuthenticated(false);
      
      return true;
    } catch (err) {
      setError('Failed to sign out');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    isAuthenticated,
    loading,
    error,
    signIn,
    signUp,
    signOut
  };
};