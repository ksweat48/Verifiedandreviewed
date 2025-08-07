import { supabase } from './supabaseClient';
import type { Profile, Business } from './supabaseClient';

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
  views?: number;
  profiles?: Profile;
  businesses?: Business;
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
  static async getBusinessReviews(businessId: string | string[]): Promise<UserReview[]> {
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
            avatar_url,
            level
          )
        `)
        .in('business_id', businessIds)
        .eq('status', 'approved')
        .order('created_at', { ascending: false }); // Initial order, will be re-sorted below

      if (error) throw error;
      
      const reviews = data || [];
      
      // Apply priority scoring and sorting
      const prioritizedReviews = this.prioritizeReviews(reviews);
      
      return prioritizedReviews;
    } catch (error) {
      console.error('Error fetching business reviews:', error);
      return [];
    }
  }

  // Prioritize reviews based on completeness and reviewer level
  private static prioritizeReviews(reviews: UserReview[]): UserReview[] {
    console.log('🎯 Prioritizing', reviews.length, 'reviews');
    
    // Calculate priority score for each review
    const reviewsWithScores = reviews.map(review => {
      const score = this.calculateReviewPriorityScore(review);
      const viewsCount = review.views || 0;
      const reviewerLevel = review.profiles?.level || 1;
      const hasText = review.review_text && review.review_text.trim().length > 0;
      const hasEnoughImages = review.image_urls && review.image_urls.length >= 3;
      const isFullReview = hasText && hasEnoughImages;
      
      console.log(`📊 Review by ${review.profiles?.name}: score ${score.toFixed(2)} (${isFullReview ? 'full' : 'partial'} review, L${reviewerLevel}, ${viewsCount} views)`);
      
      return {
        ...review,
        priorityScore: score
      };
    });
    
    // Sort by priority score (highest first) and remove the temporary score property
    const sortedReviews = reviewsWithScores
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map(({ priorityScore, ...review }) => review);
    
    console.log('✅ Reviews prioritized. Order:', sortedReviews.map(r => 
      `${r.profiles?.name} (L${r.profiles?.level || 1})`
    ));
    
    return sortedReviews;
  }
  
  // Calculate priority score for a single review
  private static calculateReviewPriorityScore(review: UserReview): number {
    // Base scores for review types
    const PARTIAL_REVIEW_BASE = 50;  // Lowest priority
    const FULL_REVIEW_BASE = 100;    // Medium priority
    const LEVEL_BOOST_MULTIPLIER = 20; // Additional points per reviewer level
    const VIEWS_BOOST_MULTIPLIER = 0.5; // Additional points per view (0.5 points per view)
    
    // Determine if this is a full review
    const hasText = review.review_text && review.review_text.trim().length > 0;
    const hasEnoughImages = review.image_urls && review.image_urls.length >= 3;
    const isFullReview = hasText && hasEnoughImages;
    
    // Start with base score
    let score = isFullReview ? FULL_REVIEW_BASE : PARTIAL_REVIEW_BASE;
    
    // Add level boost for full reviews
    if (isFullReview) {
      const reviewerLevel = review.profiles?.level || 1;
      const levelBoost = (reviewerLevel - 1) * LEVEL_BOOST_MULTIPLIER; // Level 1 = no boost, Level 2 = +20, etc.
      score += levelBoost;
    }
    
    // Add views boost (applies to both partial and full reviews)
    const viewsCount = review.views || 0;
    const viewsBoost = viewsCount * VIEWS_BOOST_MULTIPLIER;
    score += viewsBoost;
    
    // Add 10% randomness to introduce variety
    const randomFactor = 0.1; // 10% randomness
    const maxRandomBoost = score * randomFactor;
    const randomBoost = (Math.random() - 0.5) * 2 * maxRandomBoost; // Random value between -10% and +10%
    score += randomBoost;
    
    // Ensure score is never negative
    return Math.max(0, score);
  }
  // Get user's reviews
  static async getUserReviews(userId: string): Promise<UserReview[]> {
    try {
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          *,
          businesses!inner (
            id,
            name,
            location
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      console.log('Supabase query result for user reviews:', data);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      return [];
    }
  }
}