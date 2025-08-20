// Fallback data for when CoinGecko API is unavailable
export const fallbackData = {
  // Default token data for common tokens
  defaultTokens: {
    'ethereum': {
      id: 'ethereum',
      symbol: 'ETH',
      name: 'Ethereum',
      current_price: 2500, // Placeholder price
      price_change_percentage_24h: 2.5,
      market_cap: 300000000000,
      total_volume: 15000000000,
      image: {
        thumb: 'https://assets.coingecko.com/coins/images/279/thumb/ethereum.png',
        small: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
        large: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png'
      }
    },
    'usd-coin': {
      id: 'usd-coin',
      symbol: 'USDC',
      name: 'USD Coin',
      current_price: 1.00,
      price_change_percentage_24h: 0.0,
      market_cap: 25000000000,
      total_volume: 5000000000,
      image: {
        thumb: 'https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png',
        small: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
        large: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png'
      }
    },
    'tether': {
      id: 'tether',
      symbol: 'USDT',
      name: 'Tether',
      current_price: 1.00,
      price_change_percentage_24h: 0.0,
      market_cap: 95000000000,
      total_volume: 80000000000,
      image: {
        thumb: 'https://assets.coingecko.com/coins/images/325/thumb/Tether.png',
        small: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
        large: 'https://assets.coingecko.com/coins/images/325/large/Tether.png'
      }
    },
    'wrapped-bitcoin': {
      id: 'wrapped-bitcoin',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      current_price: 45000, // Placeholder price
      price_change_percentage_24h: 1.2,
      market_cap: 8000000000,
      total_volume: 500000000,
      image: {
        thumb: 'https://assets.coingecko.com/coins/images/7598/thumb/wrapped_bitcoin_wbtc.png',
        small: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
        large: 'https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png'
      }
    },
    'dai': {
      id: 'dai',
      symbol: 'DAI',
      name: 'Dai',
      current_price: 1.00,
      price_change_percentage_24h: 0.0,
      market_cap: 5000000000,
      total_volume: 2000000000,
      image: {
        thumb: 'https://assets.coingecko.com/coins/images/9956/thumb/4943.png',
        small: 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
        large: 'https://assets.coingecko.com/coins/images/9956/large/4943.png'
      }
    }
  },

  // Default global market data
  globalMarketData: {
    active_cryptocurrencies: 2500,
    total_market_cap: { usd: 1200000000000 },
    total_volume: { usd: 50000000000 },
    market_cap_percentage: {
      bitcoin: 45.2,
      ethereum: 18.5
    },
    market_cap_change_percentage_24h_usd: 2.1
  },

  // Default token images for common tokens
  tokenImages: {
    '0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    '0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8C': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
  } as Record<string, string>,

  // Default placeholder image
  placeholderImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6IiBmaWxsPSIjOTNBQ0E1Ii8+CjxwYXRoIGQ9Ik0xMiA2Yy0yLjIxIDAtNCAxLjc5LTQgNHMxLjc5IDQgNCA0IDQtMS43OSA0LTQtMS43OS00LTQtNHoiIGZpbGw9IiM5M0FDQTUiLz4KPC9zdmc+Cjwvc3ZnPgo='
};

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

// Helper function to get fallback token data
export function getFallbackTokenData(symbol: string, address: string) {
  const lowerSymbol = symbol.toLowerCase();
  const upperSymbol = symbol.toUpperCase();
  
  // First try to map the symbol to a known CoinGecko ID
  const mappedId = tokenMapping[upperSymbol];
  if (mappedId && fallbackData.defaultTokens[mappedId as keyof typeof fallbackData.defaultTokens]) {
    return fallbackData.defaultTokens[mappedId as keyof typeof fallbackData.defaultTokens];
  }
  
  // Check if we have fallback data for this token
  for (const [, token] of Object.entries(fallbackData.defaultTokens)) {
    if (token.symbol.toLowerCase() === lowerSymbol || 
        token.id.toLowerCase() === lowerSymbol) {
      return token;
    }
  }
  
  // Return generic fallback
  return {
    id: symbol.toLowerCase(),
    symbol: symbol.toUpperCase(),
    name: symbol,
    current_price: 0,
    price_change_percentage_24h: 0,
    market_cap: 0,
    total_volume: 0,
    image: {
      thumb: fallbackData.placeholderImage,
      small: fallbackData.placeholderImage,
      large: fallbackData.placeholderImage
    }
  };
}

// Helper function to get fallback image
export function getFallbackImage(address: string): string {
  const lowerAddress = address.toLowerCase();
  return fallbackData.tokenImages[lowerAddress] || fallbackData.placeholderImage;
}
