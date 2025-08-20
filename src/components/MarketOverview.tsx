'use client';

import React, { useState, useEffect } from 'react';
import { coingeckoService } from '@/lib/coingeckoService';
import { fallbackData } from '@/lib/fallbackData';
import { 
  ChartBarIcon, 
  GlobeAltIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface MarketData {
  active_cryptocurrencies: number;
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_percentage: { [key: string]: number };
  market_cap_change_percentage_24h_usd: number;
}

export default function MarketOverview() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await coingeckoService.getGlobalMarketData();
      if (data) {
        setMarketData(data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      // Use fallback data when API fails
      setMarketData(fallbackData.globalMarketData);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, []);

  if (isLoading) {
    return (
      <div className="jupiter-card h-96">
        <div className="jupiter-card-header">
          <div className="flex items-center space-x-2">
            <GlobeAltIcon className="h-5 w-5 text-white/60" />
            <h3 className="jupiter-card-title">Market Overview</h3>
          </div>
        </div>
        <div className="jupiter-card-content overflow-y-auto overflow-x-hidden h-full">
          <div className="flex items-center justify-center py-8 h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/20"></div>
            <span className="ml-3 text-white/60">Loading market data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !marketData) {
    return (
      <div className="jupiter-card h-96">
        <div className="jupiter-card-header">
          <div className="flex items-center space-x-2">
            <GlobeAltIcon className="h-5 w-5 text-white/60" />
            <h3 className="jupiter-card-title">Market Overview</h3>
          </div>
        </div>
        <div className="jupiter-card-content overflow-y-auto overflow-x-hidden h-full">
          <div className="text-center py-8 h-full">
            <GlobeAltIcon className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white/80 mb-2">Market Data Unavailable</h3>
            <p className="text-white/60 mb-4">
              {error || 'Unable to load market data at this time.'}
            </p>
            <button
              onClick={fetchMarketData}
              className="jupiter-button-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isMarketUp = marketData.market_cap_change_percentage_24h_usd > 0;
  const isMarketDown = marketData.market_cap_change_percentage_24h_usd < 0;

  return (
    <div className="jupiter-card h-96">
      <div className="jupiter-card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GlobeAltIcon className="h-5 w-5 text-white/60" />
            <h3 className="jupiter-card-title">Market Overview</h3>
            {lastUpdate && (
              <div className="flex items-center text-xs text-white/40">
                <ClockIcon className="h-3 w-3 mr-1" />
                {new Date(lastUpdate).toLocaleTimeString()}
              </div>
            )}
          </div>
          <button
            onClick={fetchMarketData}
            disabled={isLoading}
            className="jupiter-button-secondary text-sm"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="jupiter-card-content">
        {/* Scrollable Market Data - Whole widget scrolls */}
        <div className="space-y-3 w-full pt-2">
          {/* Top Coins Section - Summary card */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 w-full">
            <div className="flex items-center space-x-2">
              <ChartBarIcon className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/60">Top Coins</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {Object.values(marketData.market_cap_percentage)
                  .slice(0, 3)
                  .reduce((sum, percentage) => sum + percentage, 0)
                  .toFixed(1)}%
              </div>
              <div className="text-xs text-white/40 mt-1">
                {Object.entries(marketData.market_cap_percentage)
                  .slice(0, 3)
                  .map(([coin]) => coin.toUpperCase())
                  .join(', ')}
              </div>
            </div>
          </div>

          {/* Total Market Cap */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 w-full">
            <div className="flex items-center space-x-2">
              <CurrencyDollarIcon className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/60">Market Cap</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {coingeckoService.formatMarketCap(marketData.total_market_cap.usd)}
              </div>
              <div className="flex items-center justify-end mt-1">
                {isMarketUp && <ArrowTrendingUpIcon className="h-3 w-3 text-green-400 mr-1" />}
                {isMarketDown && <ArrowTrendingDownIcon className="h-3 w-3 text-red-400 mr-1" />}
                <span className={`text-xs ${
                  isMarketUp ? 'text-green-400' : 
                  isMarketDown ? 'text-red-400' : 'text-white/60'
                }`}>
                  {coingeckoService.formatPercentageChange(marketData.market_cap_change_percentage_24h_usd)}
                </span>
              </div>
            </div>
          </div>

          {/* 24h Volume */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 w-full">
            <div className="flex items-center space-x-2">
              <ChartBarIcon className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/60">24h Volume</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {coingeckoService.formatMarketCap(marketData.total_volume.usd)}
              </div>
              <div className="text-xs text-white/40 mt-1">
                Trading volume
              </div>
            </div>
          </div>

          {/* Active Cryptocurrencies */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 w-full">
            <div className="flex items-center space-x-2">
              <GlobeAltIcon className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/60">Active Coins</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {marketData.active_cryptocurrencies.toLocaleString()}
              </div>
              <div className="text-xs text-white/40 mt-1">
                Tracked assets
              </div>
            </div>
          </div>

          {/* Top 3 Dominance */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 w-full">
            <div className="flex items-center space-x-2">
              <ChartBarIcon className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/60">Top 3 Dominance</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">
                {Object.values(marketData.market_cap_percentage)
                  .slice(0, 3)
                  .reduce((sum, percentage) => sum + percentage, 0)
                  .toFixed(1)}%
              </div>
              <div className="text-xs text-white/40 mt-1">
                Combined share
              </div>
            </div>
          </div>

          {/* Market Status */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 w-full">
            <span className="text-sm text-white/60">Market Status:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isMarketUp ? 'bg-green-400' : 
                isMarketDown ? 'bg-red-400' : 'bg-yellow-400'
              }`}></div>
              <span className={`text-sm font-semibold ${
                isMarketUp ? 'text-green-400' : 
                isMarketDown ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {isMarketUp ? 'Bullish' : isMarketDown ? 'Bearish' : 'Stable'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}