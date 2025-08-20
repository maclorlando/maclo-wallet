// CoinGecko API Service with rate limiting and error handling
import { requestManager } from './requestManager';

export interface CoinGeckoToken {
  id: string;
  symbol: string;
  name: string;
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export interface CoinGeckoSimplePrice {
  [coinId: string]: {
    usd: number;
    usd_24h_vol: number;
    usd_24h_change: number;
    usd_market_cap: number;
    last_updated_at: number;
  };
}

export interface CoinGeckoContractData {
  id: string;
  symbol: string;
  name: string;
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  platforms: {
    [platform: string]: string;
  };
  market_data?: {
    current_price: {
      usd: number;
    };
    price_change_24h: number;
    price_change_percentage_24h: number;
    market_cap: {
      usd: number;
    };
    total_volume: {
      usd: number;
    };
  };
  last_updated: string;
}

class CoinGeckoService {
  private readonly baseUrl = '/api/coingecko'; // Use our proxy endpoint
  private readonly apiKey = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
  private readonly rateLimitConfig = { maxRequests: 1, timeWindow: 12000 }; // 1 request per 12 seconds for Pro API
  private readonly freeRateLimitConfig = { maxRequests: 1, timeWindow: 60000 }; // 1 request per minute for free API

  private getRateLimitConfig() {
    return this.apiKey ? this.rateLimitConfig : this.freeRateLimitConfig;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['X-CG-Pro-API-Key'] = this.apiKey;
    }
    
    return headers;
  }

  // Get token price by contract address
  async getTokenPriceByContract(
    contractAddress: string, 
    platform: string = 'ethereum'
  ): Promise<CoinGeckoContractData | null> {
    try {
      const cacheKey = `coingecko-contract-${platform}-${contractAddress}`;
      
      const endpoint = `/coins/${platform}/contract/${contractAddress}`;
      const response = await requestManager.request<CoinGeckoContractData>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey,
          ttl: 300000, // 5 minutes cache
          retries: 1,
          timeout: 10000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response;
    } catch (error) {
      console.warn(`Failed to fetch token price for ${contractAddress}:`, error);
      return null;
    }
  }

  // Get simple price for multiple tokens
  async getSimplePrices(
    coinIds: string[], 
    vsCurrencies: string[] = ['usd']
  ): Promise<CoinGeckoSimplePrice | null> {
    try {
      const ids = coinIds.join(',');
      const vs = vsCurrencies.join(',');
      const cacheKey = `coingecko-simple-${ids}-${vs}`;
      
      const endpoint = `/simple/price?ids=${ids}&vs_currencies=${vs}&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`;
      const response = await requestManager.request<CoinGeckoSimplePrice>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey,
          ttl: 300000, // 5 minutes cache
          retries: 1,
          timeout: 10000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response;
    } catch (error) {
      console.warn('Failed to fetch simple prices:', error);
      return null;
    }
  }

  // Get token image by contract address
  async getTokenImageByContract(
    contractAddress: string, 
    platform: string = 'ethereum'
  ): Promise<string | null> {
    try {
      const tokenData = await this.getTokenPriceByContract(contractAddress, platform);
      return tokenData?.image?.small || tokenData?.image?.thumb || null;
    } catch (error) {
      console.warn(`Failed to fetch token image for ${contractAddress}:`, error);
      return null;
    }
  }

  // Get top gainers and losers (Pro API feature)
  async getTopGainersLosers(): Promise<{
    top_gainers: CoinGeckoToken[];
    top_losers: CoinGeckoToken[];
  } | null> {
    if (!this.apiKey) {
      console.warn('Top gainers/losers requires Pro API key');
      return null;
    }

    try {
      const cacheKey = 'coingecko-top-gainers-losers';
      
      const endpoint = `/coins/top_gainers_losers`;
      const response = await requestManager.request<{
        top_gainers: CoinGeckoToken[];
        top_losers: CoinGeckoToken[];
      }>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey,
          ttl: 300000, // 5 minutes cache
          retries: 1,
          timeout: 10000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response;
    } catch (error) {
      console.warn('Failed to fetch top gainers/losers:', error);
      return null;
    }
  }

  // Get recently added coins (Pro API feature)
  async getRecentlyAddedCoins(): Promise<CoinGeckoToken[] | null> {
    if (!this.apiKey) {
      console.warn('Recently added coins requires Pro API key');
      return null;
    }

    try {
      const cacheKey = 'coingecko-recently-added';
      
      const endpoint = `/coins/list/new`;
      const response = await requestManager.request<CoinGeckoToken[]>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey,
          ttl: 600000, // 10 minutes cache
          retries: 1,
          timeout: 10000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response;
    } catch (error) {
      console.warn('Failed to fetch recently added coins:', error);
      return null;
    }
  }

  // Get global market data
  async getGlobalMarketData(): Promise<{
    active_cryptocurrencies: number;
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { [key: string]: number };
    market_cap_change_percentage_24h_usd: number;
  } | null> {
    try {
      const cacheKey = 'coingecko-global';
      
      const endpoint = `/global`;
      const response = await requestManager.request<{
        data: {
          active_cryptocurrencies: number;
          total_market_cap: { usd: number };
          total_volume: { usd: number };
          market_cap_percentage: { [key: string]: number };
          market_cap_change_percentage_24h_usd: number;
        };
      }>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey,
          ttl: 300000, // 5 minutes cache
          retries: 1,
          timeout: 10000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response.data;
    } catch (error) {
      console.warn('Failed to fetch global market data:', error);
      return null;
    }
  }

  // Search for coins
  async searchCoins(query: string): Promise<{
    coins: Array<{
      id: string;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
      large: string;
    }>;
  } | null> {
    try {
      const cacheKey = `coingecko-search-${query}`;
      
      const endpoint = `/search?query=${encodeURIComponent(query)}`;
      const response = await requestManager.request<{
        coins: Array<{
          id: string;
          name: string;
          symbol: string;
          market_cap_rank: number;
          thumb: string;
          large: string;
        }>;
      }>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey,
          ttl: 600000, // 10 minutes cache
          retries: 1,
          timeout: 10000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response;
    } catch (error) {
      console.warn('Failed to search coins:', error);
      return null;
    }
  }

  // Get trending searches
  async getTrendingSearches(): Promise<{
    coins: Array<{
      item: {
        id: string;
        name: string;
        symbol: string;
        market_cap_rank: number;
        thumb: string;
        large: string;
      };
    }>;
  } | null> {
    try {
      const cacheKey = 'coingecko-trending';
      
      const endpoint = `/search/trending`;
      const response = await requestManager.request<{
        coins: Array<{
          item: {
            id: string;
            name: string;
            symbol: string;
            market_cap_rank: number;
            thumb: string;
            large: string;
          };
        }>;
      }>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey,
          ttl: 300000, // 5 minutes cache
          retries: 1,
          timeout: 10000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response;
    } catch (error) {
      console.warn('Failed to fetch trending searches:', error);
      return null;
    }
  }

  // Check API status
  async ping(): Promise<boolean> {
    try {
      const endpoint = `/ping`;
      const response = await requestManager.request<{ gecko_says: string }>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey: 'coingecko-ping',
          ttl: 60000, // 1 minute cache
          retries: 1,
          timeout: 5000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response.gecko_says === '(V3) To the Moon!';
    } catch (error) {
      console.warn('CoinGecko API ping failed:', error);
      return false;
    }
  }

  // Get API usage (Pro API only)
  async getApiUsage(): Promise<{
    status: {
      total: number;
      used: number;
      remaining: number;
      reset: number;
    };
  } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const endpoint = `/key`;
      const response = await requestManager.request<{
        status: {
          total: number;
          used: number;
          remaining: number;
          reset: number;
        };
      }>(
        `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        },
        {
          cacheKey: 'coingecko-api-usage',
          ttl: 60000, // 1 minute cache
          retries: 1,
          timeout: 5000,
          rateLimit: this.getRateLimitConfig(),
        }
      );

      return response;
    } catch (error) {
      console.warn('Failed to fetch API usage:', error);
      return null;
    }
  }

  // Format price with proper decimals
  formatPrice(price: number | null | undefined): string {
    if (price === null || price === undefined) return '$0.00';
    
    if (price < 0.01) {
      return `$${price.toFixed(8)}`;
    } else if (price < 1) {
      return `$${price.toFixed(4)}`;
    } else if (price < 1000) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // Format percentage change
  formatPercentageChange(change: number | null | undefined): string {
    if (change === null || change === undefined) return '0.00%';
    
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  // Format market cap
  formatMarketCap(marketCap: number | null | undefined): string {
    if (marketCap === null || marketCap === undefined) return '$0';
    
    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(2)}T`;
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(2)}M`;
    } else if (marketCap >= 1e3) {
      return `$${(marketCap / 1e3).toFixed(2)}K`;
    } else {
      return `$${marketCap.toFixed(2)}`;
    }
  }

  // Format volume
  formatVolume(volume: number | null | undefined): string {
    if (volume === null || volume === undefined) return '$0';
    
    if (volume >= 1e12) {
      return `$${(volume / 1e12).toFixed(2)}T`;
    } else if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(2)}K`;
    } else {
      return `$${volume.toFixed(2)}`;
    }
  }
}

// Export singleton instance
export const coingeckoService = new CoinGeckoService();


