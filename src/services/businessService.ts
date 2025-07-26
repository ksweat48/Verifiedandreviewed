import { supabase, type Business, type BusinessRating } from './supabaseClient';
import { SemanticSearchService } from './semanticSearchService';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export class BusinessService {
  // Create a new business
  static async createBusiness(
    businessData: Partial<Business>,
    ownerUserId: string
  ): Promise<{ success: boolean; businessId?: string; error?: string }> {
    try {
      // Geocode the address if provided and coordinates are missing
      let finalBusinessData = { ...businessData };
      
      if (businessData.address && (!businessData.latitude || !businessData.longitude)) {
        try {
          const coordinates = await this.geocodeAddress(businessData.address);
          if (coordinates) {
            finalBusinessData.latitude = coordinates.latitude;
            finalBusinessData.longitude = coordinates.longitude;
            // Optionally update the address with the formatted version
            if (coordinates.formattedAddress) {
              finalBusinessData.address = coordinates.formattedAddress;
            }
          }
        } catch (geocodeError) {
          console.warn('Geocoding failed, proceeding without coordinates:', geocodeError);
          // Continue without coordinates - not a blocking error
        }
      }

      // Insert the new business
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert({
          ...finalBusinessData,
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
      
      // Generate embedding for the new business
      console.log(`🧠 Triggering embedding generation for new business: ${newBusiness.id}`);
      try {
        const embeddingResult = await SemanticSearchService.generateEmbeddings({ businessId: newBusiness.id });
        if (embeddingResult && embeddingResult.success) {
          console.log(`✅ Embedding generated successfully for business: ${newBusiness.id}`);
        } else {
          console.warn(`⚠️ Embedding generation skipped for business: ${newBusiness.id}`, embeddingResult?.message || 'Service unavailable');
        }
      } catch (error) {
        console.warn(`⚠️ Embedding generation failed for new business ${newBusiness.id}:`, error.message);
      }
      
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
      // Geocode the address if it has changed and coordinates are missing
      let finalBusinessData = { ...businessData };
      
      if (businessData.address && (!businessData.latitude || !businessData.longitude)) {
        try {
          const coordinates = await this.geocodeAddress(businessData.address);
          if (coordinates) {
            finalBusinessData.latitude = coordinates.latitude;
            finalBusinessData.longitude = coordinates.longitude;
            // Optionally update the address with the formatted version
            if (coordinates.formattedAddress) {
              finalBusinessData.address = coordinates.formattedAddress;
            }
          }
        } catch (geocodeError) {
          console.warn('Geocoding failed during update, proceeding without coordinates:', geocodeError);
          // Continue without coordinates - not a blocking error
        }
      }

      const { error } = await supabase
        .from('businesses')
        .update({
          ...finalBusinessData,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      if (error) throw error;
      
      // Generate embedding for the updated business
      console.log(`🧠 Triggering embedding generation for updated business: ${businessId}`);
      try {
        const embeddingResult = await SemanticSearchService.generateEmbeddings({ businessId });
        if (embeddingResult && embeddingResult.success) {
          console.log(`✅ Embedding updated successfully for business: ${businessId}`);
        } else {
          console.warn(`⚠️ Embedding update skipped for business: ${businessId}`, embeddingResult?.message || 'Service unavailable');
        }
      } catch (error) {
        console.warn(`⚠️ Embedding update failed for business ${businessId}:`, error.message);
      }
      
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

  // Geocode an address to get latitude and longitude
  private static async geocodeAddress(address: string): Promise<{
    latitude: number;
    longitude: number;
    formattedAddress?: string;
  } | null> {
    try {
      const response = await fetchWithTimeout('/.netlify/functions/geocode-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address }),
        timeout: 15000 // 15 second timeout for geocoding
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Geocoding service not available in current environment. Run "netlify dev" to enable Netlify Functions.');
          return null;
        }
        
        let errorMessage = 'Geocoding failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorMessage = `Geocoding service error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse geocoding response:', jsonError);
        throw new Error('Invalid response from geocoding service');
      }
      
      if (data.success) {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          formattedAddress: data.formattedAddress
        };
      } else {
        throw new Error(data.error || 'Geocoding failed');
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
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

  // Get business by exact name match (for direct searches)
  static async getBusinessByName(name: string): Promise<Business | null> {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('is_visible_on_platform', true)
        .ilike('name', name) // Case-insensitive exact match
        .single();
      
      if (error) {
        // If no exact match found, try partial match
        const { data: partialData, error: partialError } = await supabase
          .from('businesses')
          .select('*')
          .eq('is_visible_on_platform', true)
          .ilike('name', `%${name}%`) // Partial match
          .limit(1)
          .single();
        
        if (partialError) return null;
        return partialData;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching business by name:', error);
      return null;
    }
  }

  // Get all businesses
  static async getBusinesses(filters?: {
    category?: string;
    verified_only?: boolean;
    search?: string;
    tags?: string[];
    adminView?: boolean;
    userLatitude?: number;
    userLongitude?: number;
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
        // Build search conditions array to avoid malformed query strings
        const searchConditions = [
          `name.ilike.%${filters.search}%`,
          `description.ilike.%${filters.search}%`,
          `location.ilike.%${filters.search}%`,
          `category.ilike.%${filters.search}%`,
          `short_description.ilike.%${filters.search}%`,
          `address.ilike.%${filters.search}%`,
          `array_to_string(tags, ' ').ilike.%${filters.search}%`
        ];
        
        console.log('🔍 Supabase OR filter string:', searchConditions.join(','));
        console.log('🔍 Search term:', filters.search);
        
        query = query.or(searchConditions.join(','));
      }
      

      // Execute query
      const { data, error } = await query;
      
      if (error) throw error;
      
      let businesses = data || [];
      
      // Calculate accurate distances if user location is provided
      if (filters?.userLatitude && filters?.userLongitude && businesses.length > 0) {
        try {
          businesses = await this.calculateBusinessDistances(
            businesses,
            filters.userLatitude,
            filters.userLongitude
          );
        } catch (distanceError) {
          console.warn('Distance calculation failed, using fallback values:', distanceError);
          // Add fallback distance/duration values - mark as very far to be filtered out
          businesses = businesses.map(business => ({
            ...business,
            distance: 999999, // Mark as very far to be filtered out by 10-mile cap
            duration: 999999
          }));
        }
      } else {
        // Add fallback distance/duration values when no user location - mark as very far
        businesses = businesses.map(business => ({
          ...business,
          distance: 999999, // Mark as very far to be filtered out by 10-mile cap
          duration: 999999
        }));
      }
      
      return businesses;
    } catch (error) {
      return [];
    }
  }

  // Calculate accurate distances using Google Distance Matrix API
  private static async calculateBusinessDistances(
    businesses: Business[],
    userLatitude: number,
    userLongitude: number
  ): Promise<Business[]> {
    // Filter businesses that have coordinates
    const businessesWithCoords = businesses.filter(b => b.latitude && b.longitude);
    const businessesWithoutCoords = businesses.filter(b => !b.latitude || !b.longitude);
    
    if (businessesWithCoords.length === 0) {
      // No businesses have coordinates, return with fallback values
      return businesses.map(business => ({
        ...business,
        distance: Math.round((Math.random() * 4 + 1) * 10) / 10,
        duration: Math.floor(Math.random() * 10 + 5)
      }));
    }
    
    // Prepare data for distance calculation
    const origin = {
      latitude: userLatitude,
      longitude: userLongitude
    };
    
    const destinations = businessesWithCoords.map(business => ({
      latitude: business.latitude!,
      longitude: business.longitude!,
      businessId: business.id
    }));
    
    // Call the distance calculation function
    const response = await fetch('/.netlify/functions/get-business-distances', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        origin,
        destinations
      })
    });
    
    if (!response.ok) {
      throw new Error(`Distance calculation failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Distance calculation failed');
    }
    
    // Map distance results back to businesses
    const distanceMap = new Map();
    data.results.forEach((result: any) => {
      distanceMap.set(result.businessId, {
        distance: result.distance,
        duration: result.duration
      });
    });
    
    // Apply distances to businesses
    const updatedBusinesses = businesses.map(business => {
      const distanceData = distanceMap.get(business.id);
      if (distanceData) {
        return {
          ...business,
          distance: distanceData.distance,
          duration: distanceData.duration
        };
      } else {
        // Fallback for businesses without coordinates
        return {
          ...business,
          distance: Math.round((Math.random() * 4 + 1) * 10) / 10,
          duration: Math.floor(Math.random() * 10 + 5)
        };
      }
    });
    
    return updatedBusinesses;
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

  // Save AI business recommendation to favorites
  static async saveAIRecommendation(business: any, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('business_recommendations')
        .insert({
          name: business.name,
          address: business.address || business.location || 'Address not available',
          location: business.location || business.address || 'Location not available',
          category: business.category || 'AI Generated',
          description: `AI-generated business with ${Math.round((business.similarity || 0.8) * 100)}% match. ${business.shortDescription || business.description || ''}`,
          image_url: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
          recommended_by: userId,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error saving AI recommendation:', error);
      return false;
    }
  }

  // Get user's favorited AI businesses
  static async getUserFavorites(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('business_recommendations')
        .select('*')
        .eq('recommended_by', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching user favorites:', error);
      return [];
    }
  }

  // Remove a favorite AI business
  static async removeFavorite(recommendationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('business_recommendations')
        .delete()
        .eq('id', recommendationId);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
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