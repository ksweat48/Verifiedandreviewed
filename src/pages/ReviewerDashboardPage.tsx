import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserDashboard from '../components/UserDashboard';
import { UserService } from '../services/userService';
import type { User } from '../types/user';

const ReviewerDashboardPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = UserService.isAuthenticated();
      if (!isAuth) {
        // If not authenticated, redirect to home
        navigate('/', { replace: true });
        return;
      }
      
      try {
        const userData = await UserService.getCurrentUser();
        if (!userData) {
          // If no user data, redirect to home
          navigate('/', { replace: true });
          return;
        }
        
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user data:', error);
        // On error, redirect to home
        navigate('/', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

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

  return <UserDashboard user={user} loading={loading} />;
};

export default ReviewerDashboardPage;