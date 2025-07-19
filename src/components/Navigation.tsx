import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthModal from './AuthModal';
import UserMenu from './UserMenu';
import { UserService } from '../services/userService';
import { useAnalytics } from '../hooks/useAnalytics';
import type { User } from '../types/user';

interface NavigationProps {
  isAppModeActive: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isAppModeActive }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); 
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null); 
  const [loading, setLoading] = useState(true); 
  const { trackEvent, trackPageView } = useAnalytics();
  
  const navigate = useNavigate();
  const location = useLocation();
  
  
  // Track page views when location changes
  useEffect(() => {
    trackPageView(location.pathname, document.title);
  }, [location, trackPageView]);
  
  // Listen for custom events to open auth modal
  useEffect(() => {
    const handleOpenAuthModal = (event: CustomEvent) => {
      const { mode = 'login', forceMode = false } = event.detail || {};
      if (forceMode) {
        setAuthMode(mode);
      } else {
        setAuthMode(mode || 'login');
      }
      setIsAuthModalOpen(true);
    };
    
    document.addEventListener('open-auth-modal', handleOpenAuthModal as EventListener);
    
    return () => {
      document.removeEventListener('open-auth-modal', handleOpenAuthModal as EventListener);
    };
  }, []);

  // Check for existing user session on component mount
  useEffect(() => {
    const checkUserSession = async () => {
      const isAuth = UserService.isAuthenticated();
      if (isAuth) {
        try {
          const user = await UserService.getCurrentUser();
          setCurrentUser(user);
        } catch (error) {
          UserService.logout(); // Clear invalid token
        }
      }
      setLoading(false);
    };

    checkUserSession();
    
    // Listen for auth state changes
    const handleAuthStateChange = () => {
      checkUserSession();
    };
    
    window.addEventListener('auth-state-changed', handleAuthStateChange);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    trackEvent('auth_success', { 
      user_id: user.id, 
      mode: authMode 
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    trackEvent('user_logged_out');
  };

  return (
    <>
      <nav className="bg-header-bg shadow-sm sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => navigate('/')}>
              <img 
                src="/verified and reviewed logo-coral copy copy.png" 
                alt="Verified & Reviewed" 
                className="h-10 w-10 mr-3"
              />
              <h1 className="font-cinzel text-lg font-semibold text-white">
                VERIFIED & REVIEWED
              </h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:block"></div>

            {/* Right Side - Auth, Mobile menu */}
            <div className="flex items-center">
              {/* Authentication / User Menu */}
              {loading ? (
                <div className="w-8 h-8 bg-neutral-200 rounded-full animate-pulse"></div>
              ) : currentUser ? (
                <div className="flex items-center space-x-2">
                  <UserMenu user={currentUser} onLogout={handleLogout} />
                </div>
              ) : (
                <div className="hidden md:flex items-center space-x-2">
                  <button
                    onClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}
                    className="font-poppins text-white hover:text-primary-300 px-3 py-2 font-medium transition-colors duration-200 text-sm"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { setAuthMode('signup'); setIsAuthModalOpen(true); }}
                    className="font-poppins bg-primary-500 text-white px-3 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 text-sm"
                  >
                    Sign Up
                  </button>
                </div>
              )}
              
              {/* Mobile menu button */}
              <div className={`md:hidden ${currentUser ? 'hidden' : ''}`}>
                <button
                  onClick={() => setIsMenuOpen(prev => !prev)}
                  className="p-2 rounded-lg text-white hover:text-primary-300 hover:bg-white/10 transition-colors duration-200"
                  aria-expanded={isMenuOpen}
                  aria-label="Toggle menu"
                >
                  {isMenuOpen ? <Icons.X className="h-5 w-5" /> : <Icons.Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden border-t border-neutral-100 transition-all duration-300 ${currentUser ? 'hidden' : ''} ${
          isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="px-4 pt-4 pb-6 space-y-2 bg-white">
            {/* Mobile Auth Buttons */}
            {!currentUser && (
              <div className="pt-4 border-t border-neutral-100 space-y-2">
                <button
                  onClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}
                  className="w-full font-poppins border border-neutral-200 text-neutral-700 px-4 py-2 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setAuthMode('signup'); setIsAuthModalOpen(true); }}
                  className="w-full font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                >
                  Sign Up
                </button>
              </div>
            )}

          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
      />
      
    </>
  );
};

export default Navigation;