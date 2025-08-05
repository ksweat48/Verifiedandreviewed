import React, { useState } from 'react';
import * as Icons from 'lucide-react';

interface MyFavoritesSectionProps {
  businesses: any[];
  onRemoveFavorite: (recommendationId: string) => Promise<void>;
}

const MyFavoritesSection: React.FC<MyFavoritesSectionProps> = ({ 
  businesses, 
  onRemoveFavorite 
}) => {
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  const handleTakeMeThere = (business: any) => {
    // Handle mobile businesses differently
    if (business.is_virtual && business.website_url) {
      window.open(business.website_url, '_blank', 'noopener,noreferrer');
      return;
    }
    
    if (business.is_virtual && business.website_url) {
      window.open(business.website_url, '_blank', 'noopener,noreferrer');
      return;
    }
    
    if (business.is_mobile_business && business.phone_number) {
      window.open(`tel:${business.phone_number}`, '_self');
      return;
    }
    
    let mapsUrl;
    if (business.address && typeof business.address === 'string' && business.address.trim().length > 0) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address.trim())}`;
    } else if (business.name && typeof business.name === 'string' && business.name.trim().length > 0) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name.trim())}`;
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=business`;
    }
    
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
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
                {/* Business Name - Line 1 */}
                <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2 line-clamp-1 break-words">
                  {business.name}
                </h3>
                
                {/* Status and Category - Line 2 */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-full text-xs font-poppins">
                    {business.category}
                  </span>
                  {similarityScore && (
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-poppins">
                      {similarityScore}% match
                    </span>
                  )}
                </div>
                
                {/* Address and Date - Line 3 */}
                <div className="flex items-center gap-4 mb-2 flex-wrap">
                  <div className="flex items-center">
                    <Icons.MapPin className="h-4 w-4 text-neutral-500 mr-1" />
                    <span className="font-lora text-sm text-neutral-600 break-words">
                      {business.address || business.location}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Icons.Calendar className="h-4 w-4 text-neutral-500 mr-1" />
                    <span className="font-lora text-sm text-neutral-600">
                      {new Date(business.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Actions - Line 4 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Description preview if available */}
                    {business.description && (
                      <p className="font-lora text-xs text-neutral-500 line-clamp-1 break-words max-w-xs">
                        {business.description.replace(/AI-generated business with \d+% match\. /, '')}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTakeMeThere(business)}
                      className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-3 py-1.5 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 flex items-center text-xs"
                    >
                      {business.is_virtual && business.website_url ? (
                        <>
                          <Icons.Globe className="h-3 w-3 mr-1" />
                          GO
                        </>
                      ) : business.is_mobile_business && business.phone_number ? (
                        <>
                          <Icons.Phone className="h-3 w-3 mr-1" />
                          GO
                        </>
                      ) : (
                        <>
                          <Icons.Navigation className="h-3 w-3 mr-1" />
                          GO
                        </>
                      )}
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
    </div>
  );
};

export default MyFavoritesSection;