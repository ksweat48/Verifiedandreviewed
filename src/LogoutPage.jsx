import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserService } from './services/userService';

const LogoutPage = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const performLogout = async () => {
      try {
        // Call the UserService logout method
        UserService.logout();
        
        // Wait a moment to ensure storage is cleared
        setTimeout(() => {
          // Force navigation to home page
          navigate('/', { replace: true });
        }, 1000); // Increased timeout to ensure all logout operations complete
      } catch (error) {
        console.error('Logout failed:', error);
        // Force navigation to home page even if there's an error
        navigate('/', { replace: true });
      }
    };
    
    performLogout();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <h2 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">Logging Out...</h2>
        <p className="font-lora text-neutral-600">Please wait while we log you out.</p>
      </div>
    </div>
  );
};

export default LogoutPage;