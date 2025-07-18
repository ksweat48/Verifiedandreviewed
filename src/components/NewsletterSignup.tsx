import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';

const NewsletterSignup = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError('');
    
    try {
      // Get ConvertKit credentials from environment variables
      const CONVERTKIT_API_KEY = import.meta.env.VITE_CONVERTKIT_API_KEY;
      const CONVERTKIT_FORM_ID = import.meta.env.VITE_CONVERTKIT_FORM_ID;

      if (!CONVERTKIT_API_KEY || !CONVERTKIT_FORM_ID) {
        throw new Error('ConvertKit configuration missing');
      }

      // Subscribe to ConvertKit
      const response = await fetch(`https://api.convertkit.com/v3/forms/${CONVERTKIT_FORM_ID}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: CONVERTKIT_API_KEY,
          email: email,
          tags: ['weekly-digest', 'newsletter-subscriber'],
          fields: {
            source: 'website-newsletter',
            signup_location: 'newsletter-section'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to subscribe');
      }

      // Track the signup
      if (typeof gtag !== 'undefined') {
        gtag('event', 'newsletter_signup', {
          email: email,
          source: 'weekly-digest'
        });
      }

      setIsSubmitted(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to subscribe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>

        <h3 className="font-cinzel text-2xl font-bold text-green-900 mb-4">
          Welcome to the Community!
        </h3>

        <p className="font-lora text-green-700 mb-6">You'll receive your first weekly digest this Sunday.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-8">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-primary-500" />
        </div>
        <h3 className="font-cinzel text-2xl font-bold text-neutral-900 mb-2">
          Weekly Review Digest
        </h3>
        <p className="font-lora text-neutral-600 mb-4">Get all new reviews delivered every Sunday.</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
            className="flex-1 px-4 py-3 border border-neutral-200 rounded-lg font-lora text-neutral-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center justify-center ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Sending...' : 'Subscribe'}
          </button>
        </div>
        
        {error && (
          <p className="text-red-600 text-sm mt-2 font-lora">{error}</p>
        )}
      </form>

      <div className="space-y-3">
        <div className="flex items-center text-neutral-600">
          <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
          <span className="font-lora text-sm">All new reviews from the week</span>
        </div>
      </div>

      <div className="flex items-center justify-center mt-6 pt-6 border-t border-neutral-100">
        <span className="font-lora text-xs text-neutral-500">Delivered every Sunday • Unsubscribe anytime</span>
      </div>
    </div>
  );
};

export default NewsletterSignup;