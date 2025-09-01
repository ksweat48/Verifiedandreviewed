import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { OfferingService } from '../services/offeringService';
import { ActivityService } from '../services/activityService';
import { UserService } from '../services/userService';
import { useModalControl } from '../hooks/useModalControl';
import { getPriceRangeText, formatPrice } from '../utils/displayUtils';

interface BusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: {
    id: string;
    name: string;
    category?: string;
    description?: string;
    short_description?: string;
    address?: string;
    location?: string;
    image_url?: string;
    gallery_urls?: string[];
    hours?: string;
    tags?: string[];
    is_verified?: boolean;
    thumbs_up?: number;
    thumbs_down?: number;
    sentiment_score?: number;
    phone_number?: string;
    email?: string;
    website_url?: string;
    social_media?: string[];
    price_range?: string;
    service_area?: string;
    days_closed?: string;
    is_mobile_business?: boolean;
    is_virtual?: boolean;
    isOpen?: boolean; // Current open/closed status
  } | null;
}

const BusinessProfileModal: React.FC<BusinessProfileModalProps> = ({
  isOpen,
  onClose,
  business
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'offerings'>('offerings');
  const [businessOfferings, setBusinessOfferings] = useState<any[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  
  // Use centralized modal control
  useModalControl({ isOpen, onClose });

  // Fetch business offerings when modal opens or business changes
  useEffect(() => {
    const fetchBusinessOfferings = async () => {
      if (!isOpen || !business?.id) return;
      
      // Debug: Log the business object received by the modal
      console.log('🖼️ DEBUG: BusinessProfileModal received business object:', {
        businessId: business.id,
        businessName: business.name,
        imageUrl: business.image_url,
        imageUrlType: typeof business.image_url,
        imageUrlLength: business.image_url?.length,
        fullBusinessObject: business
      });
      
      // Log business view activity when modal opens
      try {
        const user = await UserService.getCurrentUser();
        if (user && business) {
          // Log business view with business_id for view tracking
          await ActivityService.logActivity({
            userId: user.id,
            eventType: 'business_view',
            eventDetails: {
              business_id: business.id,
              business_name: business.name,
              view_type: 'business_profile_modal'
            }
          });
        }
      } catch (error) {
        // Silently fail - don't disrupt user experience
        console.debug('Business view tracking failed:', error);
      }
      
      setLoadingOfferings(true);
      try {
        const offerings = await OfferingService.getBusinessOfferings(business.id);
        setBusinessOfferings(offerings);
      } catch (error) {
        setBusinessOfferings([]);
      } finally {
        setLoadingOfferings(false);
      }
    };
    
    fetchBusinessOfferings();
  }, [isOpen, business?.id]);

  if (!isOpen || !business) return null;

  const getSentimentRating = (score?: number) => {
    if (!score) return { text: 'No Rating', color: 'bg-neutral-500' };
    if (score >= 80) return { text: 'Great', color: 'bg-green-500' };
    if (score >= 70) return { text: 'Good', color: 'bg-blue-500' };
    if (score >= 65) return { text: 'Fair', color: 'bg-yellow-500' };
    return { text: 'Improve', color: 'bg-red-500' };
  };

  const handleTakeMeThere = () => {
    if (business.address) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    } else if (business.website_url) {
      window.open(business.website_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSocialMediaClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sentimentRating = getSentimentRating(business.sentiment_score);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Cover Image */}
        <div className="relative h-64">
          <img
            src={business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800'}
            alt={business.name}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-70"></div>
          
          {/* Business Name and Category */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
            <h2 className="font-cinzel text-2xl sm:text-3xl font-bold mb-2">{business.name}</h2>
            
            <div className="flex flex-wrap items-center gap-4">
              {business.category && (
                <span className="font-poppins text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full">
                  {business.category}
                </span>
              )}
              
              {business.sentiment_score && (
                <div className={`${sentimentRating.color} text-white px-3 py-1 rounded-full text-sm font-poppins font-semibold flex items-center`}>
                  <Icons.ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                  <span>{business.thumbs_up || 0}</span>
                  <span className="mx-1">•</span>
                  <span>{sentimentRating.text}</span>
                </div>
              )}
              
              {business.isOpen !== undefined && (
                <div className={`px-3 py-1 rounded-full text-white text-sm font-poppins font-semibold ${
                  business.isOpen ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {business.isOpen ? 'Open Now' : 'Closed'}
                </div>
              )}
            </div>
          </div>
          
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors duration-200"
          >
            <Icons.X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Tabs Navigation */}
        <div className="border-b border-neutral-200">
          <div className="flex px-4 sm:px-6">
            <button
              onClick={() => setActiveTab('offerings')}
              className={`py-4 px-3 sm:px-6 font-poppins font-medium transition-colors duration-200 ${
                activeTab === 'offerings'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Icons.Package className="h-5 w-5 inline mr-2" />
              Offerings
              {businessOfferings.length > 0 && (
                <span className="ml-2 bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs">
                  {businessOfferings.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('info')}
              className={`py-4 px-3 sm:px-6 font-poppins font-medium transition-colors duration-200 ${
                activeTab === 'info'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Icons.Info className="h-5 w-5 inline mr-2" />
              Info
            </button>
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {/* Offerings Tab */}
          {activeTab === 'offerings' && (
            <div>
              {loadingOfferings ? (
                <div className="text-center py-12">
                  <Icons.Loader2 className="h-16 w-16 text-primary-500 mx-auto mb-4 animate-spin" />
                  <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                    Loading Offerings...
                  </h3>
                  <p className="font-lora text-neutral-600">
                    Fetching available products and services.
                  </p>
                </div>
              ) : businessOfferings.length === 0 ? (
                <div className="text-center py-12">
                  <Icons.Package className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                  <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                    No Offerings Listed
                  </h3>
                  <p className="font-lora text-neutral-600">
                    This business hasn't added any offerings yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {businessOfferings.map((offering) => {
                    // Get primary image or fallback
                    const primaryImage = offering.images?.find(img => img.is_primary && img.approved);
                    const fallbackImage = offering.images?.find(img => img.approved);
                    const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';
                    
                    return (
                      <div key={offering.id} className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 hover:shadow-sm transition-all duration-200">
                        <div className="flex gap-3">
                          <img
                            src={imageUrl}
                            alt={offering.title}
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-poppins font-semibold text-neutral-900 mb-1 line-clamp-1">
                              {offering.title}
                            </h4>
                            {offering.description && (
                              <p className="font-lora text-sm text-neutral-600 mb-2 line-clamp-2">
                                {offering.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="font-poppins font-bold text-primary-600 text-sm">
                                {formatPrice(offering.price_cents, offering.currency)}
                              </span>
                            </div>
                            {offering.tags && offering.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {offering.tags.slice(0, 3).map((tag, index) => (
                                  <span key={index} className="bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full text-xs font-lora">
                                    {tag}
                                  </span>
                                ))}
                                {offering.tags.length > 3 && (
                                  <span className="bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full text-xs font-lora">
                                    +{offering.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column - Description */}
              <div className="md:col-span-2 space-y-6">
                {/* Short Description */}
                {business.short_description && (
                  <div>
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                      About
                    </h3>
                    <p className="font-lora text-neutral-700 leading-relaxed">
                      {business.short_description}
                    </p>
                  </div>
                )}
                
                {/* Full Description */}
                {business.description && (
                  <div>
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                      Description
                    </h3>
                    <p className="font-lora text-neutral-700 leading-relaxed">
                      {business.description}
                    </p>
                  </div>
                )}
                
                {/* Tags */}
                {business.tags && business.tags.length > 0 && (
                  <div>
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                      Features & Amenities
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {business.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full text-sm font-lora"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Column - Contact & Details */}
              <div className="space-y-6">
                {/* Location */}
                {business.address && (
                  <div>
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2 flex items-center">
                      <Icons.MapPin className="h-5 w-5 mr-2 text-primary-500" />
                      {business.is_mobile_business ? 'Service Area' : 'Location'}
                    </h3>
                    {business.is_mobile_business || business.is_virtual ? (
                      <div>
                        <p className="font-lora text-neutral-700 mb-2">
                          {business.location || 'Service area not specified'}
                        </p>
                        {business.service_area && (
                          <p className="font-lora text-sm text-neutral-600 bg-blue-50 p-3 rounded-lg">
                            <Icons.MapPin className="h-4 w-4 inline mr-1 text-blue-500" />
                            Service Area: {business.service_area}
                          </p>
                        )}
                        {business.is_mobile_business && (
                          <p className="font-lora text-xs text-neutral-500 mt-2">
                            📱 Mobile service - we come to you! Contact us to schedule.
                          </p>
                        )}
                        {business.is_virtual && (
                          <p className="font-lora text-xs text-neutral-500 mt-2">
                            💻 Virtual business - services provided online.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="font-lora text-neutral-700">
                          {business.address}
                        </p>
                        <button
                          onClick={() => {
                            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address || '')}`;
                            window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="font-poppins text-primary-500 text-sm font-semibold hover:text-primary-600 transition-colors duration-200 mt-2"
                        >
                          View on Map →
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Hours */}
                {business.hours && (
                  <div>
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2 flex items-center">
                      <Icons.Clock className="h-5 w-5 mr-2 text-primary-500" />
                      Hours
                    </h3>
                    <p className="font-lora text-neutral-700 whitespace-pre-line">
                      {business.hours}
                    </p>
                    {business.days_closed && (
                      <p className="font-lora text-neutral-500 text-sm mt-1">
                        Closed: {business.days_closed}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Contact */}
                <div>
                  <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2 flex items-center">
                    <Icons.Phone className="h-5 w-5 mr-2 text-primary-500" />
                    Contact
                  </h3>
                  <div className="space-y-2">
                    {business.phone_number && (
                      <div className="flex items-center">
                        <Icons.Phone className="h-4 w-4 text-neutral-500 mr-2" />
                        <a 
                          href={`tel:${business.phone_number}`}
                          className="font-lora text-neutral-700 hover:text-primary-500 transition-colors duration-200"
                        >
                          {business.phone_number}
                        </a>
                      </div>
                    )}
                    
                    {business.email && (
                      <div className="flex items-center">
                        <Icons.Mail className="h-4 w-4 text-neutral-500 mr-2" />
                        <a 
                          href={`mailto:${business.email}`}
                          className="font-lora text-neutral-700 hover:text-primary-500 transition-colors duration-200"
                        >
                          {business.email}
                        </a>
                      </div>
                    )}
                    
                    {business.website_url && (
                      <div className="flex items-center">
                        <Icons.Globe className="h-4 w-4 text-neutral-500 mr-2" />
                        <a 
                          href={business.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-lora text-neutral-700 hover:text-primary-500 transition-colors duration-200"
                        >
                          Website
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Social Media */}
                {business.social_media && business.social_media.length > 0 && (
                  <div>
                    <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2 flex items-center">
                      <Icons.Share2 className="h-5 w-5 mr-2 text-primary-500" />
                      Social Media
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {business.social_media.map((url, index) => {
                        let icon = <Icons.Link className="h-4 w-4" />;
                        let platform = "Link";
                        
                        if (url.includes('facebook.com')) {
                          icon = <Icons.Facebook className="h-4 w-4" />;
                          platform = "Facebook";
                        } else if (url.includes('instagram.com')) {
                          icon = <Icons.Instagram className="h-4 w-4" />;
                          platform = "Instagram";
                        } else if (url.includes('twitter.com') || url.includes('x.com')) {
                          icon = <Icons.Twitter className="h-4 w-4" />;
                          platform = "Twitter";
                        } else if (url.includes('linkedin.com')) {
                          icon = <Icons.Linkedin className="h-4 w-4" />;
                          platform = "LinkedIn";
                        } else if (url.includes('tiktok.com')) {
                          icon = <Icons.Video className="h-4 w-4" />;
                          platform = "TikTok";
                        }
                        
                        return (
                          <button
                            key={index}
                            onClick={() => handleSocialMediaClick(url)}
                            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-1 rounded-full text-sm font-poppins flex items-center transition-colors duration-200"
                          >
                            {icon}
                            <span className="ml-1">{platform}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Additional Details */}
                <div>
                  <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2 flex items-center">
                    <Icons.Info className="h-5 w-5 mr-2 text-primary-500" />
                    Details
                  </h3>
                  <div className="space-y-2">
                    {business.price_range && (
                      <div className="flex items-center justify-between">
                        <span className="font-lora text-neutral-600">Price Range:</span>
                        <span className="font-poppins font-semibold text-neutral-700">
                          {business.price_range} ({getPriceRangeText(business.price_range)})
                        </span>
                      </div>
                    )}
                    
                    {business.service_area && (
                      <div className="flex items-center justify-between">
                        <span className="font-lora text-neutral-600">Service Area:</span>
                        <span className="font-poppins font-semibold text-neutral-700">
                          {business.service_area}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer with Action Buttons */}
        <div className="border-t border-neutral-200 p-4 sm:p-6 bg-neutral-50 rounded-b-2xl">
          <div className="flex items-center justify-center gap-4">
            {business.is_virtual && business.website_url ? (
              <a
                href={business.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-poppins bg-gradient-to-r from-primary-500 to-accent-500 text-white p-4 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
              >
                <Icons.Globe className="h-5 w-5" />
              </a>
            ) : business.is_mobile_business && business.phone_number ? (
              <a
                href={`tel:${business.phone_number}`}
                className="font-poppins bg-gradient-to-r from-primary-500 to-accent-500 text-white p-4 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
              >
                <Icons.Phone className="h-5 w-5" />
              </a>
            ) : (
              <button
                onClick={handleTakeMeThere}
                className="font-poppins bg-gradient-to-r from-primary-500 to-accent-500 text-white p-4 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
              >
                <Icons.Navigation className="h-5 w-5" />
              </button>
            )}
            
            {business.phone_number && (
              <a
                href={`tel:${business.phone_number}`}
                className="font-poppins bg-green-500 text-white p-4 rounded-lg font-semibold hover:bg-green-600 transition-colors duration-200 flex items-center justify-center"
              >
                <Icons.Phone className="h-5 w-5" />
              </a>
            )}
            
            <button
              onClick={onClose}
              className="font-poppins border border-neutral-300 text-neutral-700 p-4 rounded-lg font-semibold hover:bg-neutral-100 transition-colors duration-200 flex items-center justify-center"
            >
              <Icons.X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessProfileModal;