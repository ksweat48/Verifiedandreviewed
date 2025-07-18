import React, { useState, useEffect } from 'react';
import { Building, Plus, Edit, Eye, Shield, AlertCircle, Trash2 } from 'lucide-react';
import { BusinessService } from '../services/businessService';
import BusinessProfileModal from './BusinessProfileModal';
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
          Add New Business
        </button>
      </div>

      {businesses.length === 0 ? (
        <div className="bg-neutral-50 rounded-2xl p-8 text-center">
          <Building className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
          <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
            No Businesses Added Yet
          </h3>
          <p className="font-lora text-neutral-600 mb-4">
            Add your business to get it verified and reviewed by our community.
          </p>
          <button
            onClick={handleAddBusiness}
            className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Your First Business
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {businesses.map((business) => (
            <div key={business.id} className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-2">
                    {business.name}
                  </h3>
                  <p className="font-lora text-neutral-600 text-sm mb-2">
                    {business.address} • {business.category}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-poppins font-semibold ${
                      business.is_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {business.is_verified ? (
                        <>
                          <Shield className="h-3 w-3 inline mr-1" /> Verified
                        </>
                      ) : (
                        'Pending Verification'
                      )}
                    </span>
                    {business.thumbs_up > 0 && (
                      <span className="px-2 py-1 rounded-full text-xs font-poppins font-semibold bg-blue-100 text-blue-700">
                        {business.thumbs_up} Thumbs Up
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewBusiness(business)}
                    className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="View Business"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditBusiness(business)}
                    className="p-2 text-neutral-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                    title="Edit Business"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
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