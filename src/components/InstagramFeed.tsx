import React from 'react';
import { Instagram, ExternalLink } from 'lucide-react';

const InstagramFeed = () => {
  const followOnInstagram = () => {
    window.open('https://instagram.com/verifiedandreviewed', '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="py-16 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={followOnInstagram}
          className="w-full inline-flex items-center justify-center font-poppins bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-lg font-semibold hover:opacity-90 transition-opacity duration-200 text-lg"
        >
          <Instagram className="h-6 w-6 mr-3" />
          Follow @verifiedandreviewed
          <ExternalLink className="h-5 w-5 ml-3" />
        </button>
      </div>
    </section>
  );
};

export default InstagramFeed;