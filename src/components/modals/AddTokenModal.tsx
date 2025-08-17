'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter, Button } from '@/components/ui';
import SafeImage from '@/components/SafeImage';

interface TokenSuggestion {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

interface AddTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (tokenData: {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
  }) => void;
  tokenSuggestions: TokenSuggestion[];
  loading?: boolean;
}

export default function AddTokenModal({
  open,
  onOpenChange,
  onAdd,
  tokenSuggestions,
  loading = false
}: AddTokenModalProps) {
  const [tokenForm, setTokenForm] = useState({
    symbol: '',
    name: '',
    address: '',
    decimals: 18
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-fill fields when contract address matches a known token
  useEffect(() => {
    if (tokenForm.address) {
      const normalizedAddress = tokenForm.address.toLowerCase().trim();
      const knownToken = tokenSuggestions.find(token => 
        token.address.toLowerCase() === normalizedAddress
      );
      
      if (knownToken) {
        setTokenForm(prev => ({
          ...prev,
          symbol: knownToken.symbol,
          name: knownToken.name,
          decimals: knownToken.decimals
        }));
      }
    }
  }, [tokenForm.address, tokenSuggestions]);

  const handleInputChange = (field: keyof typeof tokenForm, value: string) => {
    setTokenForm(prev => ({ ...prev, [field]: value }));
    
    // Update search query for suggestions
    if (field === 'symbol' || field === 'name') {
      setSearchQuery(value);
      setShowSuggestions(value.length > 0);
    } else if (field === 'address') {
      setSearchQuery(value);
      setShowSuggestions(value.length > 0);
    }
  };

  const handleSuggestionClick = (token: TokenSuggestion) => {
    setTokenForm({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      decimals: token.decimals
    });
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleAdd = () => {
    const trimmedForm = {
      symbol: tokenForm.symbol.trim(),
      name: tokenForm.name.trim(),
      address: tokenForm.address.trim(),
      decimals: tokenForm.decimals
    };
    
    if (!trimmedForm.symbol || !trimmedForm.name || !trimmedForm.address) {
      return;
    }
    
    onAdd(trimmedForm);
  };

  const handleClose = () => {
    setTokenForm({ symbol: '', name: '', address: '', decimals: 18 });
    setSearchQuery('');
    setShowSuggestions(false);
    onOpenChange(false);
  };

  // Enhanced filtering - search by symbol, name, or address
  const filteredSuggestions = tokenSuggestions.filter(token => {
    const query = searchQuery.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    );
  }).slice(0, 8); // Limit to 8 suggestions for better UX

  // Check if current address matches a known token
  const isKnownToken = tokenSuggestions.some(token => 
    token.address.toLowerCase() === tokenForm.address.toLowerCase().trim()
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Custom Token"
      size="md"
    >
      <ModalBody>
        <div className="space-y-6">
          {/* Search/Select Known Token */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-3">
              Search Known Tokens
            </label>
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(e.target.value.length > 0);
                }}
                placeholder="Search by symbol, name, or contract address..."
                className="jupiter-input"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-2 token-suggestions-dropdown max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((token, index) => (
                    <div
                      key={`${token.address}-${index}`}
                      onClick={() => handleSuggestionClick(token)}
                      className="px-4 py-3 cursor-pointer text-sm text-white border-b border-white/10 last:border-b-0 flex items-center token-suggestion-item"
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center mr-3 overflow-hidden bg-gray-700">
                        {token.logoURI ? (
                          <SafeImage 
                            src={token.logoURI} 
                            alt={token.symbol}
                            width={32}
                            height={32}
                            className="h-8 w-8 object-cover rounded-full"
                            fallbackText={token.symbol}
                          />
                        ) : (
                          <div className="h-8 w-8 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{token.symbol}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{token.symbol}</div>
                        <div className="text-xs text-white/60 truncate">{token.name}</div>
                        <div className="text-xs text-white/40 font-mono truncate">
                          {token.address.slice(0, 6)}...{token.address.slice(-4)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Token Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-3">
                Token Symbol <span className="text-red-400">*</span>
              </label>
              <input
                value={tokenForm.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value)}
                placeholder="e.g., USDC"
                className="jupiter-input"
                disabled={isKnownToken}
              />
              {isKnownToken && (
                <div className="text-xs text-green-400 mt-1">✓ Known token detected</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-3">
                Token Name <span className="text-red-400">*</span>
              </label>
              <input
                value={tokenForm.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., USD Coin"
                className="jupiter-input"
                disabled={isKnownToken}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-3">
                Contract Address <span className="text-red-400">*</span>
              </label>
              <input
                value={tokenForm.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="0x..."
                className="jupiter-input font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-3">
                Decimals
              </label>
              <input
                type="number"
                value={tokenForm.decimals}
                onChange={(e) => handleInputChange('decimals', e.target.value)}
                className="jupiter-input"
                disabled={isKnownToken}
                min="0"
                max="18"
              />
            </div>
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <div className="flex gap-4 w-full">
          <Button
            onClick={handleAdd}
            loading={loading}
            disabled={!tokenForm.symbol.trim() || !tokenForm.name.trim() || !tokenForm.address.trim()}
            className="flex-1"
          >
            Add Token
          </Button>
          <Button
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
