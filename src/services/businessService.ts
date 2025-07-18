import { supabase, type Business, type BusinessRating } from './supabaseClient';

export class BusinessService {
  // Create a new business
  static async createBusiness(
    businessData: Partial<Business>,
    ownerUserId: string
  ): Promise<{ success: boolean; businessId?: string; error?: string }> {
    try {
      // Insert the new business
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert({
          ...businessData,
          days_closed: businessData.days_closed || null,
          owner_user_id: ownerUserId,
          is_verified: false, // New businesses start as unverified
          is_visible_on_platform: true, // New businesses are immediately visible
          thumbs_up: 0,
          thumbs_down: 0,
          sentiment_score: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (businessError) throw businessError;
      
      if (!newBusiness) throw new Error('Failed to create business');
      
      // Link the user to the business as owner
      const { error: linkError } = await supabase
        .from('user_businesses')
        .insert({
          user_id: ownerUserId,
          business_id: newBusiness.id,
          role: 'owner',
          created_at: new Date().toISOString()
        });
      
      if (linkError) throw linkError;
      
      // Update the user's is_business_owner flag
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_business_owner: true })
        .eq('id', ownerUserId);
      
      if (updateError) throw updateError;
      
      return {
        success: true,
        businessId: newBusiness.id
      };
    } catch (error) {
      console.error('Error creating business:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create business'
      };
    }
  }

  // Update an existing business
  static async updateBusiness(
    businessId: string,
    businessData: Partial<Business>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          ...businessData,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      if (error) throw error;
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Error updating business:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update business'
      };
    }
  }

  // Update business verification status (verified badge)
  static async updateBusinessVerificationStatus(
    businessId: string,
    isVerified: boolean
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          is_verified: isVerified,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error updating business verification status:', error);
      return false;
    }
  }

  // Update business visibility on platform
  static async updateBusinessVisibility(
    businessId: string,
    isVisible: boolean
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          is_visible_on_platform: isVisible,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error updating business visibility:', error);
      return false;
    }
  }

  // Delete a business
  static async deleteBusiness(businessId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', businessId);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error deleting business:', error);
      return false;
    }
  }

  // Get all businesses
  static async getBusinesses(filters?: {
    category?: string;
    verified_only?: boolean;
    search?: string;
    tags?: string[];
    min_sentiment?: number;
    adminView?: boolean;
  }): Promise<Business[]> {
    try {
      let query = supabase
        .from('businesses')
        .select('*');

      // By default, only show visible businesses for public views
      if (!filters?.adminView) {
        query = query.eq('is_visible_on_platform', true);
      }
      
      // Apply filters
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters?.verified_only) {
        query = query.eq('is_verified', true);
      }
      
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
      }
      
      if (filters?.min_sentiment) {
        query = query.gte('sentiment_score', filters.min_sentiment);
      }

      // Filter by verification status if specified
      if (filters?.verified_only === true) {
        query = query.eq('is_verified', true);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      return [];
    }
  }

  // Get a single business by ID
  static async getBusinessById(id: string): Promise<Business | null> {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      return null;
    }
  }

  // Rate a business (thumbs up/down)
  static async rateBusiness(
    businessId: string, 
    userId: string, 
    isThumbsUp: boolean
  ): Promise<boolean> {
    try {
      // First check if user has already rated this business
      const { data: existingRating } = await supabase
        .from('business_ratings')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .single();
      
      if (existingRating) {
        // Update existing rating
        const { error } = await supabase
          .from('business_ratings')
          .update({ is_thumbs_up: isThumbsUp })
          .eq('business_id', businessId)
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        // Insert new rating
        const { error } = await supabase
          .from('business_ratings')
          .insert({
            business_id: businessId,
            user_id: userId,
            is_thumbs_up: isThumbsUp
          });
        
        if (error) throw error;
      }
      
      // Update business thumbs up/down counts and sentiment score
      await this.updateBusinessSentiment(businessId);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Update business sentiment score based on thumbs up/down
  private static async updateBusinessSentiment(businessId: string): Promise<void> {
    try {
      // Get all ratings for this business
      const { data: ratings, error } = await supabase
        .from('business_ratings')
        .select('*')
        .eq('business_id', businessId);
      
      if (error) throw error;
      
      if (!ratings || ratings.length === 0) return;
      
      // Calculate thumbs up/down counts
      const thumbsUp = ratings.filter(r => r.is_thumbs_up).length;
      const thumbsDown = ratings.filter(r => !r.is_thumbs_up).length;
      
      // Calculate sentiment score (percentage of thumbs up)
      const totalRatings = thumbsUp + thumbsDown;
      const sentimentScore = totalRatings > 0 
        ? Math.round((thumbsUp / totalRatings) * 100) 
        : 0;
      
      // Update business record
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          thumbs_up: thumbsUp,
          thumbs_down: thumbsDown,
          sentiment_score: sentimentScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      if (updateError) throw updateError;
    } catch (error) {
      // Error handling
    }
  }

  // Check if user has visited a business (required before rating)
  static async hasUserVisited(businessId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('business_visits')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .single();
      
      if (error) return false;
      
      return !!data;
    } catch (error) {
      return false;
    }
  }

  // Record a business visit (when user clicks "Take Me There")
  static async recordBusinessVisit(businessId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('business_visits')
        .insert({
          business_id: businessId,
          user_id: userId,
          visited_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Recommend a business for verification
  static async recommendBusiness(businessData: {
    name: string;
    address: string;
    location: string;
    category?: string;
    description?: string;
    image_url?: string;
    recommended_by: string;
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('business_recommendations')
        .insert({
          ...businessData,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get businesses owned by a user
  static async getUserBusinesses(userId: string): Promise<Business[]> {
    try {
      // Get business IDs from user_businesses table
      const { data: userBusinesses, error: linkError } = await supabase
        .from('user_businesses')
        .select('business_id')
        .eq('user_id', userId);
      
      if (linkError) throw linkError;
      
      if (!userBusinesses || userBusinesses.length === 0) {
        return [];
      }
      
      // Get the actual business data
      const businessIds = userBusinesses.map(ub => ub.business_id);
      
      const { data: businesses, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .in('id', businessIds);
      
      if (businessError) throw businessError;
      
      return businesses || [];
    } catch (error) {
      console.error('Error fetching user businesses:', error);
      return [];
    }
  }
}