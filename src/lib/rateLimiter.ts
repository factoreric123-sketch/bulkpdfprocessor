import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export class RateLimiter {
  private cache: Map<string, { count: number; resetAt: number }> = new Map();
  
  constructor(private config: RateLimitConfig) {}

  async checkLimit(userId: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${userId}`;
    const now = Date.now();
    
    // Check local cache first
    const cached = this.cache.get(key);
    
    if (cached && cached.resetAt > now) {
      const allowed = cached.count < this.config.maxRequests;
      
      if (allowed) {
        cached.count++;
      }
      
      return {
        allowed,
        remaining: Math.max(0, this.config.maxRequests - cached.count),
        resetAt: new Date(cached.resetAt),
      };
    }
    
    // Reset if window expired
    const resetAt = now + this.config.windowMs;
    this.cache.set(key, { count: 1, resetAt });
    
    // Clean up old entries
    this.cleanup();
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - 1,
      resetAt: new Date(resetAt),
    };
  }
  
  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.resetAt < now) {
        this.cache.delete(key);
      }
    }
  }
  
  reset(userId: string) {
    const key = `${this.config.keyPrefix}:${userId}`;
    this.cache.delete(key);
  }
}

// Rate limiters for different operations
export const operationRateLimiters = {
  merge: new RateLimiter({
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 100 per hour
    keyPrefix: 'merge',
  }),
  
  split: new RateLimiter({
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 100 per hour
    keyPrefix: 'split',
  }),
  
  delete: new RateLimiter({
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 100 per hour
    keyPrefix: 'delete',
  }),
  
  reorder: new RateLimiter({
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 100 per hour
    keyPrefix: 'reorder',
  }),
  
  rename: new RateLimiter({
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 100 per hour
    keyPrefix: 'rename',
  }),
  
  upload: new RateLimiter({
    maxRequests: 500,
    windowMs: 60 * 60 * 1000, // 500 uploads per hour
    keyPrefix: 'upload',
  }),
};

// Global rate limiter for all API calls
export const globalRateLimiter = new RateLimiter({
  maxRequests: 1000,
  windowMs: 60 * 60 * 1000, // 1000 requests per hour
  keyPrefix: 'global',
});

// Helper to check rate limits
export async function checkRateLimit(
  userId: string,
  operation: keyof typeof operationRateLimiters
): Promise<RateLimitResult> {
  // Check global limit first
  const globalCheck = await globalRateLimiter.checkLimit(userId);
  if (!globalCheck.allowed) {
    return globalCheck;
  }
  
  // Check operation-specific limit
  const operationLimiter = operationRateLimiters[operation];
  if (operationLimiter) {
    return await operationLimiter.checkLimit(userId);
  }
  
  return globalCheck;
}

// Database-backed rate limiting for distributed systems
export class DistributedRateLimiter {
  constructor(private config: RateLimitConfig) {}
  
  async checkLimit(userId: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${userId}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs);
    
    try {
      // Count requests in current window
      const { count, error } = await supabase
        .from('rate_limit_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('key', key)
        .gte('created_at', windowStart.toISOString());
      
      if (error) {
        logger.error('Rate limit check failed:', error);
        // Fail open - allow request if we can't check
        return {
          allowed: true,
          remaining: this.config.maxRequests,
          resetAt: new Date(now.getTime() + this.config.windowMs),
        };
      }
      
      const requestCount = count || 0;
      const allowed = requestCount < this.config.maxRequests;
      
      if (allowed) {
        // Log this request
        await supabase
          .from('rate_limit_logs')
          .insert({
            user_id: userId,
            key,
            created_at: now.toISOString(),
          });
      }
      
      return {
        allowed,
        remaining: Math.max(0, this.config.maxRequests - requestCount - (allowed ? 1 : 0)),
        resetAt: new Date(windowStart.getTime() + this.config.windowMs),
      };
    } catch (err) {
      logger.error('Rate limiter error:', err);
      // Fail open
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(now.getTime() + this.config.windowMs),
      };
    }
  }
}