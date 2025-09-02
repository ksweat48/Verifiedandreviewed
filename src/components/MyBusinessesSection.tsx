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
import { UserService } from '../services/userService';
import { showSuccess } from '../utils/toast';

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
      await BusinessService.deleteBusiness(businessId);
      setBusinesses(prev => prev.filter(business => business.id !== businessId));
      showSuccess('Business deleted successfully.');
    } catch (err) {
      console.error('Error deleting business:', err);
      showError(`Failed to delete business: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setDeletingBusinessId(null);
    }
  };

  // Helper function to determine if business is currently open