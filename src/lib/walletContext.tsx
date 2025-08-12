'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  WalletData, 
  TokenInfo, 
  NetworkConfig,
  getStoredWalletAddresses, 
  getCustomTokens, 
  initializeDefaultTokens,
  getCurrentNetwork,
  setCurrentNetwork,
  initializeNetwork,
  NETWORKS
} from './walletManager';

interface WalletContextType {
  currentWallet: WalletData | null;
  setCurrentWallet: (wallet: WalletData | null) => void;
  storedAddresses: string[];
  customTokens: TokenInfo[];
  refreshStoredData: () => void;
  isWalletUnlocked: boolean;
  setIsWalletUnlocked: (unlocked: boolean) => void;
  currentNetwork: string;
  setCurrentNetwork: (network: string) => void;
  currentNetworkConfig: NetworkConfig;
  availableNetworks: Record<string, NetworkConfig>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [currentWallet, setCurrentWallet] = useState<WalletData | null>(null);
  const [storedAddresses, setStoredAddresses] = useState<string[]>([]);
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [isWalletUnlocked, setIsWalletUnlocked] = useState(false);
  const [currentNetwork, setCurrentNetworkState] = useState<string>('base-sepolia');
  const [currentNetworkConfig, setCurrentNetworkConfig] = useState<NetworkConfig>(NETWORKS['base-sepolia']);

  const refreshStoredData = () => {
    setStoredAddresses(getStoredWalletAddresses());
    setCustomTokens(getCustomTokens());
  };

  const handleNetworkChange = (network: string) => {
    if (NETWORKS[network]) {
      setCurrentNetwork(network);
      setCurrentNetworkState(network);
      setCurrentNetworkConfig(NETWORKS[network]);
      // Refresh tokens for the new network
      refreshStoredData();
    }
  };

  useEffect(() => {
    // Initialize network and default tokens on first load
    initializeNetwork();
    const network = getCurrentNetwork();
    setCurrentNetworkState(network);
    setCurrentNetworkConfig(NETWORKS[network]);
    initializeDefaultTokens();
    refreshStoredData();
  }, []);

  const value = {
    currentWallet,
    setCurrentWallet,
    storedAddresses,
    customTokens,
    refreshStoredData,
    isWalletUnlocked,
    setIsWalletUnlocked,
    currentNetwork,
    setCurrentNetwork: handleNetworkChange,
    currentNetworkConfig,
    availableNetworks: NETWORKS,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
