import React, { useState } from 'react';
import { CheckCircle, FileText } from 'lucide-react';

const EmailOptIn = () => {
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

      // Subscribe to ConvertKit with lead magnet tags
      const response = await fetch(`https://api.convertkit.com/v3/forms/${CONVERTKIT_FORM_ID}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: CONVERTKIT_API_KEY,
          email: email,
          tags: ['clean-eats-guide', 'lead-magnet', 'pdf-download'],
          fields: {
            source: 'website-lead-magnet',
            signup_location: 'email-optin-section',
            lead_magnet: 'clean-eats-guide'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to subscribe');
      }

      // Track the signup
      if (typeof gtag !== 'undefined') {
        gtag('event', 'lead_magnet_signup', {
          email: email,
          lead_magnet: 'clean-eats-guide'
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
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="font-cinzel text-xl font-bold text-green-900 mb-2">
          Check Your Email!
        </h3>
        <p className="font-lora text-green-700 mb-4">
          Your Clean Eats Guide is on its way to your inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-8">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-primary-500" />
        </div>
        <h3 className="font-cinzel text-2xl font-bold text-neutral-900 mb-2">
          Get Your Free Clean Eats Guide
        </h3>
        <p className="font-lora text-neutral-600 mb-4">Instant download of our comprehensive guide.</p>
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
            {isLoading ? (
              'Sending...'
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Get Free Guide
              </>
            )}
          </button>
        </div>
        
        {error && (
          <p className="text-red-600 text-sm mt-2 font-lora">{error}</p>
        )}
      </form>

      <div className="flex flex-wrap justify-center items-center gap-4 text-sm text-neutral-600">
        <div className="flex items-center">
          <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
          <span className="font-lora">Instant download</span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-neutral-100 text-center">
        <p className="font-lora text-xs text-neutral-500">
          By downloading, you'll also receive our weekly newsletter with new reviews and exclusive content.
        </p>
      </div>
    </div>
  );
};

export default EmailOptIn;