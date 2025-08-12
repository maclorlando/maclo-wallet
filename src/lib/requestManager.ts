// Request Manager for rate limiting, caching, and graceful failure handling

interface RequestCache {
  [key: string]: {
    data: unknown;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
  };
}

interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number; // in milliseconds
}

class RequestManager {
  private cache: RequestCache = {};
  private requestTimestamps: { [key: string]: number[] } = {};
  private pendingRequests: { [key: string]: Promise<unknown> } = {};
  private defaultRateLimit: RateLimitConfig = { maxRequests: 10, timeWindow: 1000 }; // 10 requests per second
  private imageRateLimit: RateLimitConfig = { maxRequests: 5, timeWindow: 2000 }; // 5 requests per 2 seconds for images

  // Check if request is within rate limit
  private isRateLimited(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const timestamps = this.requestTimestamps[key] || [];
    
    // Remove old timestamps outside the time window
    const validTimestamps = timestamps.filter(timestamp => now - timestamp < config.timeWindow);
    this.requestTimestamps[key] = validTimestamps;
    
    return validTimestamps.length >= config.maxRequests;
  }

  // Add timestamp for rate limiting
  private addTimestamp(key: string): void {
    if (!this.requestTimestamps[key]) {
      this.requestTimestamps[key] = [];
    }
    this.requestTimestamps[key].push(Date.now());
  }

  // Check if request is cached and still valid
  private getCachedResponse(key: string): unknown | null {
    const cached = this.cache[key];
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  // Cache response
  private cacheResponse(key: string, data: unknown, ttl: number = 300000): void { // Default 5 minutes
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl
    };
  }

  // Clear old cache entries
  private cleanupCache(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach(key => {
      if (now - this.cache[key].timestamp > this.cache[key].ttl) {
        delete this.cache[key];
      }
    });
  }

  // Main request method with rate limiting, caching, and deduplication
  async request<T>(
    url: string,
    options: RequestInit = {},
    config: {
      rateLimit?: RateLimitConfig;
      cacheKey?: string;
      ttl?: number;
      retries?: number;
      retryDelay?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const {
      rateLimit = this.defaultRateLimit,
      cacheKey = url,
      ttl = 300000, // 5 minutes default
      retries = 2,
      retryDelay = 1000,
      timeout = 10000 // 10 seconds default
    } = config;

    // Cleanup old cache entries
    this.cleanupCache();

    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached as T;
    }

    // Check if request is already pending (deduplication)
    if (this.pendingRequests[cacheKey] !== undefined) {
      return this.pendingRequests[cacheKey] as Promise<T>;
    }

    // Check rate limit
    if (this.isRateLimited(cacheKey, rateLimit)) {
      throw new Error(`Rate limit exceeded for ${cacheKey}. Please try again later.`);
    }

    // Create the request promise
    const requestPromise = this.executeRequest<T>(url, options, {
      retries,
      retryDelay,
      timeout,
      cacheKey,
      ttl,
      rateLimit
    });

    // Store pending request for deduplication
    this.pendingRequests[cacheKey] = requestPromise;

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      delete this.pendingRequests[cacheKey];
    }
  }

  // Execute the actual request with retries
  private async executeRequest<T>(
    url: string,
    options: RequestInit,
    config: {
      retries: number;
      retryDelay: number;
      timeout: number;
      cacheKey: string;
      ttl: number;
      rateLimit: RateLimitConfig;
    }
  ): Promise<T> {
    const { retries, retryDelay, timeout, cacheKey, ttl } = config;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add timestamp for rate limiting
        this.addTimestamp(cacheKey);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache successful response
        this.cacheResponse(cacheKey, data, ttl);
        
        return data;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error(`Request timeout for ${url}`);
          }
          if (error.message.includes('HTTP 404') || error.message.includes('HTTP 403')) {
            throw error; // Don't retry on 404 or 403
          }
        }

        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error(`Request failed after ${retries + 1} attempts`);
  }

  // Specialized method for image requests
  async checkImageExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      return response.ok;
    } catch (error) {
      console.log(`Image check failed for ${url}:`, error);
      return false;
    }
  }

  // Get image URL with fallbacks
  async getImageUrl(symbol: string, address: string): Promise<string> {
    const cacheKey = `image-${symbol}-${address}`;
    
    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached as string;
    }

    // For native ETH, return default immediately
    if (address === '0x0000000000000000000000000000000000000000') {
      const defaultImage = 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
      this.cacheResponse(cacheKey, defaultImage, 3600000);
      return defaultImage;
    }

    const sources = [
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`,
      `https://cryptologos.cc/logos/${symbol.toLowerCase()}-${symbol.toLowerCase()}-logo.png`,
    ];

    // Try each source with a short timeout
    for (const source of sources) {
      try {
        const exists = await this.checkImageExists(source);
        if (exists) {
          // Cache the successful URL
          this.cacheResponse(cacheKey, source, 3600000); // 1 hour cache for image URLs
          return source;
        }
      } catch (error) {
        console.log(`Failed to check image at ${source}:`, error);
        continue;
      }
    }

    // Return default image if all sources fail
    const defaultImage = 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
    this.cacheResponse(cacheKey, defaultImage, 3600000);
    return defaultImage;
  }

  // Clear all cache
  clearCache(): void {
    this.cache = {};
  }

  // Get cache statistics
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: Object.keys(this.cache).length,
      keys: Object.keys(this.cache)
    };
  }
}

// Export singleton instance
export const requestManager = new RequestManager();

// Export types for external use
export type { RateLimitConfig };
