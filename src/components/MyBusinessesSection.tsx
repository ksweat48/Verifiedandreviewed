import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Plus, Eye, Menu, Edit, Trash2, Package, ChevronLeft, ChevronRight, Building, AlertCircle, Tag, MapPin, Calendar, Phone } from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import { format, getDay, getHours, getMinutes } from 'date-fns';
import { BusinessService } from '../services/businessService';
import { OfferingService } from '../services/offeringService';
import BusinessProfileModal from './BusinessProfileModal';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types/user';
import type { Business } from '../services/supabaseClient';
import OfferingReviewsModal from './OfferingReviewsModal';
import { ReviewService } from '../services/reviewService';
import { getServiceTypeBadge, formatPrice } from '../utils/displayUtils';
import { showError } from '../utils/toast';

interface MyBusinessesSectionProps {
  user: User;
}

const MyBusinessesSection: React.FC<MyBusinessesSectionProps> = ({ user }) => {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState<Record<string, boolean>>({});
  const [deletingBusinessId, setDeletingBusinessId] = useState<string | null>(null);
  const [isBusinessProfileModalOpen, setIsBusinessProfileModalOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);
  const [isOfferingReviewsModalOpen, setIsOfferingReviewsModalOpen] = useState(false);
  const [selectedOfferingForReviews, setSelectedOfferingForReviews] = useState<{
    id: string;
    title: string;
    businessName: string;
  } | null>(null);
  const [offeringPages, setOfferingPages] = useState<Record<string, number>>({});
  const [offeringReviewCounts, setOfferingReviewCounts] = useState<Record<string, number>>({});

  const OFFERINGS_PER_PAGE = 5;

  useEffect(() => {
    fetchUserBusinesses();
  }, [user.id]);

  const fetchUserBusinesses = async () => {
    try {
      setLoading(true);
      const userBusinesses = await BusinessService.getUserBusinesses(user.id);
      setBusinesses(userBusinesses);
      
      // Fetch offerings for each business
      for (const business of userBusinesses) {
        await fetchBusinessOfferings(business.id);
      }
    } catch (err) {
      console.error('Error fetching user businesses:', err);
      setError('Failed to load your businesses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessOfferings = async (businessId: string) => {
    setLoadingOfferings(prev => ({ ...prev, [businessId]: true }));
    
    try {
      const offerings = await OfferingService.getBusinessOfferings(businessId);
      
      // Update the specific business with its offerings
      setBusinesses(prev => prev.map(business => 
        business.id === businessId 
          ? { ...business, offerings }
          : business
      ));
      
      // Fetch review counts for all offerings
      if (offerings.length > 0) {
        const offeringIds = offerings.map(o => o.id);
        console.log('📊 Fetching review counts for offerings:', offeringIds);
        try {
          const reviewCounts: Record<string, number> = {};
          
          // Fetch reviews for all offerings concurrently
          const reviewPromises = offeringIds.map(async (offeringId) => {
            try {
              const reviews = await ReviewService.getReviewsForOffering(offeringId);
              reviewCounts[offeringId] = reviews.length;
            } catch (error) {
              console.error(`Error fetching reviews for offering ${offeringId}:`, error);
              reviewCounts[offeringId] = 0;
            }
          });
          
          await Promise.all(reviewPromises);
          setOfferingReviewCounts(prev => ({ ...prev, ...reviewCounts }));
          console.log('✅ Review counts fetched for business offerings:', reviewCounts);
        } catch (error) {
          console.error('Error fetching offering review counts:', error);
        }
      }
    } catch (error) {
      console.error(`Error fetching offerings for business ${businessId}:`, error);
    } finally {
      setLoadingOfferings(prev => ({ ...prev, [businessId]: false }));
    }
  };

  // Helper function to determine if business is currently open
  const isBusinessOpen = (business: Business): boolean => {
    if (!business.hours) return false;
    
    const now = new Date();
    const currentDay = getDay(now); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = getHours(now);
    const currentMinute = getMinutes(now);
    const currentTime = currentHour * 60 + currentMinute; // Convert to minutes
    
    // Check if today is a closed day
    if (business.days_closed) {
      const closedDays = business.days_closed.toLowerCase();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayName = dayNames[currentDay];
      
      if (closedDays.includes(todayName) || closedDays.includes('daily')) {
        return false;
      }
    }
    
    // Parse business hours (simplified parsing for common formats)
    const hours = business.hours.toLowerCase();
    
    // Handle "24/7" or "24 hours"
    if (hours.includes('24') && (hours.includes('7') || hours.includes('hour'))) {
      return true;
    }
    
    // Handle "closed" status
    if (hours.includes('closed')) {
      return false;
    }
    
    // Try to parse time ranges like "9AM - 5PM" or "Monday - Friday 9AM - 5PM"
    const timeMatch = hours.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?\s*-\s*(\d{1,2}):?(\d{0,2})\s*(am|pm)/i);
    
    if (timeMatch) {
      const [, startHour, startMin = '0', startPeriod, endHour, endMin = '0', endPeriod] = timeMatch;
      
      // Convert to 24-hour format
      let openHour = parseInt(startHour);
      let closeHour = parseInt(endHour);
      
      if (startPeriod && startPeriod.toLowerCase() === 'pm' && openHour !== 12) {
        openHour += 12;
      }
      if (startPeriod && startPeriod.toLowerCase() === 'am' && openHour === 12) {
        openHour = 0;
      }
      
      if (endPeriod && endPeriod.toLowerCase() === 'pm' && closeHour !== 12) {
        closeHour += 12;
      }
      if (endPeriod && endPeriod.toLowerCase() === 'am' && closeHour === 12) {
        closeHour = 0;
      }
      
      const openTime = openHour * 60 + parseInt(startMin);
      const closeTime = closeHour * 60 + parseInt(endMin);
      
      // Handle overnight hours (e.g., 10PM - 2AM)
      if (closeTime < openTime) {
        return currentTime >= openTime || currentTime <= closeTime;
      } else {
        return currentTime >= openTime && currentTime <= closeTime;
      }
    }
    
    // Default to closed if we can't parse the hours
    return false;
  };

  // Helper function to get offering rating data
  const getOfferingRating = (offeringId: string) => {
    // Return empty rating data until real reviews are integrated
    return { thumbsUp: 0, thumbsDown: 0 };
  };

  const handleOpenOfferingReviews = (offering: any, businessName: string) => {
    setSelectedOfferingForReviews({
      id: offering.id,
      title: offering.title,
      businessName: businessName
    });
    setIsOfferingReviewsModalOpen(true);
  };

  const handleAddBusiness = () => {
    navigate('/add-business');
  };

  const handleViewBusiness = (business: Business) => {
    setSelectedBusinessForProfile(business);
    setIsBusinessProfileModalOpen(true);
  };

  const handleEditBusiness = (business: Business) => {
    navigate(`/add-business?edit=${business.id}`);
  };

  const handleEditOffering = (businessId: string, offeringId: string) => {
    navigate(`/manage-offerings?businessId=${businessId}&offeringId=${offeringId}`);
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
      return;
    }

    setDeletingBusinessId(businessId);
    try {
      await BusinessService.deleteBusiness(businessId);
      setBusinesses(prev => prev.filter(business => business.id !== businessId));
    } catch (err) {
      console.error('Error deleting business:', err);
      setError('Failed to delete business. Please try again.');
    } finally {
      setDeletingBusinessId(null);
    }
  };

  const getOfferingPage = (businessId: string): number => {
    return offeringPages[businessId] || 0;
  };

  const setOfferingPage = (businessId: string, page: number) => {
    setOfferingPages(prev => ({ ...prev, [businessId]: page }));
  };

  const getPaginatedOfferings = (offerings: any[], businessId: string) => {
    const currentPage = getOfferingPage(businessId);
    const startIndex = currentPage * OFFERINGS_PER_PAGE;
    return offerings.slice(startIndex, startIndex + OFFERINGS_PER_PAGE);
  };

  const getTotalPages = (offerings: any[]): number => {
    return Math.ceil(offerings.length / OFFERINGS_PER_PAGE);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 text-center">
        <div className="animate-pulse">
          <div className="h-6 bg-neutral-200 rounded w-1/2 mx-auto mb-4"></div>
          <div className="h-4 bg-neutral-200 rounded w-1/3 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <h3 className="font-poppins text-lg font-semibold text-red-700 mb-2">
          Error Loading Businesses
        </h3>
        <p className="font-lora text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-neutral-900"> 
          My Businesses ({businesses.length})
        </h2>
        <button
          onClick={handleAddBusiness}
          className="font-poppins bg-primary-500 text-white px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center"
        >
          <Plus className="h-3 w-3 mr-1.5 sm:h-4 sm:w-4 sm:mr-2" />
          Add New Business
        </button>
      </div>

      {businesses.length === 0 ? (
        <div className="bg-neutral-50 rounded-xl p-6 text-center">
          <Building className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
            No Businesses Added Yet
          </h3>
          <p className="font-lora text-neutral-600 mb-4">
            Add your business to get it verified and reviewed by our community.
          </p>
          <button
            onClick={handleAddBusiness}
            className="font-poppins bg-primary-500 text-white px-4 py-2 text-sm sm:px-6 sm:py-3 sm:text-base rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            <Plus className="h-4 w-4 mr-1.5 sm:h-5 sm:w-5 sm:mr-2" />
            Add Your First Business
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {businesses.map((business) => {
            const currentPage = getOfferingPage(business.id);
            const totalPages = getTotalPages(business.offerings || []);
            const paginatedOfferings = getPaginatedOfferings(business.offerings || [], business.id);
            
            return (
              <div key={business.id} className="bg-white rounded-xl p-6 border border-neutral-200 hover:shadow-md transition-all duration-200">
                {/* Business Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-20 h-20 flex-shrink-0">
                    <img
                      src={business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400'}
                      alt={business.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-1">
                      {business.name}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                        business.is_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {business.is_verified ? 'Verified' : 'Pending Verification'}
                      </span>
                      {business.thumbs_up > 0 && (
                        <div className="flex items-center bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          <ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                          <span className="font-poppins text-xs font-semibold">{business.thumbs_up} Thumbs Up</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-neutral-600">
                      <div className="flex items-center">
                        <Tag className="h-4 w-4 mr-1" />
                        <span className="font-lora">{business.category}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="font-lora">{business.address}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewBusiness(business)}
                      className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="View Business"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/manage-offerings?businessId=${business.id}`)}
                      className="p-2 text-neutral-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                      title="Manage Offerings"
                    >
                      <Menu className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditBusiness(business)}
                      className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                      title="Edit Business"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBusiness(business.id)}
                      className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Delete Business"
                      disabled={deletingBusinessId === business.id}
                    >
                      {deletingBusinessId === business.id ? (
                        <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Offerings Section */}
                <div className="border-t border-neutral-200 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-poppins text-lg font-semibold text-neutral-900 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-primary-500" />
                      Offerings ({business.offerings?.length || 0})
                    </h4>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOfferingPage(business.id, Math.max(0, currentPage - 1))}
                          disabled={currentPage === 0}
                          className="p-1 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        
                        <span className="font-poppins text-sm text-neutral-600">
                          {currentPage + 1} of {totalPages}
                        </span>
                        
                        <button
                          onClick={() => setOfferingPage(business.id, Math.min(totalPages - 1, currentPage + 1))}
                          disabled={currentPage === totalPages - 1}
                          className="p-1 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Offerings Display */}
                  {loadingOfferings[business.id] ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-neutral-100 rounded-lg h-32 animate-pulse"></div>
                      ))}
                    </div>
                  ) : !business.offerings || business.offerings.length === 0 ? (
                    <div className="bg-neutral-50 rounded-lg p-6 text-center">
                      <Package className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                      <h5 className="font-poppins font-semibold text-neutral-700 mb-1">
                        No Offerings Yet
                      </h5>
                      <p className="font-lora text-sm text-neutral-600 mb-3">
                        Add offerings to help customers find your services
                      </p>
                      <button
                        onClick={() => navigate(`/manage-offerings?businessId=${business.id}`)}
                        className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 text-sm"
                      >
                        Add Offerings
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {paginatedOfferings.map((offering) => {
                        const serviceTypeBadge = getServiceTypeBadge(offering.service_type);
                        // Get the primary image from offering_images, fallback to business image
                        const primaryImage = offering.images?.find(img => img.is_primary && img.approved);
                        const fallbackImage = offering.images?.find(img => img.approved);
                        const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';
                        
                        return (
                          <div key={offering.id} className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 hover:shadow-sm transition-all duration-200">
                            {/* Offering Image */}
                            <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-neutral-100">
                              <img
                                src={imageUrl}
                                alt={offering.title}
                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                              />
                              
                              {/* Open/Closed Overlay - Bottom Left */}
                              <div className="absolute bottom-2 left-2">
                                <div className={`px-2 py-1 rounded-full text-white text-xs font-poppins font-bold ${
                                  isBusinessOpen(business) ? 'bg-green-500' : 'bg-red-500'
                                }`}>
                                  {isBusinessOpen(business) ? 'OPEN' : 'CLOSED'}
                                </div>
                            </div>
                          </div>
                          
                          {/* Offering Details */}
                          <div className="space-y-2">
                            <h6 className="font-poppins font-bold text-black text-sm line-clamp-1">
                              {offering.title}
                            </h6>
                            
                            <p className="font-lora text-xs text-black font-bold line-clamp-1">
                              at {business.name}
                            </p>
                            
                            {offering.description && (
                              <p className="font-lora text-xs text-neutral-600 line-clamp-2">
                                {offering.description}
                              </p>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <span className="font-poppins font-bold text-primary-600 text-sm">
                                {formatPrice(offering.price_cents, offering.currency)}
                              </span>
                            </div>
                            
                            {/* Action Buttons - Phone, Reviews, Directions */}
                            <div className="flex items-center justify-between gap-2 mt-2">
                              {business.phone_number && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`tel:${business.phone_number}`, '_self');
                                  }}
                                  className="p-2 bg-green-100 hover:bg-green-200 text-green-600 hover:text-green-700 rounded-lg transition-all duration-200 flex items-center justify-center"
                                  title="Call business"
                                >
                                  <Phone className="h-4 w-4" />
                                </button>
                              )}
                              
                              {/* Review Icon with Notification Badge */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenOfferingReviews(offering, business.name);
                                  }}
                                  className="p-2 bg-purple-100 hover:bg-purple-200 text-purple-600 hover:text-purple-700 rounded-lg transition-all duration-200 flex items-center justify-center"
                                  title="View reviews"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </button>
                                {/* Review Count Notification Badge */}
                                {offeringReviewCounts[offering.id] > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                                    {offeringReviewCounts[offering.id]}
                                  </span>
                                )}
                              </div>
                              
                              {business.address && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    let mapsUrl;
                                    if (business.latitude && business.longitude) {
                                      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
                                    } else {
                                      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
                                    }
                                    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                                  }}
                                  className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-700 rounded-lg transition-all duration-200 flex items-center justify-center"
                                  title="Get directions"
                                >
                                  <MapPin className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                              
                              {offering.tags && offering.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {offering.tags.slice(0, 2).map((tag, index) => (
                                    <span key={index} className="bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full text-xs font-lora">
                                      {tag}
                                    </span>
                                  ))}
                                  {offering.tags.length > 2 && (
                                    <span className="bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full text-xs font-lora">
                                      +{offering.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Edit Button - Only in Dashboard */}
                            <div className="flex items-center justify-end mt-2">
                              <button
                                onClick={() => handleEditOffering(business.id, offering.id)}
                                className="p-1.5 text-neutral-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors duration-200"
                                title="Edit offering"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BusinessProfileModal
        isOpen={isBusinessProfileModalOpen}
        onClose={() => setIsBusinessProfileModalOpen(false)}
        business={selectedBusinessForProfile}
      />
      
      {/* Offering Reviews Modal */}
      {selectedOfferingForReviews && (
        <OfferingReviewsModal
          isOpen={isOfferingReviewsModalOpen}
          onClose={() => {
            setIsOfferingReviewsModalOpen(false);
            setSelectedOfferingForReviews(null);
          }}
          offeringId={selectedOfferingForReviews.id}
          offeringTitle={selectedOfferingForReviews.title}
          businessName={selectedOfferingForReviews.businessName}
        />
      )}
    </div>
  );
};

export default MyBusinessesSection;