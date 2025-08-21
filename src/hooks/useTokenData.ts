import { useState, useEffect, useCallback } from 'react';
import { coingeckoService } from '@/lib/coingeckoService';
import { TokenInfo, getCurrentNetwork, getEthBalance, getCurrentNetworkConfig } from '@/lib/walletManager';
import { getFallbackTokenData } from '@/lib/fallbackData';

// Token mapping for better CoinGecko ID matching
const tokenMapping: Record<string, string> = {
  'ETH': 'ethereum',
  'WETH': 'ethereum',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'WBTC': 'wrapped-bitcoin',
  'DAI': 'dai',
  'MATIC': 'matic-network',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'CRV': 'curve-dao-token',
  'COMP': 'compound-governance-token',
  'MKR': 'maker',
  'SNX': 'havven',
  'YFI': 'yearn-finance',
  'BAL': 'balancer',
  'SUSHI': 'sushi',
  '1INCH': '1inch',
  'REN': 'republic-protocol',
  'KNC': 'kyber-network-crystal'
};
import { useWallet } from '@/lib/walletContext';
import { requestManager } from '@/lib/requestManager';

export interface TokenData extends TokenInfo {
  price?: number;
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  marketCap?: number;
  volume24h?: number;
  imageUrl?: string;
  lastUpdated?: string;
  isLoading?: boolean;
  error?: string;
  balance?: string;
  balanceUSD?: number;
}

export interface TokenDataMap {
  [address: string]: TokenData;
}

