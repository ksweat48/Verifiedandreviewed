import React from 'react';
import { Share2, Instagram, Facebook, Twitter, Download, Copy } from 'lucide-react';

interface SocialShareButtonsProps {
  review: {
    id: number;
    name: string;
    location: string;
    rating: number;
    healthScore: number;
    review: string;
    image: string;
  };
  onShare?: (platform: string) => void;
}

const SocialShareButtons: React.FC<SocialShareButtonsProps> = ({ review, onShare }) => {
  const shareUrl = `${window.location.origin}/review/${review.id}`;
  const shareText = `🔍 VERIFIED & REVIEWED: ${review.name}\n📍 ${review.location}\n⭐ ${review.rating}/5 | 🏥 Health Score: ${review.healthScore}/100\n\n${review.review.substring(0, 100)}...\n\n#VerifiedAndReviewed #CleanEats #FoodReview`;

  const handleShare = (platform: string) => {
    let url = '';
    
    switch (platform) {
      case 'instagram':
        // Instagram doesn't support direct URL sharing, so we'll copy text
        navigator.clipboard.writeText(shareText);
        alert('Caption copied! Open Instagram and paste in a new post.');
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
        alert('Review link copied to clipboard!');
        return;
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }

    if (onShare) {
      onShare(platform);
    }
  };

  const generateSocialCard = () => {
    // This would generate a downloadable social media card
    // For now, we'll just track the action
    if (onShare) {
      onShare('download');
    }
    alert('Social media card generation coming soon!');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => handleShare('instagram')}
        className="flex items-center px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity duration-200 text-sm"
      >
        <Instagram className="h-4 w-4 mr-2" />
        Instagram
      </button>
      
      <button
        onClick={() => handleShare('facebook')}
        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
      >
        <Facebook className="h-4 w-4 mr-2" />
        Facebook
      </button>
      
      <button
        onClick={() => handleShare('twitter')}
        className="flex items-center px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors duration-200 text-sm"
      >
        <Twitter className="h-4 w-4 mr-2" />
        Twitter
      </button>
      
      <button
        onClick={generateSocialCard}
        className="flex items-center px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200 text-sm"
      >
        <Download className="h-4 w-4 mr-2" />
        Download
      </button>
      
      <button
        onClick={() => handleShare('copy')}
        className="flex items-center px-3 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors duration-200 text-sm"
      >
        <Copy className="h-4 w-4 mr-2" />
        Copy Link
      </button>
    </div>
  );
};

export default SocialShareButtons;