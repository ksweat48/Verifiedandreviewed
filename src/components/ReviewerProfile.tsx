import React from 'react';
import * as Icons from 'lucide-react';

interface ReviewerProfileProps {
  isOpen: boolean;
  onClose: () => void;
  reviewer: {
    name: string;
    image: string;
    level: number;
    reviews: Array<{
      businessName: string;
      location: string;
      date: string;
      rating: 'thumbsUp' | 'thumbsDown';
      text: string;
    }>;
    joinDate: string;
    reviewCount: number;
    bio?: string;
  };
}

const ReviewerProfile: React.FC<ReviewerProfileProps> = ({ isOpen, onClose, reviewer }) => {
  if (!isOpen) return null;

  const getLevelBadge = (level: number) => {
    const levels = {
      1: { name: 'New Reviewer', color: 'bg-gray-100 text-gray-700' },
      2: { name: 'Regular Reviewer', color: 'bg-blue-100 text-blue-700' },
      3: { name: 'Trusted Reviewer', color: 'bg-green-100 text-green-700' },
      4: { name: 'Expert Reviewer', color: 'bg-purple-100 text-purple-700' },
      5: { name: 'Master Reviewer', color: 'bg-yellow-100 text-yellow-700' }
    };
    
    return levels[level as keyof typeof levels] || levels[1];
  };

  const levelBadge = getLevelBadge(reviewer.level);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-50 duration-200 max-h-[90vh] overflow-y-auto my-4 mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-poppins text-xl font-semibold text-neutral-900">Reviewer Profile</h3>
          <button 
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700"
            aria-label="Close"
          >
            <Icons.X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex items-center mb-6">
          <img
            src={reviewer.image}
            alt={reviewer.name}
            className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
          />
          <div className="ml-4">
            <h4 className="font-poppins text-xl font-semibold text-neutral-900 flex items-center">
              {reviewer.name}
            </h4>
            <div className={`${levelBadge.color} px-3 py-1 rounded-full text-sm font-poppins font-semibold inline-block mt-1`}>
              {levelBadge.name}
            </div>
            <div className="font-lora text-sm text-neutral-600 mt-1">
              {reviewer.reviewCount} reviews • Joined {reviewer.joinDate}
            </div>
          </div>
        </div>
        
        {reviewer.bio && (
          <div className="mb-6">
            <p className="font-lora text-neutral-700">
              {reviewer.bio}
            </p>
          </div>
        )}
        
        <div>
          <h5 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
            Recent Reviews
          </h5>
          
          <div className="space-y-4">
            {reviewer.reviews.map((review, index) => (
              <div key={index} className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-poppins font-semibold text-neutral-900">
                    {review.businessName}
                  </h6>
                  <div className={`flex items-center ${
                    review.rating === 'thumbsUp' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {review.rating === 'thumbsUp' ? (
                      <Icons.ThumbsUp className="h-4 w-4 mr-1 fill-current" />
                    ) : (
                      <Icons.ThumbsDown className="h-4 w-4 mr-1 fill-current" />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center text-neutral-600 text-sm mb-2">
                  <Icons.MapPin className="h-3 w-3 mr-1" />
                  <span className="font-lora text-xs">{review.location}</span>
                  <span className="mx-2">•</span>
                  <Icons.Calendar className="h-3 w-3 mr-1" />
                  <span className="font-lora text-xs">{review.date}</span>
                </div>
                
                <p className="font-lora text-sm text-neutral-700">
                  "{review.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewerProfile;