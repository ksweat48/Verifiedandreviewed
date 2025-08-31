import { supabase, type Business, type BusinessRating } from './supabaseClient';
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
      // Note: Embedding generation will be handled by the offerings system
      
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
      
      // Note: Embedding updates will be handled by the offerings system
      
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

  // Save favorited platform offering
  static async saveFavoritedOffering(offeringId: string, userId: string): Promise<boolean> {
    try {
      // Fetch the offering details
      const { OfferingService } = await import('./offeringService');
      const offering = await OfferingService.getOfferingById(offeringId);
      if (!offering) {
        throw new Error('Offering not found');
      }

      // Fetch the business details
      const business = await this.getBusinessById(offering.business_id);
      if (!business) {
        throw new Error('Business not found');
      }

      // Get primary image from offering
      const primaryImage = offering.images?.find(img => img.is_primary && img.approved);
      const fallbackImage = offering.images?.find(img => img.approved);
      const imageUrl = primaryImage?.url || fallbackImage?.url || business.image_url || '/verified and reviewed logo-coral copy copy.png';

      // Check if already favorited
      const { data: existingFavorite } = await supabase
        .from('business_recommendations')
        .select('id')
        .eq('recommended_by', userId)
        .eq('favorited_offering_id', offeringId)
        .single();

      if (existingFavorite) {
        console.log('Offering already favorited by user');
        return true;
      }

      // Insert favorited offering
      const { error } = await supabase
        .from('business_recommendations')
        .insert({
          name: offering.title,
          address: business.address || business.location,
          location: business.location || business.address,
          category: 'Favorited Offering',
          description: offering.description || business.short_description || business.description,
          image_url: imageUrl,
          recommended_by: userId,
          status: 'approved',
          favorited_offering_id: offeringId,
          favorited_business_id: business.id,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error saving favorited offering:', error);
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

  // Get user's favorited AI businesses
  static async getUserFavorites(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('business_recommendations')
        .select(`
          *,
          offerings!left (
            id,
            title,
            description,
            price_cents,
            currency,
            service_type,
            offering_images!left (
              url,
              is_primary,
              approved
            )
          ),
          businesses!left (
            id,
            name,
            address,
            location,
            category,
            description,
            short_description,
            image_url,
            phone_number,
            website_url,
            hours,
            is_verified
          )
        `)
        .eq('recommended_by', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const updatedData = (data || []).map(business => {
        // Check if this is a favorited platform offering
        if (business.favorited_offering_id && business.offerings && business.businesses) {
          // This is a favorited platform offering
          const offering = business.offerings;
          const businessData = business.businesses;
          
          // Get primary image from offering
          const primaryImage = offering.offering_images?.find(img => img.is_primary && img.approved);
          const fallbackImage = offering.offering_images?.find(img => img.approved);
          const imageUrl = primaryImage?.url || fallbackImage?.url || businessData.image_url || '/verified and reviewed logo-coral copy copy.png';
          
          return {
            id: business.id,
            name: offering.title,
            address: businessData.address || businessData.location,
            location: businessData.location || businessData.address,
            category: 'Platform Offering',
            description: offering.description || businessData.short_description,
            image_url: imageUrl,
            created_at: business.created_at,
            isPlatformOffering: true,
            isAIGenerated: false,
            offeringId: offering.id,
            businessId: businessData.id,
            businessName: businessData.name,
            price_cents: offering.price_cents,
            currency: offering.currency,
            service_type: offering.service_type
          };
        } else {
          // This is an AI-generated business - remove thumbnail
          const isAIGenerated = business.category === 'AI Generated' || 
                               (business.description && business.description.includes('AI-generated business'));
          
          return {
            ...business,
            // Remove image for AI businesses in favorites
            image_url: isAIGenerated ? '/verified and reviewed logo-coral copy copy.png' : business.image_url,
            isAIGenerated: isAIGenerated,
            isPlatformOffering: false
          };
        }
        
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