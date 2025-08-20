import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { BusinessService } from '../services/businessService';
import BusinessProfileModal from './BusinessProfileModal';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types/user';
import type { Business } from '../services/supabaseClient';
// Force rebuild to clear stale cache

interface MyBusinessesSectionProps {
  user: User | null;
}

const MyBusinessesSection: React.FC<MyBusinessesSectionProps> = ({ user }) => {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingBusinessId, setDeletingBusinessId] = useState<string | null>(null);
  const [isBusinessProfileModalOpen, setIsBusinessProfileModalOpen] = useState(false);
  const [selectedBusinessForProfile, setSelectedBusinessForProfile] = useState<Business | null>(null);

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
      } catch (err) {
        setError('Failed to load your businesses.');
        console.error('Error fetching user businesses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyBusinesses();
  }, [user]);

  const handleAddBusiness = () => {
    navigate('/add-business');
  };

  const handleViewBusiness = (business: Business) => {
    setSelectedBusinessForProfile(business);
    setIsBusinessProfileModalOpen(true);
  };

  const handleEditBusiness = (business: Business) => {
    // For now, navigate to add-business page with edit parameter. AddBusinessPage needs to handle loading data.
    navigate(`/add-business?edit=${business.id}`);
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business? This action cannot be undone.')) {
      return;
    }

    setDeletingBusinessId(businessId);
    try {
      await BusinessService.deleteBusiness(businessId);
      // Remove the business from the local state
      setBusinesses(prev => prev.filter(business => business.id !== businessId));
    } catch (err) {
      console.error('Error deleting business:', err);
      setError('Failed to delete business. Please try again.');
    } finally {
      setDeletingBusinessId(null);
    }
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
        <Icons.AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <h3 className="font-poppins text-lg font-semibold text-red-700 mb-2">
          Error Loading Businesses
        </h3>
        <p className="font-lora text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-neutral-900"> 
          My Businesses ({businesses.length})
        </h2>
        <button
          onClick={handleAddBusiness}
          className="font-poppins bg-primary-500 text-white px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center"
        >
          <Icons.Plus className="h-3 w-3 mr-1.5 sm:h-4 sm:w-4 sm:mr-2" />
          Add New Business
        </button>
      </div>

      {businesses.length === 0 ? (
        <div className="bg-neutral-50 rounded-xl p-6 text-center">
          <Icons.Building className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
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
            <Icons.Plus className="h-4 w-4 mr-1.5 sm:h-5 sm:w-5 sm:mr-2" />
            Add Your First Business
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {businesses.map((business) => (
            <div key={business.id} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 hover:bg-white transition-all duration-200">
              {/* Business Name - Line 1 */}
              <div className="flex items-center gap-3 mb-2">
                {/* Business Image - 25% */}
                <div className="w-1/4 flex-shrink-0">
                  <img
                    src={business.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400'}
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
              
              {/* Status and Thumbs Up - Line 2 */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                  business.is_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {business.is_verified ? 'Verified' : 'Pending Verification'}
                </span>
                {business.thumbs_up > 0 && (
                  <div className="flex items-center bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    <Icons.ThumbsUp className="h-3 w-3 mr-1 fill-current" />
                    <span className="font-poppins text-xs font-semibold">{business.thumbs_up} Thumbs Up</span>
                  </div>
                )}
              </div>
              
              {/* Category and Date - Line 3 */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Icons.Tag className="h-4 w-4 text-neutral-500 mr-1" />
                <span className="font-lora text-sm text-neutral-600">{business.category}</span>
                <span className="font-lora text-sm text-neutral-600">•</span>
                <span className="font-lora text-sm text-neutral-600">
                  {new Date(business.created_at).toLocaleDateString()}
                </span>
              </div>
              
              {/* Address - Line 4 */}
              <div className="flex items-center mb-2">
                <Icons.MapPin className="h-4 w-4 text-neutral-500 mr-1" />
                <span className="font-lora text-sm text-neutral-600 break-words">{business.address}</span>
              </div>
              
              {/* Actions - Line 5 */}
              <div className="flex items-center justify-between">
                <div></div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewBusiness(business)}
                    className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="View Business"
                  >
                    <Icons.Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/manage-offerings?businessId=${business.id}`)}
                    className="p-2 text-neutral-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                    title="Manage Offerings"
                  >
                    <Icons.Menu className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditBusiness(business)}
                    className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Edit Business"
                  >
                    <Icons.Edit className="h-4 w-4" />
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
                      <Icons.Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BusinessProfileModal
        isOpen={isBusinessProfileModalOpen}
        onClose={() => setIsBusinessProfileModalOpen(false)}
        business={selectedBusinessForProfile}
      />

      <BusinessProfileModal
        isOpen={isBusinessProfileModalOpen}
        onClose={() => setIsBusinessProfileModalOpen(false)}
        business={selectedBusinessForProfile}
      />
    </div>
  );
};

export default MyBusinessesSection;