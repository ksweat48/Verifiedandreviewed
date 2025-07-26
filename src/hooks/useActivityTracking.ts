import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ActivityService } from '../services/activityService';
import { UserService } from '../services/userService';

// Custom hook for automatic page view tracking
export const useActivityTracking = () => {
  const location = useLocation();

  useEffect(() => {
    const trackPageView = async () => {
      try {
        // Only track if user is authenticated
        const isAuthenticated = UserService.isAuthenticated();
        if (!isAuthenticated) return;

        const user = await UserService.getCurrentUser();
        if (!user) return;

        // Log page view
        await ActivityService.logPageView(user.id, location.pathname);
      } catch (error) {
        // Silently fail - don't disrupt user experience
        console.debug('Page view tracking failed:', error);
      }
    };

    trackPageView();
  }, [location.pathname]);

  return {
    logActivity: ActivityService.logActivity,
    logSearch: ActivityService.logSearch,
    logBusinessView: ActivityService.logBusinessView,
    logReviewSubmit: ActivityService.logReviewSubmit
  };
};