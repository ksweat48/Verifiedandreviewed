import { supabase } from './supabaseClient';
import { UserService } from './userService';
import { AppSettingsService } from './appSettingsService';

export interface Offering {
  id: string;
  business_id: string;
  title: string;
  description?: string;
  tags?: string[];
  price_cents?: number;
  currency?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface OfferingImage {
  id: string;
  offering_id: string;
  source: string;
  url: string;
  width?: number;
  height?: number;
  license?: string;
  is_primary: boolean;
  approved: boolean;
  created_at: string;
}

export interface SafetyCheckResult {
  passed: boolean;
  reason?: string;
  confidence?: number;
}

export class OfferingService {
  // Create a new offering
  static async createOffering(
    offeringData: {
      business_id: string;
      title: string;
      description?: string;
      tags?: string[];
      price_cents?: number;
      currency?: string;
    }
  ): Promise<{ success: boolean; offeringId?: string; error?: string }> {
    try {
      console.log('🍽️ Creating new offering:', offeringData.title);

      const { data: newOffering, error } = await supabase
        .from('offerings')
        .insert({
          ...offeringData,
          currency: offeringData.currency || 'USD',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      if (!newOffering) throw new Error('Failed to create offering');

      console.log('✅ Offering created successfully:', newOffering.id);

      // Generate embedding for the new offering
      try {
        const { SemanticSearchService } = await import('./semanticSearchService');
        const embeddingResult = await SemanticSearchService.generateEmbeddings({ 
          offeringId: newOffering.id,
          entityType: 'offering'
        });
        
        if (embeddingResult && embeddingResult.success) {
          console.log('✅ Embedding generated for new offering:', newOffering.id);
        } else {
          console.warn('⚠️ Embedding generation skipped for offering:', newOffering.id);
        }
      } catch (error) {
        console.warn('⚠️ Embedding generation failed for new offering:', error);
      }

      return {
        success: true,
        offeringId: newOffering.id
      };
    } catch (error) {
      console.error('❌ Error creating offering:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create offering'
      };
    }
  }

  // Upload and process offering image with auto-approval
  static async uploadOfferingImage(
    file: File,
    offeringId: string,
    source: string = 'user_upload',
    license?: string
  ): Promise<{ success: boolean; imageId?: string; approved?: boolean; error?: string }> {
    try {
      console.log('📸 Uploading offering image for:', offeringId);

      // Get current user for file path
      const user = await UserService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check AUTO_APPROVE_OFFERINGS flag
      const autoApprove = import.meta.env.VITE_AUTO_APPROVE_OFFERINGS === 'true';
      console.log('🔧 Auto-approve mode:', autoApprove);

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `offerings/${offeringId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('offering-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('offering-images')
        .getPublicUrl(filePath);

      if (!urlData.publicUrl) {
        throw new Error('Failed to get public URL for uploaded image');
      }

      // Run safety checks
      const safetyResult = await this.runSafetyChecks(urlData.publicUrl, source);
      console.log('🛡️ Safety check result:', safetyResult);

      // Determine approval status
      const approved = autoApprove && safetyResult.passed;
      console.log('✅ Image approval status:', approved);

      // Get image dimensions (optional)
      const dimensions = await this.getImageDimensions(file);

      // Insert image record
      const { data: newImage, error: insertError } = await supabase
        .from('offering_images')
        .insert({
          offering_id: offeringId,
          source: source,
          url: urlData.publicUrl,
          width: dimensions?.width,
          height: dimensions?.height,
          license: license,
          is_primary: false, // Will be set later if needed
          approved: approved,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (!newImage) throw new Error('Failed to insert image record');

      console.log('✅ Image record created:', newImage.id);

      // If approved, ensure primary image is set
      if (approved) {
        await this.ensurePrimaryImage(offeringId, newImage.id);
      }

      // Log failed safety checks for admin review
      if (!safetyResult.passed) {
        console.warn('⚠️ Image failed safety checks:', {
          imageId: newImage.id,
          offeringId,
          reason: safetyResult.reason,
          url: urlData.publicUrl
        });
        
        // In a real implementation, you might want to log this to a separate table
        // or send an alert to administrators
      }

      return {
        success: true,
        imageId: newImage.id,
        approved: approved
      };
    } catch (error) {
      console.error('❌ Error uploading offering image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload image'
      };
    }
  }

  // Ensure an offering has a primary image
  private static async ensurePrimaryImage(offeringId: string, candidateImageId: string): Promise<void> {
    try {
      console.log('🎯 Ensuring primary image for offering:', offeringId);

      // Check if offering already has a primary image
      const { data: existingPrimary, error: checkError } = await supabase
        .from('offering_images')
        .select('id')
        .eq('offering_id', offeringId)
        .eq('approved', true)
        .eq('is_primary', true)
        .limit(1);

      if (checkError) throw checkError;

      // If no primary image exists, set this one as primary
      if (!existingPrimary || existingPrimary.length === 0) {
        console.log('📌 Setting image as primary:', candidateImageId);
        
        const { error: updateError } = await supabase
          .from('offering_images')
          .update({ is_primary: true })
          .eq('id', candidateImageId);

        if (updateError) throw updateError;

        console.log('✅ Primary image set successfully');
      } else {
        console.log('ℹ️ Offering already has a primary image');
      }
    } catch (error) {
      console.error('❌ Error ensuring primary image:', error);
    }
  }

  // Run safety checks on an image URL
  private static async runSafetyChecks(imageUrl: string, source: string): Promise<SafetyCheckResult> {
    try {
      console.log('🛡️ Running safety checks for:', imageUrl);

      const checks = [
        this.checkFileSize(imageUrl),
        this.checkImageFormat(imageUrl)
      ];

      const results = await Promise.all(checks);
      const allPassed = results.every(result => result.passed);
      const failedCheck = results.find(result => !result.passed);

      // If basic checks fail, return immediately
      if (!allPassed) {
        return {
          passed: false,
          reason: failedCheck?.reason,
          confidence: failedCheck?.confidence || 0.8
        };
      }

      // Check if Google Vision moderation is enabled
      const visionEnabled = await AppSettingsService.getSetting('enable_vision_moderation');
      const isVisionModerationEnabled = visionEnabled?.enabled === true;

      console.log('🔍 Google Vision moderation enabled:', isVisionModerationEnabled);

      if (isVisionModerationEnabled) {
        // Call Google Cloud Vision SafeSearch via Netlify Function
        console.log('🤖 Calling Google Vision SafeSearch for:', imageUrl);
        
        try {
          const response = await fetch('/.netlify/functions/moderate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl }),
            timeout: 15000 // 15 second timeout
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
            } catch (jsonError) {
              console.error('Failed to parse moderation error response:', jsonError);
            }
            throw new Error(`Google Vision moderation failed: ${errorMessage}`);
          }

          const moderationResult = await response.json();
          console.log('✅ Google Vision moderation result:', moderationResult);

          if (moderationResult.success) {
            return {
              passed: moderationResult.passed,
              reason: moderationResult.reason,
              confidence: moderationResult.confidence
            };
          } else {
            throw new Error(moderationResult.message || 'Vision API returned error');
          }
        } catch (visionError) {
          console.error('❌ Google Vision moderation error:', visionError);
          
          // Fallback to basic content check if Vision API fails
          console.log('🔄 Falling back to basic content checks due to Vision API error');
          const basicContentResult = await this.checkBasicContent(imageUrl, source);
          return basicContentResult;
        }
      } else {
        // Vision moderation is disabled, use basic content checks
        console.log('⚠️ Google Vision moderation disabled, using basic checks only');
        const basicContentResult = await this.checkBasicContent(imageUrl, source);
        return basicContentResult;
      }

    } catch (error) {
      console.error('❌ Safety checks failed:', error);
      return {
        passed: false,
        reason: 'Safety check system error',
        confidence: 0
      };
    }
  }

  // Check file size (basic safety check)
  private static async checkFileSize(imageUrl: string): Promise<SafetyCheckResult> {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      
      if (contentLength) {
        const sizeInMB = parseInt(contentLength) / (1024 * 1024);
        if (sizeInMB > 10) { // Max 10MB
          return {
            passed: false,
            reason: 'File size too large (>10MB)',
            confidence: 1.0
          };
        }
      }

      return { passed: true, confidence: 1.0 };
    } catch (error) {
      return {
        passed: false,
        reason: 'Could not verify file size',
        confidence: 0.5
      };
    }
  }

  // Check image format (basic safety check)
  private static async checkImageFormat(imageUrl: string): Promise<SafetyCheckResult> {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      
      if (!contentType || !allowedTypes.includes(contentType.toLowerCase())) {
        return {
          passed: false,
          reason: 'Invalid image format. Only JPEG, PNG, and WebP allowed.',
          confidence: 1.0
        };
      }

      return { passed: true, confidence: 1.0 };
    } catch (error) {
      return {
        passed: false,
        reason: 'Could not verify image format',
        confidence: 0.5
      };
    }
  }

  // Basic content checks (placeholder for advanced moderation)
  private static async checkBasicContent(imageUrl: string, source: string): Promise<SafetyCheckResult> {
    // Placeholder implementation
    // In a real system, this would:
    // 1. Check for NSFW content using AI services
    // 2. Verify the image matches the offering type (food, product, service)
    // 3. Check for inappropriate text or symbols
    // 4. Validate image quality and clarity

    // For now, implement basic heuristics
    try {
      // Trust user uploads more than external sources
      if (source === 'user_upload') {
        return { passed: true, confidence: 0.9 };
      }

      // External sources get more scrutiny
      if (source.includes('google') || source.includes('social')) {
        // Add basic URL validation
        if (imageUrl.includes('inappropriate') || imageUrl.includes('nsfw')) {
          return {
            passed: false,
            reason: 'Potentially inappropriate content detected',
            confidence: 0.8
          };
        }
      }

      return { passed: true, confidence: 0.7 };
    } catch (error) {
      return {
        passed: false,
        reason: 'Content check failed',
        confidence: 0
      };
    }
  }

  // Get image dimensions from file
  private static async getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      
      img.src = url;
    });
  }

  // Update an existing offering
  static async updateOffering(
    offeringId: string,
    updates: Partial<Offering>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Updating offering:', offeringId);

      const { error } = await supabase
        .from('offerings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', offeringId);

      if (error) throw error;

      console.log('✅ Offering updated successfully');

      // Trigger re-embedding for updated offering
      try {
        const { SemanticSearchService } = await import('./semanticSearchService');
        const embeddingResult = await SemanticSearchService.generateEmbeddings({ 
          offeringId: offeringId,
          entityType: 'offering',
          forceRegenerate: true
        });
        
        if (embeddingResult && embeddingResult.success) {
          console.log('✅ Embedding updated for offering:', offeringId);
        }
      } catch (error) {
        console.warn('⚠️ Embedding update failed for offering:', error);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error updating offering:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update offering'
      };
    }
  }

  // Delete an offering
  static async deleteOffering(offeringId: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting offering:', offeringId);

      // Delete offering (images will be cascade deleted)
      const { error } = await supabase
        .from('offerings')
        .delete()
        .eq('id', offeringId);

      if (error) throw error;

      console.log('✅ Offering deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deleting offering:', error);
      return false;
    }
  }

  // Get offerings for a business
  static async getBusinessOfferings(businessId: string): Promise<Offering[]> {
    try {
      const { data, error } = await supabase
        .from('offerings')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching business offerings:', error);
      return [];
    }
  }

  // Get offering images
  static async getOfferingImages(offeringId: string, approvedOnly: boolean = true): Promise<OfferingImage[]> {
    try {
      let query = supabase
        .from('offering_images')
        .select('*')
        .eq('offering_id', offeringId);

      if (approvedOnly) {
        query = query.eq('approved', true);
      }

      const { data, error } = await query.order('is_primary', { ascending: false })
                                      .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching offering images:', error);
      return [];
    }
  }

  // Get pending offering images for admin review
  static async getPendingOfferingImages(): Promise<Array<OfferingImage & {
    offering_title: string;
    business_name: string;
    business_id: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('offering_images')
        .select(`
          *,
          offerings!inner (
            id,
            title,
            business_id,
            businesses!inner (
              id,
              name
            )
          )
        `)
        .eq('approved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the nested data structure
      return (data || []).map(item => ({
        ...item,
        offering_title: item.offerings.title,
        business_name: item.offerings.businesses.name,
        business_id: item.offerings.business_id
      }));
    } catch (error) {
      console.error('❌ Error fetching pending offering images:', error);
      return [];
    }
  }

  // Approve an offering image
  static async approveOfferingImage(imageId: string): Promise<boolean> {
    try {
      console.log('✅ Approving offering image:', imageId);

      // Get the image to find its offering_id
      const { data: image, error: fetchError } = await supabase
        .from('offering_images')
        .select('offering_id')
        .eq('id', imageId)
        .single();

      if (fetchError) throw fetchError;

      // Update image to approved
      const { error: updateError } = await supabase
        .from('offering_images')
        .update({ approved: true })
        .eq('id', imageId);

      if (updateError) throw updateError;

      // Ensure primary image is set if this is the first approved image
      await this.ensurePrimaryImage(image.offering_id, imageId);

      console.log('✅ Image approved successfully');
      return true;
    } catch (error) {
      console.error('❌ Error approving offering image:', error);
      return false;
    }
  }

  // Reject an offering image
  static async rejectOfferingImage(imageId: string): Promise<boolean> {
    try {
      console.log('❌ Rejecting offering image:', imageId);

      // Get the image to find its offering_id
      const { data: image, error: fetchError } = await supabase
        .from('offering_images')
        .select('offering_id, is_primary')
        .eq('id', imageId)
        .single();

      if (fetchError) throw fetchError;

      // Update image to rejected and not primary
      const { error: updateError } = await supabase
        .from('offering_images')
        .update({ 
          approved: false,
          is_primary: false
        })
        .eq('id', imageId);

      if (updateError) throw updateError;

      // If this was the primary image, promote another approved image
      if (image.is_primary) {
        await this.promoteNextPrimaryImage(image.offering_id);
      }

      console.log('✅ Image rejected successfully');
      return true;
    } catch (error) {
      console.error('❌ Error rejecting offering image:', error);
      return false;
    }
  }

  // Set an image as primary
  static async setPrimaryOfferingImage(offeringId: string, imageId: string): Promise<boolean> {
    try {
      console.log('📌 Setting primary image for offering:', offeringId);

      // First, remove primary status from all other images for this offering
      const { error: clearError } = await supabase
        .from('offering_images')
        .update({ is_primary: false })
        .eq('offering_id', offeringId);

      if (clearError) throw clearError;

      // Set the selected image as primary and approved
      const { error: setPrimaryError } = await supabase
        .from('offering_images')
        .update({ 
          is_primary: true,
          approved: true
        })
        .eq('id', imageId);

      if (setPrimaryError) throw setPrimaryError;

      console.log('✅ Primary image set successfully');
      return true;
    } catch (error) {
      console.error('❌ Error setting primary image:', error);
      return false;
    }
  }

  // Promote the next approved image to primary
  private static async promoteNextPrimaryImage(offeringId: string): Promise<void> {
    try {
      console.log('🔄 Promoting next primary image for offering:', offeringId);

      // Find the next approved image to promote
      const { data: nextImage, error } = await supabase
        .from('offering_images')
        .select('id')
        .eq('offering_id', offeringId)
        .eq('approved', true)
        .eq('is_primary', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !nextImage) {
        console.log('ℹ️ No other approved images to promote');
        return;
      }

      // Set as primary
      const { error: updateError } = await supabase
        .from('offering_images')
        .update({ is_primary: true })
        .eq('id', nextImage.id);

      if (updateError) throw updateError;

      console.log('✅ Next image promoted to primary:', nextImage.id);
    } catch (error) {
      console.error('❌ Error promoting next primary image:', error);
    }
  }

  // Get offering by ID
  static async getOfferingById(offeringId: string): Promise<Offering | null> {
    try {
      const { data, error } = await supabase
        .from('offerings')
        .select('*')
        .eq('id', offeringId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('❌ Error fetching offering:', error);
      return null;
    }
  }

  // Batch upload images for an offering (for external sources)
  static async batchUploadOfferingImages(
    offeringId: string,
    imageUrls: Array<{
      url: string;
      source: string;
      license?: string;
      width?: number;
      height?: number;
    }>
  ): Promise<{ success: boolean; approvedCount: number; rejectedCount: number; errors: string[] }> {
    try {
      console.log('📦 Batch uploading', imageUrls.length, 'images for offering:', offeringId);

      const autoApprove = import.meta.env.VITE_AUTO_APPROVE_OFFERINGS === 'true';
      const results = [];
      const errors = [];

      for (const imageData of imageUrls) {
        try {
          // Run safety checks
          const safetyResult = await this.runSafetyChecks(imageData.url, imageData.source);
          const approved = autoApprove && safetyResult.passed;

          // Insert image record
          const { data: newImage, error: insertError } = await supabase
            .from('offering_images')
            .insert({
              offering_id: offeringId,
              source: imageData.source,
              url: imageData.url,
              width: imageData.width,
              height: imageData.height,
              license: imageData.license,
              is_primary: false,
              approved: approved,
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          results.push({ approved, imageId: newImage.id });

          // If approved, check if it should be primary
          if (approved) {
            await this.ensurePrimaryImage(offeringId, newImage.id);
          }
        } catch (error) {
          errors.push(`Failed to upload ${imageData.url}: ${error.message}`);
        }
      }

      const approvedCount = results.filter(r => r.approved).length;
      const rejectedCount = results.filter(r => !r.approved).length;

      console.log('✅ Batch upload completed:', { approvedCount, rejectedCount, errors: errors.length });

      return {
        success: true,
        approvedCount,
        rejectedCount,
        errors
      };
    } catch (error) {
      console.error('❌ Error in batch upload:', error);
      return {
        success: false,
        approvedCount: 0,
        rejectedCount: 0,
        errors: [error instanceof Error ? error.message : 'Batch upload failed']
      };
    }
  }
}