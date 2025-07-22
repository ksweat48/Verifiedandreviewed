import React from 'react';
import { useNavigate } from 'react-router-dom';

// Simple redirect component since we moved dashboard logic to ReviewerDashboardPage
const UserDashboard: React.FC<{ user: any; loading: boolean }> = ({ user, loading }) => {
  const navigate = useNavigate();
  
  React.useEffect(() => {
    // Redirect to the main dashboard page
    navigate('/dashboard');
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

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
          Redirecting to Dashboard...
        </h1>
      </div>
    </div>
  );
};

export default UserDashboard;