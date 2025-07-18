import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface EmailCaptureProps {
  variant?: 'popup' | 'inline' | 'sidebar';
  leadMagnet?: 'clean-guide' | 'travel-checklist' | 'newsletter';
  onSubmit?: (email: string, leadMagnet: string) => void;
}

const EmailCapture: React.FC<EmailCaptureProps> = ({ 
  variant = 'inline', 
  leadMagnet = 'clean-guide',
  onSubmit 
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const leadMagnets = {
    'clean-guide': {
      title: 'Get Your Free Clean Eats Guide',
      subtitle: 'Top 50 verified clean restaurants',
      icon: CheckCircle,
      value: 'FREE today'
    },
    'travel-checklist': {
      title: 'Free Food Safety Travel Kit',
      subtitle: 'Essential checklists for safe dining anywhere',
      icon: CheckCircle,
      value: 'Exclusive download'
    },
    'newsletter': {
      title: 'Weekly Review Digest',
      subtitle: 'Get all new reviews delivered every Sunday',
      icon: CheckCircle,
      value: 'Never miss a review'
    }
  };

  const currentMagnet = leadMagnets[leadMagnet];
  const IconComponent = currentMagnet.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Track email signup
      if (typeof gtag !== 'undefined') {
        gtag('event', 'email_signup', {
          lead_magnet: leadMagnet,
          email: email
        });
      }

      setIsSubmitted(true);
      
      if (onSubmit) {
        onSubmit(email, leadMagnet);
      }
    } catch (error) {
      console.error('Email signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const baseClasses = variant === 'popup' 
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    : '';

  const containerClasses = variant === 'popup'
    ? 'bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl'
    : variant === 'sidebar'
    ? 'bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl p-6 text-white'
    : 'bg-white border border-neutral-200 rounded-2xl p-8 shadow-lg';

  if (isSubmitted) {
    return (
      <div className={baseClasses}>
        <div className={containerClasses}>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>

            <h3 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
              Check Your Email!
            </h3>

            <p className="font-lora text-neutral-600 mb-6">
              Your {currentMagnet.title.toLowerCase()} is on its way to your inbox.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={baseClasses}>
      <div className={containerClasses}>
        <div className="text-center">
          <div className={`w-16 h-16 ${variant === 'sidebar' ? 'bg-white bg-opacity-20' : 'bg-primary-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <IconComponent className={`h-8 w-8 ${variant === 'sidebar' ? 'text-white' : 'text-primary-500'}`} />
          </div>

          <h3 className={`font-cinzel text-2xl font-bold mb-2 ${variant === 'sidebar' ? 'text-white' : 'text-neutral-900'}`}>
            {currentMagnet.title}
          </h3>

          <p className={`font-lora text-lg mb-2 ${variant === 'sidebar' ? 'text-white opacity-90' : 'text-neutral-600'}`}>
            {currentMagnet.subtitle}
          </p>

          <div className={`inline-block px-3 py-1 rounded-full text-sm font-poppins font-bold mb-6 ${
            variant === 'sidebar' 
              ? 'bg-white bg-opacity-20 text-white' 
              : 'bg-primary-100 text-primary-700'
          }`}>
            {currentMagnet.value}
          </div>

          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className={`flex-1 px-4 py-3 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  variant === 'sidebar'
                    ? 'bg-white bg-opacity-20 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-70'
                    : 'border border-neutral-200 text-neutral-700'
                }`}
              />
              <button
                type="submit"
                disabled={isLoading}
                className={`font-poppins px-6 py-3 rounded-lg font-semibold transition-colors duration-200 whitespace-nowrap ${
                  variant === 'sidebar'
                    ? 'bg-white text-primary-500 hover:bg-opacity-90'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Sending...' : 'Get Free Guide'}
              </button>
            </div>
          </form>

          <div className={`flex items-center justify-center ${
            variant === 'sidebar' ? 'text-white opacity-75' : 'text-neutral-600'
          }`}>
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            <span className="font-lora">No spam, ever</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailCapture;