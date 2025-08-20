'use client';

import React from 'react';
import { useTokenData } from '@/hooks/useTokenData';
import { useWallet } from '@/lib/walletContext';
import SafeImage from './SafeImage';
import TokenContextMenu from './TokenContextMenu';
import { Tooltip } from '@/components/ui/Tooltip';
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/useToast';

interface TokenListProps {
  className?: string;
  onSendToken?: (token: {
    symbol: string;
    name: string;
    address: string;
    balance: string;
    usdValue: number;
    decimals: number;
  }) => void;
}

export default function TokenList({ className = '', onSendToken }: TokenListProps) {
  const { toast } = useToast();
  const { refreshBalances } = useWallet();
  const { 
    tokenData, 
    isLoading, 
    lastUpdate, 
    fetchAllTokenData,
    formatPrice,
    formatPercentageChange,
    formatMarketCap,
    formatVolume,
  } = useTokenData();

  const handleRefresh = async () => {
    try {
      await Promise.all([
        fetchAllTokenData(),
        refreshBalances()
      ]);
      toast({
        variant: 'success',
        title: 'Data Refreshed',
        description: 'Token prices and balances updated successfully!',
      });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Refresh Failed',
        description: 'Failed to refresh data. Please try again.',
      });
    }
  };

  const handleSendToken = (token: {
    symbol: string;
    name: string;
    address: string;
    balance: string;
    usdValue: number;
    decimals: number;
  }) => {
    console.log('Send token:', token);
    if (onSendToken) {
      onSendToken(token);
    } else {
      toast({
        variant: 'info',
        title: 'Send Token',
        description: `Preparing to send ${token.symbol}`,
      });
    }
  };

  const handleRemoveToken = (address: string) => {
    console.log('Remove token:', address);
    toast({
      variant: 'success',
      title: 'Token Removed',
      description: 'Token has been removed from tracking',
    });
  };

  // Show all tokens (with or without price data)
  const tokens = Object.values(tokenData);

  const sortedTokens = tokens.sort((a, b) => {
    // Sort by balance USD value first, then by balance amount, then by price
    const aBalanceUSD = a.balanceUSD || 0;
    const bBalanceUSD = b.balanceUSD || 0;
    
    if (aBalanceUSD !== bBalanceUSD) {
      return bBalanceUSD - aBalanceUSD;
    }
    
    const aBalance = parseFloat(a.balance || '0');
    const bBalance = parseFloat(b.balance || '0');
    
    if (aBalance !== bBalance) {
      return bBalance - aBalance;
    }
    
    const aPrice = a.price || 0;
    const bPrice = b.price || 0;
    return bPrice - aPrice;
  });

  if (isLoading && tokens.length === 0) {
    return (
      <div className={`jupiter-card h-96 ${className}`}>
        <div className="jupiter-card-content overflow-y-auto overflow-x-hidden h-full">
          <div className="flex items-center justify-center py-8 h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/20"></div>
            <span className="ml-3 text-white/60">Loading tokens...</span>
          </div>
        </div>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className={`jupiter-card h-96 ${className}`}>
        <div className="jupiter-card-content overflow-y-auto overflow-x-hidden h-full">
          <div className="text-center py-8 h-full">
            <CurrencyDollarIcon className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white/80 mb-2">No Token Data</h3>
            <p className="text-white/60 mb-4">
              No token price data available. Add tokens to your wallet to see real-time prices.
            </p>
            <button
              onClick={handleRefresh}
              className="jupiter-button-primary"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`jupiter-card h-96 ${className}`}>
      <div className="jupiter-card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CurrencyDollarIcon className="h-5 w-5 text-white/60" />
            <h3 className="jupiter-card-title">Tokens</h3>
            {lastUpdate && (
              <div className="flex items-center text-xs text-white/40">
                <ClockIcon className="h-3 w-3 mr-1" />
                {new Date(lastUpdate).toLocaleTimeString()}
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="jupiter-button-secondary text-sm"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="jupiter-card-content overflow-y-auto overflow-x-hidden h-full">
        {/* Scrollable Content - Whole widget scrolls */}
        <div className="space-y-3 w-full pt-2">
          {/* Total Portfolio Value Section - Now a card */}
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 w-full">
            <div className="flex items-center space-x-2">
              <CurrencyDollarIcon className="h-4 w-4 text-white/60" />
              <span className="text-sm text-white/60">Portfolio Summary</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-green-400">
                {formatPrice(sortedTokens.reduce((total, token) => total + (token.balanceUSD || 0), 0))}
              </div>
              <div className="text-xs text-white/40 mt-1">
                {sortedTokens.filter(t => t.price !== undefined).length} / {sortedTokens.length} tokens
              </div>
            </div>
          </div>

          {/* Token List */}
          <div className="space-y-2 w-full">
            {sortedTokens.map((token) => {
              const hasPriceData = token.price !== undefined;
              const isPositive = token.priceChangePercentage24h && token.priceChangePercentage24h > 0;
              const isNegative = token.priceChangePercentage24h && token.priceChangePercentage24h < 0;

              return (
                <TokenContextMenu
                  key={token.address}
                  token={{
                    symbol: token.symbol,
                    name: token.name,
                    address: token.address,
                    balance: token.balance || '0.000000',
                    usdValue: token.balanceUSD || 0,
                    decimals: token.decimals || 18
                  }}
                  onDelete={handleRemoveToken}
                  onSend={handleSendToken}
                  className="w-full"
                >
                  {hasPriceData ? (
                    <Tooltip
                      content={
                        <div className="space-y-2 min-w-48 max-w-64">
                          {token.balance && (
                            <div className="flex justify-between">
                              <span className="text-white/60">Balance:</span>
                              <span>{parseFloat(token.balance).toFixed(6)} {token.symbol}</span>
                            </div>
                          )}
                          {token.balanceUSD && token.balanceUSD > 0 && (
                            <div className="flex justify-between">
                              <span className="text-white/60">Balance USD:</span>
                              <span className="text-green-400">{formatPrice(token.balanceUSD)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-white/60">Price:</span>
                            <span>{formatPrice(token.price)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">24h Change:</span>
                            <span className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-white/60'}>
                              {formatPercentageChange(token.priceChangePercentage24h)}
                            </span>
                          </div>
                          {token.marketCap && (
                            <div className="flex justify-between">
                              <span className="text-white/60">Market Cap:</span>
                              <span>{formatMarketCap(token.marketCap)}</span>
                            </div>
                          )}
                          {token.volume24h && (
                            <div className="flex justify-between">
                              <span className="text-white/60">24h Volume:</span>
                              <span>{formatVolume(token.volume24h)}</span>
                            </div>
                          )}
                          {token.lastUpdated && (
                            <div className="flex justify-between">
                              <span className="text-white/60">Updated:</span>
                              <span>{new Date(token.lastUpdated).toLocaleTimeString()}</span>
                            </div>
                          )}
                        </div>
                      }
                      side="right"
                      align="center"
                      className="bg-black/95 text-white text-xs rounded-lg shadow-xl border border-white/20 min-w-48 max-w-64"
                    >
                      <div className="group relative flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-transparent hover:border-white/10 w-full">
                        {/* Token Info */}
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <div className="relative">
                            <SafeImage
                              src={token.imageUrl}
                              alt={token.symbol}
                              width={32}
                              height={32}
                              className="rounded-full"
                              fallbackText={token.symbol.substring(0, 3).toUpperCase()}
                            />
                            {token.isLoading && (
                              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold text-white truncate">
                                {token.symbol}
                              </h4>
                              {hasPriceData && (
                                <div className="flex items-center space-x-1">
                                  {isPositive && (
                                    <ArrowTrendingUpIcon className="h-3 w-3 text-green-400" />
                                  )}
                                  {isNegative && (
                                    <ArrowTrendingDownIcon className="h-3 w-3 text-red-400" />
                                  )}
                                  <span className={`text-xs ${
                                    isPositive ? 'text-green-400' : 
                                    isNegative ? 'text-red-400' : 'text-white/60'
                                  }`}>
                                    {formatPercentageChange(token.priceChangePercentage24h)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-white/60 truncate">
                              {token.name}
                            </p>
                          </div>
                        </div>

                        {/* Balance and Price Information */}
                        <div className="flex flex-col items-end space-y-0.5">
                          {/* Balance */}
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">
                              {token.balance ? parseFloat(token.balance).toFixed(4) : '0.0000'} {token.symbol}
                            </div>
                            {token.balanceUSD && token.balanceUSD > 0 && (
                              <div className="text-xs text-green-400">
                                {formatPrice(token.balanceUSD)}
                              </div>
                            )}
                          </div>
                          
                          {/* Price per token */}
                          {hasPriceData && (
                            <div className="text-right">
                              <div className="text-xs text-white/60">
                                {formatPrice(token.price)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Tooltip>
                  ) : (
                    <div className="group relative flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-transparent hover:border-white/10 w-full">
                      {/* Token Info */}
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="relative">
                          <SafeImage
                            src={token.imageUrl}
                            alt={token.symbol}
                            width={32}
                            height={32}
                            className="rounded-full"
                            fallbackText={token.symbol.substring(0, 3).toUpperCase()}
                          />
                          {token.isLoading && (
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-semibold text-white truncate">
                              {token.symbol}
                            </h4>
                          </div>
                          <p className="text-sm text-white/60 truncate">
                            {token.name}
                          </p>
                        </div>
                      </div>

                      {/* Balance Information */}
                      <div className="flex flex-col items-end space-y-0.5">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white">
                            {token.balance ? parseFloat(token.balance).toFixed(4) : '0.0000'} {token.symbol}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </TokenContextMenu>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
