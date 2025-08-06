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
          is_mobile_business: businessData.is_mobile_business || false,
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
      console.log('🔍 Searching for exact business name:', name);
      
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .ilike('name', name)
        .limit(1);
      
      if (error) {
        console.warn('⚠️ Error in exact name search:', error);
        // If error in exact match, try partial match
        const { data: partialData, error: partialError } = await supabase
          .from('businesses')
          .select('*')
          .ilike('name', `%${name}%`)
          .limit(1);
        
        if (partialError) {
          console.warn('⚠️ Error in partial name search:', partialError);
          return null;
        }
        
        if (partialData && partialData.length > 0) {
          console.log('✅ Found partial match:', partialData[0].name);
          return partialData[0];
        }
        
        return null;
      }
      
      if (data && data.length > 0) {
        console.log('✅ Found exact match:', data[0].name);
        return data[0];
      }
      
      // If no exact match found, try partial match
      console.log('🔍 No exact match, trying partial match...');
      const { data: partialData, error: partialError } = await supabase
        .from('businesses')
        .select('*')
        .ilike('name', `%${name}%`)
        .limit(1);
      
      if (partialError) {
        console.warn('⚠️ Error in partial name search:', partialError);
        return null;
      }
      
      if (partialData && partialData.length > 0) {
        console.log('✅ Found partial match:', partialData[0].name);
        return partialData[0];
      }
      
      console.log('❌ No business found with name:', name);
      return null;
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
    business_type?: 'product' | 'service' | 'hybrid';
    primary_offering?: string;
    intent?: 'food_beverage' | 'service' | 'retail' | 'general';
  }): Promise<Business[]> {
    try {
      console.log('🔍 BusinessService.getBusinesses called with filters:', filters);
      
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
      
      // Apply business type filter for intent matching
      if (filters?.business_type) {
        query = query.eq('business_type', filters.business_type);
      }
      
      // Apply primary offering filter for more specific intent matching
      if (filters?.primary_offering) {
        query = query.eq('primary_offering', filters.primary_offering);
      }
      
      if (filters?.search) {
        console.log('🔍 Applying search filter for:', filters.search);
        
        // Enhanced search with intent-based prioritization
        if (filters.intent) {
          console.log('🎯 Applying intent-based search for:', filters.intent);
          
          // Build search conditions with intent prioritization
          let searchConditions = [];
          
          if (filters.intent === 'food_beverage') {
            // For food/beverage intent, prioritize product businesses and food-related categories
            searchConditions = [
              `name.ilike.%${filters.search}%`,
              `description.ilike.%${filters.search}%`,
              `short_description.ilike.%${filters.search}%`,
              `tags.cs.{${filters.search}}`
            ];
            
            // Add additional filter for food/beverage businesses
            query = query.or(`business_type.eq.product,primary_offering.eq.food_beverage`);
          } else if (filters.intent === 'service') {
            // For service intent, prioritize service businesses
            searchConditions = [
              `name.ilike.%${filters.search}%`,
              `description.ilike.%${filters.search}%`,
              `short_description.ilike.%${filters.search}%`
            ];
            
            query = query.eq('business_type', 'service');
          } else {
            // General search - use all fields
            searchConditions = [
              `name.ilike.%${filters.search}%`,
              `description.ilike.%${filters.search}%`,
              `location.ilike.%${filters.search}%`,
              `category.ilike.%${filters.search}%`,
              `short_description.ilike.%${filters.search}%`,
              `address.ilike.%${filters.search}%`
            ];
          }
        } else {
          // Fallback to original search logic
          const searchConditions = [
            `name.ilike.%${filters.search}%`,
            `description.ilike.%${filters.search}%`,
            `location.ilike.%${filters.search}%`,
            `category.ilike.%${filters.search}%`,
            `short_description.ilike.%${filters.search}%`,
            `address.ilike.%${filters.search}%`
          ];
        }
        
        query = query.or(searchConditions.join(','));
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      let businesses = data || [];
      console.log('✅ Query returned', businesses.length, 'businesses');
      
      // Filter by 10-mile radius if user location is provided and not admin view
      if (filters?.userLatitude && filters?.userLongitude && !filters?.adminView) {
        console.log('🗺️ Filtering businesses within 10-mile radius');
        
        businesses = businesses.filter(business => {
          if (!business.latitude || !business.longitude) {
            console.log(`⚠️ Business ${business.name} has no coordinates, excluding from radius filter`);
            return false;
          }
          
          // Calculate distance using Haversine formula
          const R = 3959; // Earth's radius in miles
          const dLat = (business.latitude - filters.userLatitude) * Math.PI / 180;
          const dLon = (business.longitude - filters.userLongitude) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(filters.userLatitude * Math.PI / 180) * Math.cos(business.latitude * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          
          if (distance > 10) {
            console.log(`🚫 Filtering out business outside 10-mile radius: ${business.name} (${distance.toFixed(1)} miles)`);
            return false;
          }
          
          return true;
        });
        
        console.log('✅ After 10-mile radius filter:', businesses.length, 'businesses remain');
      }
      
      // Add placeholder distance/duration values for external calculation
      businesses = businesses.map(business => ({
        ...business,
        distance: 999999, // Will be calculated externally
        duration: 999999
      }));
      
      console.log('📊 Final businesses with distances:', businesses.map(b => ({
        name: b.name,
        distance: b.distance
      })));
      return businesses;
    } catch (error) {
      console.error('❌ Error in getBusinesses:', error);
      return [];
    }
  }

  // Calculate accurate distances using Google Distance Matrix API
  static async calculateBusinessDistances(
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
        is_mobile_business: businessData.is_mobile_business || false,
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
      console.log('🎯 BusinessService.rateBusiness called with:', {
        businessId,
        userId,
        isThumbsUp,
        timestamp: new Date().toISOString()
      });

      // First check if user has already rated this business
      const { data: existingRating } = await supabase
        .from('business_ratings')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .single();
      
      console.log('🔍 Existing rating check result:', {
        existingRating: existingRating ? 'Found existing rating' : 'No existing rating',
        existingRatingData: existingRating
      });

      if (existingRating) {
        // Update existing rating
        console.log('🔄 Updating existing rating...');
        const { error } = await supabase
          .from('business_ratings')
          .update({ is_thumbs_up: isThumbsUp })
          .eq('business_id', businessId)
          .eq('user_id', userId);
        
        if (error) {
          console.error('❌ Error updating existing rating:', error);
          throw error;
        }
        console.log('✅ Successfully updated existing rating');
      } else {
        // Insert new rating
        console.log('➕ Inserting new rating...');
        const { error } = await supabase
          .from('business_ratings')
          .insert({
            business_id: businessId,
            user_id: userId,
            is_thumbs_up: isThumbsUp
          });
        
        if (error) {
          console.error('❌ Error inserting new rating:', error);
          throw error;
        }
        console.log('✅ Successfully inserted new rating');
      }
      
      // Update business thumbs up/down counts and sentiment score
      console.log('🔄 Calling updateBusinessSentiment...');
      await this.updateBusinessSentiment(businessId);
      
      console.log('✅ BusinessService.rateBusiness completed successfully');
      return true;
    } catch (error) {
      console.error('❌ BusinessService.rateBusiness failed:', error);
      return false;
    }
  }

  // Update business sentiment score based on thumbs up/down
  private static async updateBusinessSentiment(businessId: string): Promise<void> {
    try {
      console.log('🎯 updateBusinessSentiment called for businessId:', businessId);

      // Get all ratings for this business
      const { data: ratings, error } = await supabase
        .from('business_ratings')
        .select('*')
        .eq('business_id', businessId);
      
      if (error) {
        console.error('❌ Error fetching ratings for business:', businessId, error);
        throw error;
      }
      
      console.log('📊 Fetched ratings for business:', {
        businessId,
        ratingsCount: ratings?.length || 0,
        ratings: ratings
      });

      if (!ratings || ratings.length === 0) return;
      
      // Calculate thumbs up/down counts
      const thumbsUp = ratings.filter(r => r.is_thumbs_up).length;
      const thumbsDown = ratings.filter(r => !r.is_thumbs_up).length;
      
      // Calculate sentiment score (percentage of thumbs up)
      const totalRatings = thumbsUp + thumbsDown;
      const sentimentScore = totalRatings > 0 
        ? Math.round((thumbsUp / totalRatings) * 100) 
        : 0;
      
      console.log('📊 Calculated sentiment data:', {
        businessId,
        thumbsUp,
        thumbsDown,
        totalRatings,
        sentimentScore
      });

      // Update business record
      console.log('🔄 Updating business record with new sentiment data...');
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          thumbs_up: thumbsUp,
          thumbs_down: thumbsDown,
          sentiment_score: sentimentScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', businessId);
      
      if (updateError) {
        console.error('❌ Error updating business sentiment:', businessId, updateError);
        throw updateError;
      }

      console.log('✅ Successfully updated business sentiment:', {
        businessId,
        newThumbsUp: thumbsUp,
        newThumbsDown: thumbsDown,
        newSentimentScore: sentimentScore
      });
    } catch (error) {
      console.error('❌ updateBusinessSentiment failed for businessId:', businessId, error);
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
          image_url: business.image || '/verified and reviewed logo-coral copy copy.png',
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
      
      // Replace old mock images with Verified & Reviewed logo for AI-generated businesses only
      const updatedData = (data || []).map(business => {
        // Check if this is an AI-generated business
        const isAIGenerated = business.category === 'AI Generated' || 
                             (business.description && business.description.includes('AI-generated business'));
        
        // Only replace image for AI-generated businesses with the old mock image
        if (isAIGenerated && 
            business.image_url === 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400') {
          return {
            ...business,
            image_url: '/verified and reviewed logo-coral copy copy.png'
          };
        }
        
        return business;
      });
      
      return updatedData;
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