export function useTokenData() {
  const [tokenData, setTokenData] = useState<TokenDataMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { currentWallet, isRefreshingBalances, customTokens } = useWallet();

  // Get all tokens for current network
  const getAllTokens = useCallback(() => {
    const network = getCurrentNetwork();
    
    // Add native token for current network
    const nativeToken: TokenInfo = {
      symbol: network === 'base-sepolia' || network === 'ethereum-sepolia' ? 'ETH' : 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
    };

    return [nativeToken, ...customTokens];
  }, [customTokens]);

  // Fetch token balance for ERC-20 tokens
  const getTokenBalance = useCallback(async (address: string, decimals: number): Promise<string> => {
    if (!currentWallet?.address) return '0.000000';
    
    try {
      const networkConfig = getCurrentNetworkConfig();
      const data = await requestManager.request<{
        error?: { message: string };
        result?: string;
      }>(networkConfig.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{
            to: address,
            data: '0x70a08231' + '000000000000000000000000' + currentWallet.address.slice(2)
          }, 'latest']
        })
      }, {
        cacheKey: `token-balance-${address}-${currentWallet.address}`,
        ttl: 30000, // 30 seconds cache
        retries: 1,
        timeout: 15000
      });

      if (data.error || !data.result) return '0.000000';
      
      const result = data.result;
      if (result === '0x' || result === '0x0' || !result) return '0.000000';
      
      const balanceWei = BigInt(result);
      const balance = Number(balanceWei) / Math.pow(10, decimals);
      return balance.toFixed(6);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return '0.000000';
    }
  }, [currentWallet?.address]);

  // Fetch token data for a single token
  const fetchTokenData = useCallback(async (token: TokenInfo): Promise<TokenData> => {
    const tokenData: TokenData = {
      ...token,
      isLoading: true,
      error: undefined
    };

    try {
      // Fetch balance and price data in parallel
      const balancePromise = token.address === '0x0000000000000000000000000000000000000000' 
        ? (currentWallet?.address ? getEthBalance(currentWallet.address) : Promise.resolve('0.000000'))
        : getTokenBalance(token.address, token.decimals);

      // For native ETH, use a different approach
      if (token.address === '0x0000000000000000000000000000000000000000') {
        const [balance, prices] = await Promise.all([
          balancePromise,
          coingeckoService.getSimplePrices(['ethereum'])
        ]);
        
        tokenData.balance = balance;
        
        if (prices?.ethereum) {
          tokenData.price = prices.ethereum.usd;
          tokenData.priceChange24h = prices.ethereum.usd_24h_change;
          tokenData.priceChangePercentage24h = prices.ethereum.usd_24h_change;
          tokenData.marketCap = prices.ethereum.usd_market_cap;
          tokenData.volume24h = prices.ethereum.usd_24h_vol;
          tokenData.lastUpdated = new Date(prices.ethereum.last_updated_at * 1000).toISOString();
          tokenData.balanceUSD = parseFloat(balance) * prices.ethereum.usd;
        }
        tokenData.imageUrl = token.logoURI;
      } else {
        // Try to get CoinGecko ID from token mapping first
        const coingeckoId = tokenMapping[token.symbol.toUpperCase()];
        
        if (coingeckoId) {
          // Use simple price API for known tokens
          const [balance, prices] = await Promise.all([
            balancePromise,
            coingeckoService.getSimplePrices([coingeckoId])
          ]);
          
          tokenData.balance = balance;
          
          if (prices && prices[coingeckoId]) {
            const priceData = prices[coingeckoId];
            tokenData.price = priceData.usd;
            tokenData.priceChange24h = priceData.usd_24h_change;
            tokenData.priceChangePercentage24h = priceData.usd_24h_change;
            tokenData.marketCap = priceData.usd_market_cap;
            tokenData.volume24h = priceData.usd_24h_vol;
            tokenData.lastUpdated = new Date(priceData.last_updated_at * 1000).toISOString();
            
            if (tokenData.price) {
              tokenData.balanceUSD = parseFloat(balance) * tokenData.price;
            }
          }
        } else {
          // For unknown tokens, use contract API
          const [balance, contractData] = await Promise.all([
            balancePromise,
            coingeckoService.getTokenPriceByContract(token.address)
          ]);
          
          tokenData.balance = balance;
          
          if (contractData) {
            tokenData.price = contractData.market_data?.current_price?.usd;
            tokenData.priceChange24h = contractData.market_data?.price_change_24h;
            tokenData.priceChangePercentage24h = contractData.market_data?.price_change_percentage_24h;
            tokenData.marketCap = contractData.market_data?.market_cap?.usd;
            tokenData.volume24h = contractData.market_data?.total_volume?.usd;
            tokenData.lastUpdated = contractData.last_updated;
            tokenData.imageUrl = contractData.image?.small || contractData.image?.thumb || token.logoURI;
            
            if (tokenData.price) {
              tokenData.balanceUSD = parseFloat(balance) * tokenData.price;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch data for token ${token.symbol}:`, error);
      
      // Still try to fetch balance even if price data fails
      try {
        const balance = token.address === '0x0000000000000000000000000000000000000000' 
          ? (currentWallet?.address ? await getEthBalance(currentWallet.address) : '0.000000')
          : await getTokenBalance(token.address, token.decimals);
        tokenData.balance = balance;
      } catch (balanceError) {
        console.warn(`Failed to fetch balance for ${token.symbol}:`, balanceError);
        tokenData.balance = '0.000000';
      }
      
      // Use fallback data when API fails
      const fallbackToken = getFallbackTokenData(token.symbol);
      tokenData.price = fallbackToken.current_price;
      tokenData.priceChange24h = fallbackToken.price_change_percentage_24h;
      tokenData.priceChangePercentage24h = fallbackToken.price_change_percentage_24h;
      tokenData.marketCap = fallbackToken.market_cap;
      tokenData.volume24h = fallbackToken.total_volume;
      tokenData.imageUrl = fallbackToken.image.small || token.logoURI;
      tokenData.lastUpdated = new Date().toISOString();
      tokenData.error = undefined; // Clear error since we have fallback data
      
      if (tokenData.price && tokenData.balance) {
        tokenData.balanceUSD = parseFloat(tokenData.balance) * tokenData.price;
      }
    } finally {
      tokenData.isLoading = false;
    }

    return tokenData;
  }, [getTokenBalance, currentWallet?.address]);

  // Fetch data for all tokens
  const fetchAllTokenData = useCallback(async () => {
    setIsLoading(true);
    const tokens = getAllTokens();
    const newTokenData: TokenDataMap = {};

    // Fetch data for each token with rate limiting
    for (const token of tokens) {
      try {
        const data = await fetchTokenData(token);
        newTokenData[token.address.toLowerCase()] = data;
        
        // Add small delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error fetching data for ${token.symbol}:`, error);
        newTokenData[token.address.toLowerCase()] = {
          ...token,
          isLoading: false,
          error: 'Failed to fetch data',
          imageUrl: token.logoURI
        };
      }
    }

    setTokenData(newTokenData);
    setLastUpdate(new Date());
    setIsLoading(false);
  }, [getAllTokens, fetchTokenData]);

  // Refresh data for a specific token
  const refreshTokenData = useCallback(async (address: string) => {
    const tokens = getAllTokens();
    const token = tokens.find(t => t.address.toLowerCase() === address.toLowerCase());
    
    if (!token) return;

    try {
      const data = await fetchTokenData(token);
      setTokenData(prev => ({
        ...prev,
        [address.toLowerCase()]: data
      }));
    } catch (error) {
      console.error(`Error refreshing data for ${address}:`, error);
    }
  }, [getAllTokens, fetchTokenData]);

  // Get token data by address
  const getTokenData = useCallback((address: string): TokenData | undefined => {
    return tokenData[address.toLowerCase()];
  }, [tokenData]);

  // Get all token data as array
  const getAllTokenData = useCallback((): TokenData[] => {
    return Object.values(tokenData);
  }, [tokenData]);

  // Get tokens with prices
  const getTokensWithPrices = useCallback((): TokenData[] => {
    return Object.values(tokenData).filter(token => token.price !== undefined);
  }, [tokenData]);

  // Get total portfolio value in USD
  const getPortfolioValue = useCallback((balances: { [address: string]: string }): number => {
    let totalValue = 0;
    
    Object.entries(balances).forEach(([address, balance]) => {
      const token = tokenData[address.toLowerCase()];
      if (token?.price && balance) {
        const balanceNum = parseFloat(balance);
        if (!isNaN(balanceNum)) {
          totalValue += balanceNum * token.price;
        }
      }
    });
    
    return totalValue;
  }, [tokenData]);

  // Format token balance with USD value
  const formatTokenBalance = useCallback((
    address: string, 
    balance: string
  ): { balance: string; usdValue: string } => {
    const token = tokenData[address.toLowerCase()];
    const balanceNum = parseFloat(balance);
    
    if (isNaN(balanceNum)) {
      return { balance: '0', usdValue: '$0.00' };
    }

    const formattedBalance = balanceNum.toFixed(token?.decimals || 6);
    const usdValue = token?.price 
      ? coingeckoService.formatPrice(balanceNum * token.price)
      : '$0.00';

    return { balance: formattedBalance, usdValue };
  }, [tokenData]);

  // Initialize data on mount
  useEffect(() => {
    fetchAllTokenData();
  }, [fetchAllTokenData]);

  // React to balance refresh events from wallet context
  useEffect(() => {
    if (isRefreshingBalances && currentWallet) {
      console.log('TokenData: Balance refresh triggered, fetching fresh data...');
      fetchAllTokenData();
    }
  }, [isRefreshingBalances, currentWallet, fetchAllTokenData]);

  // React to custom tokens changes (when tokens are added/removed)
  useEffect(() => {
    if (currentWallet) {
      console.log('TokenData: Custom tokens changed, refreshing data...');
      fetchAllTokenData();
    }
  }, [customTokens, currentWallet, fetchAllTokenData]);

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllTokenData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchAllTokenData]);

  return {
    tokenData,
    isLoading,
    lastUpdate,
    fetchAllTokenData,
    refreshTokenData,
    getTokenData,
    getAllTokenData,
    getTokensWithPrices,
    getPortfolioValue,
    formatTokenBalance,
    // Utility functions
    formatPrice: coingeckoService.formatPrice,
    formatPercentageChange: coingeckoService.formatPercentageChange,
    formatMarketCap: coingeckoService.formatMarketCap,
    formatVolume: coingeckoService.formatVolume
  };
}
