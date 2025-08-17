'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { 
  WalletData, 
  TokenInfo, 
  NFTInfo,
  NetworkConfig,
  getStoredWalletAddresses, 
  getCustomTokens, 
  getCustomNFTs,
  addCustomNFT,
  removeCustomNFT,
  initializeDefaultTokens,
  migrateStoredTokens,
  getCurrentNetwork,
  setCurrentNetwork,
  initializeNetwork,
  NETWORKS,
  getAllAccountsFromMnemonic
} from './walletManager';

interface WalletContextType {
  currentWallet: WalletData | null;
  setCurrentWallet: (wallet: WalletData | null) => void;
  storedAddresses: string[];
  customTokens: TokenInfo[];
  customNFTs: NFTInfo[];
  refreshStoredData: () => void;
  isWalletUnlocked: boolean;
  setIsWalletUnlocked: (unlocked: boolean) => void;
  currentNetwork: string;
  setCurrentNetwork: (network: string) => void;
  currentNetworkConfig: NetworkConfig;
  availableNetworks: Record<string, NetworkConfig>;
  // New account management features
  allAccounts: WalletData[];
  currentAccountIndex: number;
  switchAccount: (accountIndex: number) => void;
  addAccount: () => void;
  refreshBalances: () => void;
  isRefreshingBalances: boolean;
  // Account names functionality
  getAccountName: (address: string) => string;
  setAccountName: (address: string, name: string) => void;
  getCurrentAccountName: () => string;
  // NFT management functionality
  addNFT: (nftInfo: NFTInfo) => void;
  removeNFT: (address: string, tokenId: string) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [currentWallet, setCurrentWallet] = useState<WalletData | null>(null);
  const [storedAddresses, setStoredAddresses] = useState<string[]>([]);
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [customNFTs, setCustomNFTs] = useState<NFTInfo[]>([]);
  const [isWalletUnlocked, setIsWalletUnlocked] = useState(false);
  const [currentNetwork, setCurrentNetworkState] = useState<string>('base-sepolia');
  const [currentNetworkConfig, setCurrentNetworkConfig] = useState<NetworkConfig>(NETWORKS['base-sepolia']);
  
