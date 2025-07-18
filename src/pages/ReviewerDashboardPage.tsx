import React, { useState, useEffect } from 'react';
import UserDashboard from '../components/UserDashboard';
import { UserService } from '../services/userService';
import type { User } from '../types/user';

const ReviewerDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await UserService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
  }, []);
  
  return <UserDashboard user={user} loading={loading} />;
};

export default ReviewerDashboardPage;