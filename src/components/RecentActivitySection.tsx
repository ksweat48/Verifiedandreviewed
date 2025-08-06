import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import LeaveReviewModal from './LeaveReviewModal';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { ActivityService } from '../services/activityService';

interface RecentActivity {
  id: string;
  name: string;
  image: string;
  address: string;
  activityDate: string;
  activityType: 'business_view' | 'search' | 'review_submit';
  businessId?: string;
  searchQuery?: string;
}

const RecentActivitySection: React.FC = () => {
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null); 
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchRecentActivities();
    } else {
      setRecentActivities([]);
      setLoading(false);
    }
  }, [user]);
  
  // Listen for activity updates
  useEffect(() => {
    const handleActivityUpdate = () => {
      if (user) {
        fetchRecentActivities();
      }
    };
    
    window.addEventListener('visited-businesses-updated', handleActivityUpdate);
    
    return () => {
      window.removeEventListener('visited-businesses-updated', handleActivityUpdate);
    };
  }, [user]);
  
  const fetchRecentActivities = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch recent business view activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('user_activity_logs')
        .select(`
          id,
          event_type,
          event_details,
          created_at
        `)
        .eq('user_id', user.id)
        .in('event_type', ['business_view', 'search', 'review_submit'])
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (activitiesError) throw activitiesError;
      
      if (activitiesData) {
        // Get unique business IDs from business_view activities
        const businessIds = activitiesData
          .filter(activity => activity.event_type === 'business_view' && activity.event_details?.business_id)
          .map(activity => activity.event_details.business_id)
          .filter((id, index, array) => array.indexOf(id) === index); // Remove duplicates
        
        // Fetch business details for these IDs
        let businessDetailsMap = new Map();
        if (businessIds.length > 0) {
          const { data: businessesData, error: businessesError } = await supabase
            .from('businesses')
            .select('id, name, image_url, address')
            .in('id', businessIds);
          
          if (!businessesError && businessesData) {
            businessesData.forEach(business => {
              businessDetailsMap.set(business.id, business);
            });
          }
        }
        
        // Transform activities to display format
        const formattedActivities: RecentActivity[] = activitiesData
          .map(activity => {
            if (activity.event_type === 'business_view') {
              const businessDetails = businessDetailsMap.get(activity.event_details?.business_id);
              if (businessDetails) {
                return {
                  id: activity.id,
                  name: businessDetails.name,
                  image: businessDetails.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                  address: businessDetails.address || 'No address available',
                  activityDate: new Date(activity.created_at).toLocaleDateString(),
                  activityType: 'business_view',
                  businessId: activity.event_details?.business_id
                };
              }
            } else if (activity.event_type === 'search') {
              return {
                id: activity.id,
                name: `Search: "${activity.event_details?.search_query || 'Unknown query'}"`,
                image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                address: `${activity.event_details?.search_type || 'platform'} search`,
                activityDate: new Date(activity.created_at).toLocaleDateString(),
                activityType: 'search',
                searchQuery: activity.event_details?.search_query
              };
            } else if (activity.event_type === 'review_submit') {
              const businessDetails = businessDetailsMap.get(activity.event_details?.business_id);
              if (businessDetails) {
                return {
                  id: activity.id,
                  name: businessDetails.name,
                  image: businessDetails.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
                  address: businessDetails.address || 'No address available',
                  activityDate: new Date(activity.created_at).toLocaleDateString(),
                  activityType: 'review_submit',
                  businessId: activity.event_details?.business_id
                };
              }
            }
            return null;
          })
          .filter(Boolean) as RecentActivity[];
        
        setRecentActivities(formattedActivities);
      } else {
        setRecentActivities([]);
      }
    } catch (err) {
      console.error('Error fetching recent activities:', err);
      setRecentActivities([]);
    } finally {
      setLoading(false);
    }
  };

  // Get business view activities that haven't been reviewed yet
  const getUnreviewedBusinessViews = () => {
    return recentActivities.filter(activity => 
      activity.activityType === 'business_view' && activity.businessId
    );
  };

  const openReviewModal = async (activity: RecentActivity) => {
    if (!activity.businessId) return;
    
    try {
      // Fetch full business details for the review modal
      const { data: businessData, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', activity.businessId)
        .single();
      
      if (error || !businessData) {
        console.error('Error fetching business details:', error);
        return;
      }
      
      setSelectedBusiness({
        id: businessData.id,
        name: businessData.name,
        image: businessData.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
        address: businessData.address || 'No address available',
        visitDate: activity.activityDate
      });
    } catch (error) {
      console.error('Error preparing review modal:', error);
    }
    
    setReviewModalOpen(true);
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'business_view':
        return <Icons.Eye className="h-4 w-4 text-blue-500" />;
      case 'search':
        return <Icons.Search className="h-4 w-4 text-purple-500" />;
      case 'review_submit':
        return <Icons.Star className="h-4 w-4 text-green-500" />;
      default:
        return <Icons.Activity className="h-4 w-4 text-neutral-500" />;
    }
  };

  const getActivityDescription = (activity: RecentActivity) => {
    switch (activity.activityType) {
      case 'business_view':
        return 'Viewed business';
      case 'search':
        return 'Searched for';
      case 'review_submit':
        return 'Reviewed business';
      default:
        return 'Activity';
    }
  };

  const handleSubmitReview = (review: {
    businessId: string;
    rating: 'thumbsUp' | 'thumbsDown';
    text: string;
  }) => {
    // Refresh activities after review submission
    if (user) {
      fetchRecentActivities();
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-cinzel text-xl font-bold text-neutral-900 flex items-center">
          <Icons.Activity className="h-5 w-5 mr-2 text-primary-500" />
          Recent Activity
        </h2>
      </div>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-neutral-50 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-neutral-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                  <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : recentActivities.length === 0 ? (
        <div className="bg-neutral-50 rounded-lg p-6 text-center">
          <Icons.Activity className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
          <h4 className="font-poppins font-semibold text-neutral-700 mb-1">
            No activity yet
          </h4>
          <p className="font-lora text-sm text-neutral-600">
            Your recent searches and business views will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recentActivities.slice(0, 5).map((activity) => (
            <div 
              key={activity.id} 
              className="bg-neutral-50 rounded-lg p-4 border border-neutral-100 hover:border-primary-200 transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-neutral-200 flex-shrink-0">
                  {getActivityIcon(activity.activityType)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-poppins font-semibold text-neutral-900 text-sm">
                        {getActivityDescription(activity)}
                      </h4>
                      <p className="font-lora text-xs text-neutral-600 line-clamp-1">
                        {activity.name}
                      </p>
                      <p className="font-lora text-xs text-neutral-500">
                        {activity.activityDate}
                      </p>
                    </div>
                    
                    {activity.activityType === 'business_view' && activity.businessId && (
                      <button
                        onClick={() => openReviewModal(activity)}
                        className="bg-primary-500 text-white px-3 py-1 rounded-lg font-poppins font-semibold text-xs hover:bg-primary-600 transition-colors duration-200"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedBusiness && (
        <LeaveReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          business={selectedBusiness}
          onSubmitReview={handleSubmitReview}
        />
      )}
    </div>
  );
};

export default RecentActivitySection;