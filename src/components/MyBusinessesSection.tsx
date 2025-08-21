import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Plus, Eye, Menu, Edit, Trash2, Package, ChevronLeft, ChevronRight, Building, AlertCircle, Tag, MapPin, Calendar } from 'lucide-react';
import { BusinessService } from '../services/businessService';
import { OfferingService } from '../services/offeringService';
import BusinessProfileModal from './BusinessProfileModal';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types/user';
import type { Business } from '../services/supabaseClient';
import OfferingReviewsModal from './OfferingReviewsModal';

interface BusinessWithOfferings extends Business {
  offerings?: Array<{
    id: string;
    title: string;
    description?: string;
    tags: string[];
    price_cents?: number;
    currency: string;
    service_type: 'onsite' | 'mobile' | 'remote' | 'delivery';
    status: 'active' | 'inactive' | 'draft';
    created_at: string;
    updated_at: string;
    images?: Array<{
      id: string;
      url: string;
      is_primary: boolean;
      approved: boolean;
    }>;
  }>;
}

interface MyBusinessesSectionProps {
  user: User | null;
}

const MyBusinessesSection: React.FC<MyBusinessesSectionProps> = ({ user }) => {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<BusinessWithOfferings[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOfferings, setLoadingOfferings] = useState<{ [businessId: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [deletingBusinessId, setDeletingBusinessId] = useState<string | null>(null);
  const [isBusinessProfileModalOpen, setIsBusinessProfileModalOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);
  const [offeringPages, setOfferingPages] = useState<{ [businessId: string]: number }>({});
  const [isOfferingReviewsModalOpen, setIsOfferingReviewsModalOpen] = useState(false);
  const [selectedOfferingForReviews, setSelectedOfferingForReviews] = useState<{
    id: string;
    title: string;
    businessName: string;
  } | null>(null);

  const OFFERINGS_PER_PAGE = 5;

  useEffect(() => {
    const fetchMyBusinesses = async () => {
      if (!user || !user.id) {
        setLoading(false);
        setError('User not logged in or ID not available.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const userBusinesses = await BusinessService.getUserBusinesses(user.id);
        setBusinesses(userBusinesses);
        
        // Fetch offerings for each business
        for (const business of userBusinesses) {
          fetchBusinessOfferings(business.id);
        }
      } catch (err) {
        setError('Failed to load your businesses.');
        console.error('Error fetching user businesses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyBusinesses();
  }, [user]);

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
    } catch (error) {
      console.error(`Error fetching offerings for business ${businessId}:`, error);
    } finally {
      setLoadingOfferings(prev => ({ ...prev, [businessId]: false }));
    }
  };

  // Helper function to determine if business is currently open
  const isBusinessOpen = (business: Business): boolean => {
    // For demo purposes, return a random status
    // In production, this would parse business.hours and business.days_closed
    // to determine actual open/closed status based on current time
    return Math.random() > 0.3; // 70% chance of being open
  };

  // Helper function to get offering rating data
  const getOfferingRating = (offeringId: string) => {
    // For demo purposes, return mock rating data
    // In production, this would come from aggregated review data
    const thumbsUp = Math.floor(Math.random() * 20) + 5;
    const thumbsDown = Math.floor(Math.random() * 5);
    return { thumbsUp, thumbsDown };
  };

  // Helper function to get sample review for offering
  const getSampleReview = (offeringId: string): string => {
    // For demo purposes, return mock review text
    // In production, this would come from actual offering reviews
    const sampleReviews = [
      "Amazing taste and fresh ingredients!",
      "Perfect portion size and great value.",
      "Love the healthy options here.",
      "Excellent quality and service.",
      "Fresh and delicious every time!"
    ];
    return sampleReviews[Math.floor(Math.random() * sampleReviews.length)];
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

  const getServiceTypeBadge = (serviceType: string) => {
    const badges = {
      onsite: { label: 'On-site', color: 'bg-blue-100 text-blue-700' },
      mobile: { label: 'Mobile', color: 'bg-green-100 text-green-700' },
      remote: { label: 'Remote', color: 'bg-purple-100 text-purple-700' },
      delivery: { label: 'Delivery', color: 'bg-orange-100 text-orange-700' }
    };
    return badges[serviceType as keyof typeof badges] || badges.onsite;
  };

  const formatPrice = (priceCents?: number, currency: string = 'USD'): string => {
    if (!priceCents) return 'Free';
    const price = priceCents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price);
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
                              
                              {/* Rating Overlay - Bottom Right */}
                              <div className="absolute bottom-2 right-2">
                                {(() => {
                                  const rating = getOfferingRating(offering.id);
                                  const isPositive = rating.thumbsUp > rating.thumbsDown;
                                  return (
                                    <div className={`px-2 py-1 rounded-full text-white text-xs font-poppins font-bold flex items-center ${
                                      isPositive ? 'bg-green-500' : 'bg-red-500'
                                    }`}>
                                      {isPositive ? (
                                        <ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                                      ) : (
                                        <ThumbsDown className="h-3 w-3 mr-1 fill-current" />
                                      )}
                                      <span>{isPositive ? rating.thumbsUp : rating.thumbsDown}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            
                            {/* Offering Details */}
                            <div className="space-y-2">
                              <h6 className="font-poppins font-semibold text-primary-600 text-sm line-clamp-1">
                                {offering.title}
                              </h6>
                              
                              <p className="font-lora text-xs text-neutral-500 font-bold line-clamp-1">
                              </p>
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
                                
                                <button
                                  onClick={() => handleEditOffering(business.id, offering.id)}
                                  className="p-1.5 text-neutral-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors duration-200"
                                  title="Edit offering"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </div>
                              
                              {/* Sample Review */}
                              <div 
                                className="bg-neutral-50 rounded-lg p-2 cursor-pointer hover:bg-neutral-100 transition-colors duration-200"
                                onClick={() => handleOpenOfferingReviews(offering, business.name)}
                              >
                                <p className="font-lora text-xs text-neutral-600 italic line-clamp-2">
                                  "{getSampleReview(offering.id)}"
                                </p>
                                <p className="font-poppins text-xs text-primary-500 font-semibold mt-1">
                                  View all reviews →
                                </p>
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