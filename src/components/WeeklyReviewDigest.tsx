import React, { useState } from 'react';
import * as Icons from 'lucide-react';

const WeeklyReviewDigest = () => {
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Track the signup
      if (typeof gtag !== 'undefined') {
        gtag('event', 'newsletter_signup', {
          email: email,
          source: 'weekly-digest'
        });
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error('Newsletter signup error:', error);
      setError('Failed to subscribe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-10 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-primary-500 to-accent-500 rounded-2xl p-6 md:p-8 shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-white text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start mb-2">
                <Icons.Mail className="h-6 w-6 mr-2" />
                <h3 className="font-cinzel text-xl md:text-2xl font-bold">
                  Weekly Review Digest
                </h3>
              </div>
              <p className="font-lora text-white text-opacity-90 max-w-md">
                Get all new reviews delivered every Sunday.
              </p>
            </div>
            
            <div className="w-full md:w-auto">
              {isSubmitted ? (
                <div className="bg-white bg-opacity-20 rounded-lg p-4 text-white">
                  <div className="flex items-center mb-2">
                    <Icons.CheckCircle className="h-5 w-5 mr-2" />
                    <span className="font-poppins font-semibold">Successfully subscribed!</span>
                  </div>
                  <p className="font-lora text-sm text-white text-opacity-90">Your first digest arrives this Sunday</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    required
                    className="px-4 py-3 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg font-lora text-white placeholder-white placeholder-opacity-70 focus:ring-2 focus:ring-white focus:border-transparent min-w-0"
                  />
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="font-poppins bg-white text-primary-500 px-6 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-colors duration-200 whitespace-nowrap flex items-center justify-center"
                  >
                    {isLoading ? 'Subscribing...' : 'Subscribe'}
                  </button>
                </form>
              )}
              
              {error && (
                <p className="text-white text-opacity-90 text-sm mt-2 font-lora">{error}</p>
              )}
              
              <div className="flex justify-center md:justify-start mt-3">
                <span className="font-lora text-xs text-white text-opacity-75">Delivered every Sunday</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WeeklyReviewDigest;