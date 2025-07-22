import { supabase } from './supabaseClient';

export interface UserReview {
  id: string;
  user_id: string;
  business_id: string;
  review_text: string;
  rating: number;
  image_urls: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export class ReviewService {
  // Get all pending reviews for admin approval
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
          businesses!inner (
            id,
            name,
            location
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
  static async getBusinessReviews(businessId: string): Promise<UserReview[]> {
    try {
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
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching business reviews:', error);
      return [];
    }
  }

  // Get user's reviews
  static async getUserReviews(userId: string): Promise<UserReview[]> {
    try {
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          id,
          user_id,
          business_id,
          review_text,
          rating,
          image_urls,
          created_at,
          businesses!inner (
            id,
            name,
            location,
            is_verified
          )
        .eq('user_id', userId);

      console.log('Supabase query result for user reviews:', data);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      return [];
    }
  }
}
        )
    }
  }
}
        )
    }
  }
}
        )
    }
  }
}