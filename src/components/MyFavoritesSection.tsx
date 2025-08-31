import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import BusinessProfileModal from './BusinessProfileModal';
import type { Business } from '../services/supabaseClient';

interface MyFavoritesSectionProps {
  businesses: any[];
  onRemoveFavorite: (recommendationId: string) => Promise<void>;
}

const MyFavoritesSection: React.FC<MyFavoritesSectionProps> = ({ 
  businesses, 
  onRemoveFavorite 
}) => {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isBusinessProfileModalOpen, setIsBusinessProfileModalOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);

  const handleRemoveFavorite = async (recommendationId: string, businessName: string) => {
    if (!confirm(`Remove "${businessName}" from your favorites?`)) {
      return;
    }

    setRemovingId(recommendationId);
    try {
      await onRemoveFavorite(recommendationId);
    } catch (error) {
      console.error('Error removing favorite:', error);
      alert('Failed to remove favorite. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleViewBusinessProfile = (business: any) => {
    let businessForModal;
    
    if (business.isPlatformOffering && business.businessId) {
      // For platform offerings, use the linked business data
      businessForModal = {
        id: business.businessId,
        name: business.businessName || business.name,
        address: business.address,
        location: business.location,
        category: business.category || 'Platform Offering',
        tags: [],
        description: business.description || '',
        image_url: business.image_url,
        gallery_urls: [],
        hours: 'Hours not available',
        is_verified: true, // Platform offerings are verified
        thumbs_up: 0,
        thumbs_down: 0,
        sentiment_score: 0,
        created_at: business.created_at,
        updated_at: business.created_at
      };
    } else {
      // For AI businesses, use the recommendation data
      businessForModal = {
        id: business.id,
        name: business.name,
        address: business.address || business.location,
        location: business.location || business.address,
        category: business.category || 'General',
        tags: [],
        description: business.description || '',
        image_url: business.isAIGenerated ? '/verified and reviewed logo-coral copy copy.png' : (business.image_url || '/verified and reviewed logo-coral copy copy.png'),
        gallery_urls: [],
        hours: 'Hours not available',
        is_verified: false,
        thumbs_up: 0,
        thumbs_down: 0,
        sentiment_score: 0,
        created_at: business.created_at,
        updated_at: business.created_at
      };
    }
    
    setSelectedBusinessForProfile(businessForModal);
    setIsBusinessProfileModalOpen(true);
  };

  const extractSimilarityScore = (description: string): number | null => {
    const match = description.match(/(\d+)% match/);
    return match ? parseInt(match[1]) : null;
  };

  return (
    <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel text-2xl font-bold text-neutral-900 flex items-center">
          <Icons.Heart className="h-6 w-6 mr-3 text-red-500" />
          My Favorites ({businesses.length})
        </h2>
      </div>

      {businesses.length === 0 ? (
        <div className="bg-neutral-50 rounded-xl p-6 text-center">
          <Icons.Heart className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
            No Favorites Yet
          </h3>
          <p className="font-lora text-neutral-600 mb-4">
            When you find AI-generated businesses you like, click the heart icon to save them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {businesses.map((business) => {
            const similarityScore = extractSimilarityScore(business.description || '');
            
            return (
              <div key={business.id} className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 hover:shadow-md transition-shadow duration-200">
                {/* Business Image and Name - Line 1 */}
                <div className="flex items-center gap-3 mb-2">
                  {/* Business Image - 25% */}
                  <div className="w-1/4 flex-shrink-0">
                    <img
                      src={business.image_url || '/verified and reviewed logo-coral copy copy.png'}
                      alt={business.name}
                      className="w-full h-16 object-cover rounded-lg"
                    />
                  </div>
                  
                  {/* Business Name - 75% */}
                  <div className="w-3/4 flex-shrink-0">
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 line-clamp-2 break-words leading-tight">
                      {business.name}
                    </h3>
                  </div>
                </div>
                
                {/* Status and Category - Line 2 */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-full text-xs font-poppins">
                    {business.category === 'AI Generated' ? 'Google' : business.category}
                  </span>
                  <div className="flex items-center">
                    <Icons.Calendar className="h-4 w-4 text-neutral-500 mr-1" />
                    <span className="font-lora text-sm text-neutral-600">
                      {new Date(business.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Address and Date - Line 3 */}
                <div className="flex items-center mb-2 flex-wrap">
                  <div className="flex items-center">
                    <Icons.MapPin className="h-4 w-4 text-neutral-500 mr-1" />
                    <span className="font-lora text-sm text-neutral-600 break-words">
                      {business.address || business.location}
                    </span>
                  </div>
                </div>
                
                {/* Actions - Line 4 */}
                <div className="flex items-center justify-between">
                  <div></div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewBusinessProfile(business)}
                      className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-3 py-1.5 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center text-xs"
                    >
                      <Icons.Eye className="h-3 w-3 mr-1" />
                      View
                    </button>
                    
                    <button
                      onClick={() => handleRemoveFavorite(business.id, business.name)}
                      disabled={removingId === business.id}
                      className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                      title="Remove from favorites"
                    >
                      {removingId === business.id ? (
                        <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Icons.Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Business Profile Modal */}
      <BusinessProfileModal
        isOpen={isBusinessProfileModalOpen}
        onClose={() => setIsBusinessProfileModalOpen(false)}
        business={selectedBusinessForProfile}
      />
    </div>
  );
};

export default MyFavoritesSection;