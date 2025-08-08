// Nightly Job for Refreshing Offerings and Image Quality Guard
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Helper function to check if Google Vision moderation is enabled
async function isVisionModerationEnabled(supabase) {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_name', 'enable_vision_moderation')
      .single();

    if (error) {
      console.log('Vision moderation setting not found, defaulting to disabled');
      return false;
    }

    return data?.setting_value?.enabled === true;
  } catch (error) {
    console.error('Error checking vision moderation setting:', error);
    return false;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🌙 Starting nightly offerings refresh job...');
    
    // Check required environment variables
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const BASE_URL = process.env.URL || 'http://localhost:8888';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required Supabase environment variables');
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results = {
      offeringsProcessed: 0,
      embeddingsGenerated: 0,
      embeddingErrors: 0,
      imagesReviewed: 0,
      imagesApproved: 0,
      imagesRejected: 0,
      primaryImagesPromoted: 0,
      errors: []
    };

    // Get the time threshold for "recent" changes (last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const timeThreshold = twentyFourHoursAgo.toISOString();

    console.log(`🕐 Processing offerings updated since: ${timeThreshold}`);

    // STEP 1: Find recently updated offerings that need re-embedding
    console.log('📦 Step 1: Finding recently updated offerings...');
    
    const { data: recentOfferings, error: offeringsError } = await supabase
      .from('offerings')
      .select('id, title, business_id, updated_at')
      .eq('status', 'active')
      .gte('updated_at', timeThreshold)
      .order('updated_at', { ascending: false });

    if (offeringsError) {
      console.error('❌ Error fetching recent offerings:', offeringsError);
      results.errors.push(`Failed to fetch recent offerings: ${offeringsError.message}`);
    } else {
      console.log(`✅ Found ${recentOfferings?.length || 0} recently updated offerings`);
      results.offeringsProcessed = recentOfferings?.length || 0;

      // STEP 2: Re-generate embeddings for changed offerings
      if (recentOfferings && recentOfferings.length > 0) {
        console.log('🧠 Step 2: Re-generating embeddings for changed offerings...');
        
        for (const offering of recentOfferings) {
          try {
            console.log(`🔄 Re-embedding offering: ${offering.title} (${offering.id})`);
            
            // Call the generate-embeddings function for this specific offering
            const embeddingResponse = await axios.post(`${BASE_URL}/.netlify/functions/generate-embeddings`, {
              offeringId: offering.id,
              entityType: 'offering',
              forceRegenerate: true
            }, {
              timeout: 30000 // 30 second timeout
            });

            if (embeddingResponse.data.success) {
              console.log(`✅ Successfully re-embedded offering: ${offering.title}`);
              results.embeddingsGenerated++;
            } else {
              console.error(`❌ Failed to re-embed offering: ${offering.title}`, embeddingResponse.data.message);
              results.embeddingErrors++;
              results.errors.push(`Embedding failed for ${offering.title}: ${embeddingResponse.data.message}`);
            }
          } catch (embeddingError) {
            console.error(`❌ Error re-embedding offering ${offering.title}:`, embeddingError.message);
            results.embeddingErrors++;
            results.errors.push(`Embedding error for ${offering.title}: ${embeddingError.message}`);
          }
          
          // Small delay between embedding requests to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // STEP 3: Image Quality Guard - Review recently approved images
    console.log('🛡️ Step 3: Running image quality guard...');
    
    const { data: recentImages, error: imagesError } = await supabase
      .from('offering_images')
      .select(`
        id,
        offering_id,
        url,
        source,
        license,
        is_primary,
        approved,
        created_at,
        offerings!inner (
          id,
          title,
          business_id
        )
      `)
      .eq('approved', true)
      .gte('created_at', timeThreshold)
      .order('created_at', { ascending: false });

    if (imagesError) {
      console.error('❌ Error fetching recent images:', imagesError);
      results.errors.push(`Failed to fetch recent images: ${imagesError.message}`);
    } else {
      console.log(`✅ Found ${recentImages?.length || 0} recently approved images to review`);
      results.imagesReviewed = recentImages?.length || 0;

      // STEP 4: Re-run safety checks on recently approved images
      if (recentImages && recentImages.length > 0) {
        console.log('🔍 Step 4: Re-running safety checks on recently approved images...');
        
        for (const image of recentImages) {
          try {
            console.log(`🔍 Re-checking image: ${image.url}`);
            
            // Re-run safety checks with current moderation settings
            const visionEnabled = await isVisionModerationEnabled(supabase);
            const safetyResult = await runSafetyChecks(image.url, image.source, visionEnabled);
            
            if (!safetyResult.passed) {
              console.warn(`⚠️ Image failed re-check: ${image.url} - ${safetyResult.reason}`);
              
              // Update image to rejected status
              const { error: updateError } = await supabase
                .from('offering_images')
                .update({ 
                  approved: false,
                  is_primary: false
                })
                .eq('id', image.id);

              if (updateError) {
                console.error(`❌ Error updating rejected image ${image.id}:`, updateError);
                results.errors.push(`Failed to update rejected image: ${updateError.message}`);
              } else {
                console.log(`✅ Successfully rejected image: ${image.id}`);
                results.imagesRejected++;
                
                // If this was the primary image, promote the next approved image
                if (image.is_primary) {
                  const promoted = await promoteNextPrimaryImage(supabase, image.offering_id);
                  if (promoted) {
                    results.primaryImagesPromoted++;
                  }
                }
                
                // Log for admin review
                await logImageRejection(supabase, image, safetyResult.reason);
              }
            } else {
              console.log(`✅ Image passed re-check: ${image.url}`);
              results.imagesApproved++;
            }
          } catch (imageError) {
            console.error(`❌ Error processing image ${image.id}:`, imageError.message);
            results.errors.push(`Image processing error: ${imageError.message}`);
          }
          
          // Small delay between image checks
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // STEP 5: Summary and cleanup
    console.log('📊 Nightly refresh job completed:', results);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Nightly offerings refresh completed successfully',
        results: results,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Nightly refresh job failed:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Nightly refresh job failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Helper function to run safety checks on an image (placeholder implementation)
async function runSafetyChecks(imageUrl, source, useVisionModeration = false) {
  try {
    console.log('🛡️ Running safety checks for:', imageUrl);

    const checks = [
      await checkFileSize(imageUrl),
      await checkImageFormat(imageUrl)
    ];

    const allPassed = checks.every(result => result.passed);
    const failedCheck = checks.find(result => !result.passed);

    // If basic checks fail, return immediately
    if (!allPassed) {
      return {
        passed: false,
        reason: failedCheck?.reason,
        confidence: failedCheck?.confidence || 0.8
      };
    }

    // If Google Vision moderation is enabled, use it
    if (useVisionModeration) {
      console.log('🤖 Using Google Vision SafeSearch for:', imageUrl);
      
      try {
        const response = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/moderate-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl }),
          timeout: 15000
        });

        if (!response.ok) {
          throw new Error(`Vision API call failed: ${response.status}`);
        }

        const moderationResult = await response.json();
        
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
        console.error('❌ Google Vision moderation failed, falling back to basic checks:', visionError);
        // Fall back to basic content check if Vision API fails
        return await checkBasicContent(imageUrl, source);
      }
    } else {
      // Vision moderation disabled, use basic content checks
      console.log('⚠️ Google Vision moderation disabled, using basic checks only');
      return await checkBasicContent(imageUrl, source);
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
async function checkFileSize(imageUrl) {
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
async function checkImageFormat(imageUrl) {
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
async function checkBasicContent(imageUrl, source) {
  // Placeholder implementation
  // In a real system, this would:
  // 1. Check for NSFW content using AI services
  // 2. Verify the image matches the offering type (food, product, service)
  // 3. Check for inappropriate text or symbols
  // 4. Validate image quality and clarity

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

// Helper function to promote the next approved image to primary
async function promoteNextPrimaryImage(supabase, offeringId) {
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
      console.log('ℹ️ No other approved images to promote for offering:', offeringId);
      return false;
    }

    // Set as primary
    const { error: updateError } = await supabase
      .from('offering_images')
      .update({ is_primary: true })
      .eq('id', nextImage.id);

    if (updateError) {
      console.error('❌ Error promoting next primary image:', updateError);
      return false;
    }

    console.log('✅ Next image promoted to primary:', nextImage.id);
    return true;
  } catch (error) {
    console.error('❌ Error promoting next primary image:', error);
    return false;
  }
}

// Helper function to log image rejections for admin review
async function logImageRejection(supabase, image, reason) {
  try {
    console.log('📝 Logging image rejection for admin review:', image.id);
    
    // In a real implementation, you might want to create a separate table for admin logs
    // For now, we'll just log to console and could extend this to send notifications
    
    const logEntry = {
      imageId: image.id,
      offeringId: image.offering_id,
      offeringTitle: image.offerings?.title,
      businessId: image.offerings?.business_id,
      imageUrl: image.url,
      rejectionReason: reason,
      originalSource: image.source,
      rejectedAt: new Date().toISOString(),
      wasPrimary: image.is_primary
    };
    
    console.log('📋 Image rejection log entry:', logEntry);
    
    // TODO: In a production system, you could:
    // 1. Insert into an admin_logs table
    // 2. Send email notification to administrators
    // 3. Create a Slack/Discord webhook notification
    // 4. Add to a review queue for manual inspection
    
    return true;
  } catch (error) {
    console.error('❌ Error logging image rejection:', error);
    return false;
  }
}

// Helper function to check if we should run the full job or just a test
function shouldRunFullJob(event) {
  // Check if this is a manual trigger vs scheduled trigger
  const isManualTrigger = event.headers && event.headers['user-agent'];
  const isScheduledTrigger = event.headers && event.headers['netlify-event-type'] === 'scheduled';
  
  // For manual testing, you can add a query parameter to run a limited version
  const isTestRun = event.queryStringParameters?.test === 'true';
  
  return !isTestRun;
}

// Helper function to get job configuration based on trigger type
function getJobConfig(event) {
  const isTestRun = event.queryStringParameters?.test === 'true';
  
  if (isTestRun) {
    return {
      maxOfferings: 5,
      maxImages: 10,
      timeWindowHours: 1 // Only check last hour for testing
    };
  }
  
  return {
    maxOfferings: 100,
    maxImages: 500,
    timeWindowHours: 24 // Full 24-hour window for production
  };
}