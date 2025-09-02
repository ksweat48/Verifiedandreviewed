import { supabase } from './supabaseClient';

export interface UserReview {
  id: string;
  user_id: string;
  business_id: string;
  offering_id?: string;
  review_text: string;
  rating: number;
  image_urls: string[];
  status: 'pending' | 'approved' | 'rejected';
  is_visible: boolean;
  views: number;
  created_at: string;
  updated_at: string;
}

export class ReviewService {
  // Toggle review visibility (for admin use)
  static async toggleReviewVisibility(reviewId: string, isVisible: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_reviews')
        .update({ 
          is_visible: isVisible,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error toggling review visibility:', error);
      return false;
    }
  }

  // Get all reviews for admin management
  static async getAllReviews(): Promise<UserReview[]> {
    try {
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          *,
          profiles!inner (
            id,
            name,
            email
          ),
          businesses!left (
            id,
            name,
            location
          ),
          offerings!left (
            id,
            title,
            businesses!inner (
              id,
              name,
              location
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all reviews:', error);
      return [];
    }
  }

  // Get pending reviews for admin approval
  static async getPendingReviews(): Promise<UserReview[]> {
    try {
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          *,
          profiles!inner (
            id,
            name,
            email
          ),
          businesses!left (
            id,
            name,
            location
          ),
          offerings!left (
            id,
            title,
            businesses!inner (
              id,
              name,
              location
            )
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pending reviews:', error);
      return [];
    }
  }

  // Approve a review
  static async approveReview(reviewId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_reviews')
        .update({ 
          status: 'approved',
          is_visible: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error approving review:', error);
      return false;
    }
  }

  // Reject a review
  static async rejectReview(reviewId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_reviews')
        .update({ 
          status: 'rejected',
          is_visible: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error rejecting review:', error);
      return false;
    }
  }

  // Delete a review
  static async deleteReview(reviewId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting review:', error);
      return false;
    }
  }

  // Get approved reviews for a business
  static async getReviewsForBusiness(businessId: string | string[]): Promise<UserReview[]> {
    try {
      // Handle both single businessId and array of businessIds
      const isArray = Array.isArray(businessId);
      const businessIds = isArray ? businessId : [businessId];
      
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          *,
          profiles!inner (
            id,
            name,
            avatar_url
          )
        `)
        .in('business_id', businessIds)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching business reviews:', error);
      return [];
    }
  }

  // Get approved reviews for an offering
  static async getReviewsForOffering(offeringIds: string | string[]): Promise<UserReview[]> {
    try {
      // Handle both single offeringId and array of offeringIds
      const isArray = Array.isArray(offeringIds);
      const offeringIdArray = isArray ? offeringIds : [offeringIds];
      
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          *,
          profiles!inner (
            id,
            name,
            avatar_url
          )
        `)
        .in('offering_id', offeringIdArray)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching offering reviews:', error);
      return [];
    }
  }

  // Legacy alias for backward compatibility
  static async getBusinessReviews(businessId: string | string[]): Promise<UserReview[]> {
    return this.getReviewsForBusiness(businessId);
  }

  // Get user's reviews
  static async getUserReviews(userId: string): Promise<UserReview[]> {
    try {
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          *,
          businesses!left (
            id,
            name,
            location
          ),
          offerings!left (
            id,
            title,
            businesses!inner (
              id,
              name,
              location
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      return [];
    }
  }
}