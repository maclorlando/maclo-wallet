# CoinGecko API Integration

This wallet now includes real-time cryptocurrency data from the CoinGecko API with proper rate limiting and error handling.

## Features

### Real-time Token Data
- **Token Prices**: Live USD prices for all supported tokens
- **Market Data**: 24h price changes, market cap, volume
- **Token Images**: High-quality token logos from CoinGecko
- **Global Market Overview**: Total market cap, volume, active cryptocurrencies

### Rate Limiting & Safety
- **Pro API Support**: Uses `NEXT_PUBLIC_COINGECKO_API_KEY` environment variable
- **Rate Limiting**: 1 request per 12 seconds (Pro) or 1 per minute (Free)
- **Caching**: 5-minute cache for prices, 1-hour cache for images
- **Error Handling**: Graceful fallbacks when API fails
- **Request Deduplication**: Prevents duplicate API calls

### Components

#### `MarketOverview`
- Displays global cryptocurrency market data
- Shows total market cap, 24h volume, active coins
- Market dominance breakdown for top cryptocurrencies
- Auto-refreshes every 5 minutes

#### `TokenList`
- Real-time token prices and market data
- Price change indicators (green/red arrows)
- Hover tooltips with detailed market information
- Sorted by USD value

#### `useTokenData` Hook
- Manages token data fetching and caching
- Provides formatting utilities for prices, percentages, market cap
- Auto-refreshes data every 5 minutes
- Handles both native ETH and ERC-20 tokens

### API Endpoints Used

- `/simple/price` - Get token prices
- `/coins/{id}/contract/{address}` - Get token data by contract
- `/global` - Global market data
- `/search` - Search for tokens
- `/search/trending` - Trending tokens

### Environment Variables

Add to your `.env.local`:
```
NEXT_PUBLIC_COINGECKO_API_KEY=your_api_key_here
```

### Usage Example

```typescript
import { useTokenData } from '@/hooks/useTokenData';

function MyComponent() {
  const { 
    tokenData, 
    formatPrice, 
    formatPercentageChange 
  } = useTokenData();
  
  return (
    <div>
      {Object.values(tokenData).map(token => (
        <div key={token.address}>
          <h3>{token.symbol}</h3>
          <p>Price: {formatPrice(token.price)}</p>
          <p>24h Change: {formatPercentageChange(token.priceChangePercentage24h)}</p>
        </div>
      ))}
    </div>
  );
}
```

### Error Handling

The integration includes comprehensive error handling:
- Network failures fall back to cached data
- API rate limits are respected with exponential backoff
- Missing token data shows fallback UI
- Console warnings for debugging

### Performance Optimizations

- Request deduplication prevents duplicate calls
- Intelligent caching reduces API usage
- Batch processing for multiple tokens
- Lazy loading of token images
- Debounced search queries

This integration provides a robust, production-ready solution for displaying real-time cryptocurrency data in your wallet application.