  // New account management state
  const [allAccounts, setAllAccounts] = useState<WalletData[]>([]);
  const [currentAccountIndex, setCurrentAccountIndex] = useState<number>(0);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});

  // Account names functionality
  const getAccountName = useCallback((address: string): string => {
    return accountNames[address] || `Account ${allAccounts.findIndex(acc => acc.address === address) + 1}`;
  }, [accountNames, allAccounts]);

  const setAccountName = useCallback((address: string, name: string) => {
    const newAccountNames = { ...accountNames, [address]: name };
    setAccountNames(newAccountNames);
    
    // Store in localStorage
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('accountNames', JSON.stringify(newAccountNames));
    }
  }, [accountNames]);

  const getCurrentAccountName = useCallback((): string => {
    if (!currentWallet?.address) return 'Wallet';
    return getAccountName(currentWallet.address);
  }, [currentWallet?.address, getAccountName]);

  const refreshStoredData = useCallback(() => {
    setStoredAddresses(getStoredWalletAddresses());
    setCustomTokens(getCustomTokens());
    setCustomNFTs(getCustomNFTs());
  }, []);

  // Function to refresh balances (will be called by components)
  const refreshBalances = useCallback(() => {
    setIsRefreshingBalances(true);
    // This will trigger a re-render in components that depend on balances
    setTimeout(() => setIsRefreshingBalances(false), 1000);
  }, []);

  const handleNetworkChange = useCallback((network: string) => {
    if (NETWORKS[network]) {
      setCurrentNetworkState(network);
      setCurrentNetworkConfig(NETWORKS[network]);
      // Refresh tokens for the new network
      refreshStoredData();
      // Trigger balance refresh for the new network
      refreshBalances();
    }
  }, [refreshStoredData, refreshBalances]);

  // Function to switch between accounts
  const switchAccount = useCallback((accountIndex: number) => {
    if (allAccounts[accountIndex]) {
      setCurrentWallet(allAccounts[accountIndex]);
      setCurrentAccountIndex(accountIndex);
      // Store the current account index in localStorage
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('currentAccountIndex', accountIndex.toString());
      }
      // Note: Toast notification will be handled in the AccountManager component
    }
  }, [allAccounts]);

  // Function to add a new account
  const addAccount = useCallback(() => {
    if (currentWallet?.mnemonic) {
      const newAccountIndex = allAccounts.length;
      try {
        const newAccount = getAllAccountsFromMnemonic(currentWallet.mnemonic, newAccountIndex + 1)[newAccountIndex];
        if (newAccount) {
          setAllAccounts(prev => [...prev, newAccount]);
          // Switch to the new account
          switchAccount(newAccountIndex);
        }
      } catch (error) {
        console.error('Error adding new account:', error);
      }
    }
  }, [currentWallet?.mnemonic, allAccounts.length, switchAccount]);

  // NFT management functions
  const addNFT = useCallback((nftInfo: NFTInfo) => {
    addCustomNFT(nftInfo);
    refreshStoredData();
  }, [refreshStoredData]);

  const removeNFT = useCallback((address: string, tokenId: string) => {
    removeCustomNFT(address, tokenId);
    refreshStoredData();
  }, [refreshStoredData]);

  // Load all accounts from mnemonic when wallet is unlocked
  useEffect(() => {
    if (currentWallet?.mnemonic && isWalletUnlocked) {
      try {
        const accounts = getAllAccountsFromMnemonic(currentWallet.mnemonic, 10);
        setAllAccounts(accounts);
        
        // Restore current account index from localStorage
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          const storedIndex = localStorage.getItem('currentAccountIndex');
          const index = storedIndex ? parseInt(storedIndex) : 0;
          if (accounts[index]) {
            setCurrentAccountIndex(index);
            setCurrentWallet(accounts[index]);
          }
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    }
  }, [currentWallet?.mnemonic, isWalletUnlocked]);

  useEffect(() => {
    // Initialize network and default tokens on first load
    initializeNetwork();
    const network = getCurrentNetwork();
    setCurrentNetworkState(network);
    setCurrentNetworkConfig(NETWORKS[network]);
    initializeDefaultTokens();
    migrateStoredTokens(); // Migrate any stored tokens with old URLs
    refreshStoredData();
    
    // Load account names from localStorage
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const storedAccountNames = localStorage.getItem('accountNames');
      if (storedAccountNames) {
        try {
          setAccountNames(JSON.parse(storedAccountNames));
        } catch (error) {
          console.error('Error parsing stored account names:', error);
        }
      }
    }
  }, []);

  const value = useMemo(() => ({
    currentWallet,
    setCurrentWallet,
    storedAddresses,
    customTokens,
    customNFTs,
    refreshStoredData,
    isWalletUnlocked,
    setIsWalletUnlocked,
    currentNetwork,
    setCurrentNetwork: handleNetworkChange,
    currentNetworkConfig,
    availableNetworks: NETWORKS,
    // New account management features
    allAccounts,
    currentAccountIndex,
    switchAccount,
    addAccount,
    refreshBalances,
    isRefreshingBalances,
    // Account names functionality
    getAccountName,
    setAccountName,
    getCurrentAccountName,
    // NFT management functionality
    addNFT,
    removeNFT,
  }), [
    currentWallet,
    storedAddresses,
    customTokens,
    customNFTs,
    refreshStoredData,
    isWalletUnlocked,
    currentNetwork,
    handleNetworkChange,
    currentNetworkConfig,
    allAccounts,
    currentAccountIndex,
    switchAccount,
    addAccount,
    refreshBalances,
    isRefreshingBalances,
    getAccountName,
    setAccountName,
    getCurrentAccountName,
    addNFT,
    removeNFT,
  ]);

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
