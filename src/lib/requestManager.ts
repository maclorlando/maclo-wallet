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
  private imageRateLimit: RateLimitConfig = { maxRequests: 1, timeWindow: 5000 }; // 1 request per 5 seconds for images
  private coingeckoRateLimit: RateLimitConfig = { maxRequests: 1, timeWindow: 10000 }; // 1 request per 10 seconds for CoinGecko

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
          if (error.message.includes('HTTP 404') || error.message.includes('HTTP 403') || error.message.includes('HTTP 429')) {
            throw error; // Don't retry on 404, 403, or 429
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

  // Get image URL with fallbacks - now with much stricter rate limiting and better error handling
  async getImageUrl(symbol: string, address: string): Promise<string> {
    const cacheKey = `image-${symbol}-${address}`;
    
    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached as string;
    }

    // For native ETH, return default immediately
    if (address === '0x0000000000000000000000000000000000000000') {
      const defaultImage = 'https://assets.coingecko.com/coins/images/279/small/ethereum.png';
      this.cacheResponse(cacheKey, defaultImage, 3600000);
      return defaultImage;
    }

    // Try multiple reliable sources in order of preference with strict rate limiting
    const sources = [
      // 1. CoinGecko API (most reliable) - with very strict rate limiting
      async () => {
        try {
          // Check if we're rate limited for CoinGecko
          if (this.isRateLimited('coingecko-global', this.coingeckoRateLimit)) {
            throw new Error('CoinGecko rate limit exceeded');
          }

          const response = await this.request<{
            id?: string;
            image?: { small?: string; large?: string; thumb?: string };
          }>(`https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`, {}, {
            cacheKey: `coingecko-${address}`,
            ttl: 3600000, // 1 hour cache
            retries: 0, // No retries for CoinGecko to avoid rate limits
            timeout: 8000,
            rateLimit: this.coingeckoRateLimit
          });
          
          if (response.image?.small || response.image?.thumb) {
            return response.image.small || response.image.thumb;
          }
          throw new Error('No image found in CoinGecko response');
        } catch (error) {
          console.log(`CoinGecko failed for ${symbol}:`, error);
          throw error;
        }
      },
      
      // 2. Trust Wallet Assets (good for Ethereum tokens)
      async () => {
        const trustWalletUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;
        try {
          // Check if image exists before caching
          const exists = await this.checkImageExists(trustWalletUrl);
          if (exists) {
            return trustWalletUrl;
          }
          throw new Error('Trust Wallet image not found');
        } catch (error) {
          console.log(`Trust Wallet failed for ${symbol}:`, error);
          throw error;
        }
      },
      
      // 3. Token Lists (for popular tokens) - using a more reliable endpoint
      async () => {
        const tokenListUrl = `https://raw.githubusercontent.com/Uniswap/token-lists/main/test/schema/tokenlist.json`;
        try {
          const response = await this.request<{
            tokens?: Array<{
              address: string;
              symbol: string;
              logoURI?: string;
            }>;
          }>(tokenListUrl, {}, {
            cacheKey: 'token-list-uniswap-raw',
            ttl: 1800000, // 30 minutes cache
            retries: 1,
            timeout: 5000,
            rateLimit: this.imageRateLimit
          });
          
          const token = response.tokens?.find(t => 
            t.address.toLowerCase() === address.toLowerCase()
          );
          
          if (token?.logoURI) {
            return token.logoURI;
          }
          throw new Error('Token not found in token list');
        } catch (error) {
          console.log(`Token list failed for ${symbol}:`, error);
          throw error;
        }
      }
    ];

    // Try each source with proper error handling
    for (const source of sources) {
      try {
        const imageUrl = await source();
        if (imageUrl) {
          this.cacheResponse(cacheKey, imageUrl, 3600000); // 1 hour cache for successful image URLs
          return imageUrl;
        }
      } catch (error) {
        console.log(`Source failed for ${symbol}:`, error);
        continue;
      }
    }

    // If all sources fail, return a generated fallback URL
    // This will be handled by the SafeImage component to show colored initials
    const fallbackUrl = `data:image/svg+xml;base64,${btoa(`
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="16" fill="#${this.generateColorFromString(symbol)}"/>
        <text x="16" y="20" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="white">
          ${symbol.substring(0, 3).toUpperCase()}
        </text>
      </svg>
    `)}`;
    
    this.cacheResponse(cacheKey, fallbackUrl, 7200000); // Cache fallback for 2 hours
    return fallbackUrl;
  }

  // Generate a consistent color from a string
  private generateColorFromString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate a color with good contrast
    const hue = Math.abs(hash) % 360;
    const saturation = 70 + (Math.abs(hash) % 20); // 70-90%
    const lightness = 40 + (Math.abs(hash) % 20); // 40-60%
    
    // Convert HSL to hex
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    const hueToRgb = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const r = Math.round(hueToRgb(h + 1/3) * 255);
    const g = Math.round(hueToRgb(h) * 255);
    const b = Math.round(hueToRgb(h - 1/3) * 255);
    
    return ((r << 16) + (g << 8) + b).toString(16).padStart(6, '0');
  }

  // Clear all cache
  clearCache(): void {
    this.cache = {};
  }

  // Clear image cache specifically
  clearImageCache(): void {
    const keysToRemove = Object.keys(this.cache).filter(key => 
      key.startsWith('image-') || 
      key.startsWith('coingecko-') || 
      key.startsWith('trustwallet-check-') ||
      key.startsWith('token-list-')
    );
    keysToRemove.forEach(key => delete this.cache[key]);
  }

  // Clear all problematic cached data and force refresh
  clearAllCachedData(): void {
    this.cache = {};
    this.requestTimestamps = {};
    this.pendingRequests = {};
    console.log('All cached data cleared');
  }

  // Get cache statistics
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: Object.keys(this.cache).length,
      keys: Object.keys(this.cache)
    };
  }

  // Get rate limit status for debugging
  getRateLimitStatus(): { [key: string]: { timestamps: number[]; isLimited: boolean } } {
    const status: { [key: string]: { timestamps: number[]; isLimited: boolean } } = {};
    
    Object.keys(this.requestTimestamps).forEach(key => {
      const timestamps = this.requestTimestamps[key];
      const now = Date.now();
      
      // Determine which rate limit config to use
      let config: RateLimitConfig;
      if (key.includes('coingecko')) {
        config = this.coingeckoRateLimit;
      } else if (key.includes('image') || key.includes('token-list')) {
        config = this.imageRateLimit;
      } else {
        config = this.defaultRateLimit;
      }
      
      const validTimestamps = timestamps.filter(timestamp => now - timestamp < config.timeWindow);
      const isLimited = validTimestamps.length >= config.maxRequests;
      
      status[key] = {
        timestamps: validTimestamps,
        isLimited
      };
    });
    
    return status;
  }
}

// Export singleton instance
export const requestManager = new RequestManager();

// Export types for external use
export type { RateLimitConfig };
