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
import { showError, showSuccess } from '../utils/toast';
import { UserService } from '../services/userService';

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
  const [canScrollLeft, setCanScrollLeft] = useState<Record<string, boolean>>({});
  const [canScrollRight, setCanScrollRight] = useState<Record<string, boolean>>({});
  const offeringsScrollRefs = React.useRef<Map<string, HTMLDivElement | null>>(new Map());

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
      const success = await BusinessService.deleteBusiness(businessId);
      if (success) {
        setBusinesses(prev => prev.filter(business => business.id !== businessId));
        showSuccess('Business deleted successfully.');
      } else {
        throw new Error('Delete operation failed');
      }
    } catch (err) {
      console.error('Error deleting business:', err);
      showError(`Failed to delete business: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setDeletingBusinessId(null);
    }
  };

  const handleManageOfferings = (businessId: string) => {
    navigate(`/manage-offerings?businessId=${businessId}`);
  };

  const scrollOfferings = (businessId: string, direction: 'left' | 'right') => {
    const container = offeringsScrollRefs.current.get(businessId);
    if (!container) return;

    const scrollAmount = 300;
    const newScrollLeft = direction === 'left' 
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;
    
    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  const checkScrollButtons = (businessId: string) => {
    const container = offeringsScrollRefs.current.get(businessId);
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(prev => ({ ...prev, [businessId]: scrollLeft > 0 }));
    setCanScrollRight(prev => ({ ...prev, [businessId]: scrollLeft < scrollWidth - clientWidth - 1 }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-neutral-200 rounded w-48 animate-pulse"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200 animate-pulse">
              <div className="h-6 bg-neutral-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-full"></div>
                <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="font-poppins text-lg font-semibold text-red-700 mb-2">
          Error Loading Businesses
        </h3>
        <p className="font-lora text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchUserBusinesses}
          className="font-poppins bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors duration-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
            My Businesses ({businesses.length})
          </h2>
          <button
            onClick={handleAddBusiness}
            className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Business
          </button>
        </div>

        {businesses.length === 0 ? (
          <div className="bg-neutral-50 rounded-xl p-8 text-center">
            <Building className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
            <h3 className="font-poppins text-xl font-semibold text-neutral-700 mb-2">
              No Businesses Yet
            </h3>
            <p className="font-lora text-neutral-600 mb-6">
              Add your first business to start managing offerings and receiving reviews.
            </p>
            <button
              onClick={handleAddBusiness}
              className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
            >
              Add Your First Business
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {businesses.map((business) => (
              <div key={business.id} className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
                {/* Business Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start">
                    {business.image_url && (
                      <img
                        src={business.image_url}
                        alt={business.name}
                        className="w-16 h-16 rounded-lg object-cover mr-4"
                      />
                    )}
                    <div>
                      <h3 className="font-cinzel text-xl font-bold text-neutral-900 mb-1">
                        {business.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-neutral-600">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="font-lora">{business.address}</span>
                        </div>
                        <div className="flex items-center">
                          <Tag className="h-4 w-4 mr-1" />
                          <span className="font-lora">{business.category}</span>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                          isBusinessOpen(business) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isBusinessOpen(business) ? 'Open' : 'Closed'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Business Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewBusiness(business)}
                      className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="View business profile"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditBusiness(business)}
                      className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                      title="Edit business"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBusiness(business.id)}
                      disabled={deletingBusinessId === business.id}
                      className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                      title="Delete business"
                    >
                      {deletingBusinessId === business.id ? (
                        <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Business Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <ThumbsUp className="h-5 w-5 text-green-600 mr-2" />
                      <div>
                        <div className="font-poppins text-lg font-bold text-green-900">
                          {business.thumbs_up || 0}
                        </div>
                        <div className="font-lora text-xs text-green-700">Thumbs Up</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <ThumbsDown className="h-5 w-5 text-red-600 mr-2" />
                      <div>
                        <div className="font-poppins text-lg font-bold text-red-900">
                          {business.thumbs_down || 0}
                        </div>
                        <div className="font-lora text-xs text-red-700">Thumbs Down</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Package className="h-5 w-5 text-blue-600 mr-2" />
                      <div>
                        <div className="font-poppins text-lg font-bold text-blue-900">
                          {business.offerings?.length || 0}
                        </div>
                        <div className="font-lora text-xs text-blue-700">Offerings</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <MessageSquare className="h-5 w-5 text-purple-600 mr-2" />
                      <div>
                        <div className="font-poppins text-lg font-bold text-purple-900">
                          {Object.values(offeringReviewCounts).reduce((sum, count) => sum + count, 0)}
                        </div>
                        <div className="font-lora text-xs text-purple-700">Total Reviews</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Offerings Section */}
                <div className="border-t border-neutral-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-poppins text-lg font-semibold text-neutral-900 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-primary-500" />
                      Offerings ({business.offerings?.length || 0})
                    </h4>
                    <button
                      onClick={() => handleManageOfferings(business.id)}
                      className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center text-sm"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Manage Offerings
                    </button>
                  </div>

                  {loadingOfferings[business.id] ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
                    </div>
                  ) : !business.offerings || business.offerings.length === 0 ? (
                    <div className="bg-neutral-50 rounded-lg p-6 text-center">
                      <Package className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                      <h5 className="font-poppins font-semibold text-neutral-700 mb-2">
                        No Offerings Yet
                      </h5>
                      <p className="font-lora text-sm text-neutral-600 mb-4">
                        Add offerings to help customers find your business
                      </p>
                      <button
                        onClick={() => handleManageOfferings(business.id)}
                        className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                      >
                        Add Offerings
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Scroll buttons */}
                      {business.offerings.length > OFFERINGS_PER_PAGE && (
                        <>
                          <button
                            onClick={() => scrollOfferings(business.id, 'left')}
                            disabled={!canScrollLeft[business.id]}
                            className={`absolute left-0 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full border border-neutral-200 bg-white shadow-md ${
                              canScrollLeft[business.id] 
                                ? 'text-neutral-600 hover:bg-neutral-50' 
                                : 'text-neutral-300 cursor-not-allowed'
                            }`}
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => scrollOfferings(business.id, 'right')}
                            disabled={!canScrollRight[business.id]}
                            className={`absolute right-0 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full border border-neutral-200 bg-white shadow-md ${
                              canScrollRight[business.id] 
                                ? 'text-neutral-600 hover:bg-neutral-50' 
                                : 'text-neutral-300 cursor-not-allowed'
                            }`}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      )}

                      {/* Offerings grid */}
                      <div 
                        ref={(el) => offeringsScrollRefs.current.set(business.id, el)}
                        className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide"
                        onScroll={() => checkScrollButtons(business.id)}
                      >
                        {business.offerings.map((offering) => {
                          const primaryImage = offering.images?.find(img => img.is_primary && img.approved);
                          const fallbackImage = offering.images?.find(img => img.approved);
                          const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';
                          const serviceBadge = getServiceTypeBadge(offering.service_type);
                          const reviewCount = offeringReviewCounts[offering.id] || 0;

                          return (
                            <div key={offering.id} className="flex-shrink-0 w-64 bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                              <div className="relative mb-3">
                                <img
                                  src={imageUrl}
                                  alt={offering.title}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                                <div className="absolute top-2 left-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${serviceBadge.color}`}>
                                    {serviceBadge.label}
                                  </span>
                                </div>
                              </div>
                              
                              <h5 className="font-poppins font-semibold text-neutral-900 mb-1 line-clamp-1">
                                {offering.title}
                              </h5>
                              
                              {offering.description && (
                                <p className="font-lora text-sm text-neutral-600 mb-2 line-clamp-2">
                                  {offering.description}
                                </p>
                              )}
                              
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center text-neutral-500">
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  <span className="font-lora text-sm">{reviewCount}</span>
                                </div>
                              </div>
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleOpenOfferingReviews(offering, business.name)}
                                  className="flex-1 bg-purple-100 text-purple-700 px-3 py-2 rounded-lg font-poppins font-semibold hover:bg-purple-200 transition-colors duration-200 flex items-center justify-center text-xs"
                                >
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Reviews
                                </button>
                                <button
                                  onClick={() => handleEditOffering(business.id, offering.id)}
                                  className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg font-poppins font-semibold hover:bg-blue-200 transition-colors duration-200 flex items-center justify-center text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Business Profile Modal */}
      <BusinessProfileModal
        isOpen={isBusinessProfileModalOpen}
        onClose={() => setIsBusinessProfileModalOpen(false)}
        business={selectedBusinessForProfile}
      />

      {/* Offering Reviews Modal */}
      <OfferingReviewsModal
        isOpen={isOfferingReviewsModalOpen}
        onClose={() => {
          setIsOfferingReviewsModalOpen(false);
          setSelectedOfferingForReviews(null);
        }}
        offeringId={selectedOfferingForReviews?.id || ''}
        offeringTitle={selectedOfferingForReviews?.title || ''}
        businessName={selectedOfferingForReviews?.businessName || ''}
      />
    </>
  );
};

export default MyBusinessesSection;