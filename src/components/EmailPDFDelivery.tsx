import React, { useState } from 'react';
import { CheckCircle, FileText, Send } from 'lucide-react';

interface EmailPDFDeliveryProps {
  pdfUrl?: string;
  pdfTitle?: string;
  variant?: 'popup' | 'inline' | 'sidebar';
}

const EmailPDFDelivery: React.FC<EmailPDFDeliveryProps> = ({ 
  pdfUrl = '/clean-eats-guide.pdf',
  pdfTitle = 'Clean Eats Guide',
  variant = 'inline'
}) => {
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
      // Option 1: Send to your email service (ConvertKit, Mailchimp, etc.)
      const response = await fetch('/api/send-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          pdfUrl: pdfUrl,
          pdfTitle: pdfTitle,
          leadMagnet: 'clean-eats-guide'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send PDF');
      }

      // Track the conversion
      if (typeof gtag !== 'undefined') {
        gtag('event', 'pdf_download', {
          email: email,
          pdf_title: pdfTitle,
          lead_magnet: 'clean-eats-guide'
        });
      }

      setIsSubmitted(true);
    } catch (error) {
      setError('Failed to send PDF. Please try again.');
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
          Check Your Email!
        </h3>

        <p className="font-lora text-green-700 mb-6">
          Your {pdfTitle} is on its way to your inbox. Check your email in the next few minutes!
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
          Get Your Free {pdfTitle}
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
                <Send className="h-4 w-4 mr-2" />
                Get Free PDF
              </>
            )}
          </button>
        </div>
        
        {error && (
          <p className="text-red-600 text-sm mt-2 font-lora">{error}</p>
        )}
      </form>

      <div className="flex items-center justify-center gap-4 text-sm text-neutral-600">
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

export default EmailPDFDelivery;