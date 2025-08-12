'use client';

import React, { useState } from 'react';
import { useWallet } from '../lib/walletContext';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export default function NetworkSwitcher() {
  const { currentNetwork, setCurrentNetwork, currentNetworkConfig, availableNetworks } = useWallet();
  const [isOpen, setIsOpen] = useState(false);

  const handleNetworkSelect = (networkKey: string) => {
    setCurrentNetwork(networkKey);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Network Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
      >
        <span className="text-lg">{currentNetworkConfig.icon}</span>
        <span className="font-semibold">{currentNetworkConfig.name}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-2">
            <div className="text-sm font-medium text-gray-500 px-3 py-2">Select Network</div>
            {Object.entries(availableNetworks).map(([key, network]) => (
              <button
                key={key}
                onClick={() => handleNetworkSelect(key)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 hover:bg-gray-50 ${
                  currentNetwork === key ? 'bg-blue-50 border border-blue-200' : ''
                }`}
              >
                <span className="text-xl">{network.icon}</span>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">{network.name}</div>
                  <div className="text-xs text-gray-500">Chain ID: {network.chainId}</div>
                </div>
                {currentNetwork === key && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
