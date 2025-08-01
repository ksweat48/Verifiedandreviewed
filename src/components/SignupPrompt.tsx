import React, { useEffect } from 'react';
import { X, Zap } from 'lucide-react';

interface SignupPromptProps {
  onSignup: () => void;
  onLogin: () => void;
  onClose?: () => void;
  title?: string;
  message?: string;
  signupButtonText?: string;
  loginButtonText?: string;
  benefits?: string[];
}

const SignupPrompt: React.FC<SignupPromptProps> = ({ 
  onSignup, 
  onLogin,
  onClose,
  title = "Save Your Favorites",
  message = "Create an account to save AI-generated businesses to your favorites.",
  signupButtonText = "Sign Up Free For 200 Credits",
  loginButtonText = "Already have an account? Log in",
  benefits = [
    "200 free credits instantly",
    "100 free credits every month", 
    "Earn credits for each review",
    "Save favorite businesses",
    "Access to all features"
  ]
}) => {
  // Prevent body scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    // Create a custom event listener for auth modal
    const handleAuthEvent = (event: CustomEvent) => {
      const { mode } = event.detail;
      if (mode === 'signup') {
        onSignup();
      } else if (mode === 'login') {
        onLogin();
      }
    };
    
    document.addEventListener('open-auth-modal', handleAuthEvent as EventListener);
    
    return () => {
      document.body.style.overflow = 'auto';
      document.removeEventListener('open-auth-modal', handleAuthEvent as EventListener);
    };
  }, [onSignup, onLogin]);

  // Handle browser back button for modal
  useEffect(() => {
    // Push a new state when modal opens
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = (event) => {
      if (onClose) {
        onClose();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative max-w-md w-full overflow-hidden animate-in zoom-in-50 duration-300 my-4 mx-auto rounded-3xl shadow-2xl">
        {/* Close button */}
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-black bg-opacity-40 text-white p-2 rounded-full hover:bg-opacity-60 transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        
        {/* Full background image with overlay */}
        <div className="relative h-[500px] overflow-hidden">
          {/* Background image */}
          <img
            src="/ChatGPT Image Jul 12, 2025, 05_41_06 AM.png" 
            alt="Women using phones"
            className="w-full h-full object-cover"
          />

          {/* Dark gradient overlay for text visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70"></div>
          
          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {/* Text content - centered in the middle */}
            <div className="flex-1 flex flex-col justify-center items-center text-center px-8"></div>
            
            {/* Button section at the bottom */}
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 p-8 space-y-4">
              <button 
                onClick={onSignup}
                type="button" 
                className="w-full font-poppins bg-gradient-to-r from-primary-500 to-accent-500 text-white px-6 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                Sign Up Free For 200 Credits
              </button>
              
              <div className="text-center pt-2">
                <button
                  onClick={onLogin}
                  className="font-poppins text-primary-600 hover:text-primary-700 transition-colors duration-200 cursor-pointer focus:outline-none focus:underline rounded-lg px-4 py-2"
                  type="button"
                >
                  Already have an account? Log in
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPrompt;