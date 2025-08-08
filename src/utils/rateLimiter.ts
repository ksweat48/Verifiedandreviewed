/**
 * Rate Limiting Utilities for Netlify Functions
 * Provides reusable rate limiting logic using Supabase as storage
 */

import { createClient } from '@supabase/supabase-js';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  functionName: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds to wait before retry
}

export interface RateLimitIdentifier {
  value: string;
  type: 'user_id' | 'ip_address';
}

/**
 * Check if a request should be rate limited
 */
export async function checkRateLimit(
  identifier: RateLimitIdentifier,
  config: RateLimitConfig,
  supabaseUrl: string,
  supabaseServiceKey: string,
  userAgent?: string,
  metadata?: Record<string, any>
): Promise<RateLimitResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Calculate the time window start
    const windowStart = new Date();
    windowStart.setSeconds(windowStart.getSeconds() - config.windowSeconds);
    
    // Count recent requests from this identifier for this function
    const { data: recentRequests, error: countError } = await supabase
      .from('rate_limits')
      .select('id', { count: 'exact' })
      .eq('identifier', identifier.value)
      .eq('type', identifier.type)
      .eq('function_name', config.functionName)
      .gte('request_at', windowStart.toISOString());
    
    if (countError) {
      console.error('Rate limit check failed:', countError);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: new Date(Date.now() + config.windowSeconds * 1000)
      };
    }
    
    const requestCount = recentRequests?.length || 0;
    const remaining = Math.max(0, config.maxRequests - requestCount);
    const resetTime = new Date(Date.now() + config.windowSeconds * 1000);
    
    console.log(`Rate limit check for ${identifier.type} ${identifier.value} on ${config.functionName}:`, {
      requestCount,
      maxRequests: config.maxRequests,
      remaining,
      windowSeconds: config.windowSeconds
    });
    
    // Check if limit exceeded
    if (requestCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: config.windowSeconds
      };
    }
    
    // Record this request
    const { error: insertError } = await supabase
      .from('rate_limits')
      .insert({
        identifier: identifier.value,
        type: identifier.type,
        function_name: config.functionName,
        request_at: new Date().toISOString(),
        user_agent: userAgent,
        metadata: metadata || {}
      });
    
    if (insertError) {
      console.error('Failed to record rate limit entry:', insertError);
      // Continue anyway - don't block the request due to logging failure
    }
    
    return {
      allowed: true,
      remaining: remaining - 1, // Subtract 1 for the current request
      resetTime
    };
    
  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: new Date(Date.now() + config.windowSeconds * 1000)
    };
  }
}

/**
 * Extract user ID from Authorization header (JWT token)
 */
export function extractUserIdFromAuth(authHeader: string | null, supabaseUrl: string, supabaseServiceKey: string): Promise<string | null> {
  return new Promise(async (resolve) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      resolve(null);
      return;
    }
    
    try {
      const token = authHeader.replace('Bearer ', '');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        resolve(null);
        return;
      }
      
      resolve(user.id);
    } catch (error) {
      console.error('Error extracting user ID from auth:', error);
      resolve(null);
    }
  });
}

/**
 * Get client IP address from Netlify headers
 */
export function getClientIP(event: any): string {
  // Netlify provides the client IP in this header
  return event.headers['x-nf-client-ip'] || 
         event.headers['x-forwarded-for']?.split(',')[0] || 
         event.headers['x-real-ip'] || 
         'unknown';
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.remaining.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetTime.getTime() / 1000).toString()
  };
  
  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  
  return headers;
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult, corsHeaders: Record<string, string>) {
  return {
    statusCode: 429,
    headers: {
      ...corsHeaders,
      ...createRateLimitHeaders(result),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
      resetTime: result.resetTime.toISOString()
    })
  };
}