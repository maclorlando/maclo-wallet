'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { 
  WalletData, 
  TokenInfo, 
  NFTInfo,
  NetworkConfig,
  getStoredWalletAddresses, 
  getCustomTokens, 
  getCustomNFTs,
  addCustomToken,
  removeCustomToken,
  addCustomNFT,
  removeCustomNFT,
  initializeDefaultTokens,
  clearNetworkTokens,
  migrateStoredTokens,
  getCurrentNetwork,
  setCurrentNetwork,
  initializeNetwork,
  NETWORKS,
  getAllAccountsFromMnemonic
} from './walletManager';
import { blockchainEventService, TransactionEvent, BalanceUpdateEvent } from './blockchainEvents';
import { transactionMonitor } from './transactionMonitor';
import { balanceMonitor, BalanceChangeEvent } from './balanceMonitor';

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
  // Token management functionality
  addToken: (tokenInfo: TokenInfo) => void;
  removeToken: (address: string) => void;
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
    // Also trigger a balance refresh to update token data in useTokenData hook
    setIsRefreshingBalances(true);
    setTimeout(() => setIsRefreshingBalances(false), 1000);
  }, []);

  // Function to refresh balances (will be called by components)
  const refreshBalances = useCallback(() => {
    setIsRefreshingBalances(true);
    // This will trigger a re-render in components that depend on balances
    setTimeout(() => setIsRefreshingBalances(false), 1000);
  }, []);

  // Blockchain event handlers
  const handleTransactionEvent = useCallback((event: TransactionEvent) => {
    console.log('Transaction event received:', event);
    
    // Don't refresh balances here - let the balance monitor handle it
    // The balance monitor will detect actual balance changes and trigger refresh
  }, []);

  const handleBalanceUpdateEvent = useCallback((event: BalanceUpdateEvent) => {
    console.log('Balance update event received:', event);
    
    // Don't refresh balances here - let the balance monitor handle it
    // The balance monitor will detect actual balance changes and trigger refresh
  }, []);

  // Smart balance polling after transaction events
  const pollBalanceUntilChanged = useCallback(async (
    tokenAddress?: string,
    expectedOldBalance?: string,
    maxAttempts: number = 20
  ) => {
    if (!currentWallet?.address) return;
    
    let attempts = 0;
    const pollInterval = 1000; // 1 second
    
    const checkBalance = async (): Promise<boolean> => {
      attempts++;
      console.log(`Checking balance (attempt ${attempts}/${maxAttempts})...`);
      
      try {
        if (tokenAddress && expectedOldBalance) {
          // Check specific token balance
          const provider = new ethers.JsonRpcProvider(currentNetworkConfig.rpcUrl);
          const contract = new ethers.Contract(
            tokenAddress,
            ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
            provider
          );
          
          const balance = await contract.balanceOf(currentWallet.address);
          let decimals = 18;
          try {
            decimals = await contract.decimals();
          } catch {
            // Use default decimals if call fails
          }
          
          const currentBalance = ethers.formatUnits(balance, decimals);
          console.log(`Token balance check: ${expectedOldBalance} -> ${currentBalance}`);
          
          if (currentBalance !== expectedOldBalance) {
            console.log('Token balance changed! Refreshing UI...');
            refreshBalances();
            return true; // Balance changed
          }
        } else {
          // Check ETH balance
          const provider = new ethers.JsonRpcProvider(currentNetworkConfig.rpcUrl);
          await provider.getBalance(currentWallet.address);
          
          // For ETH, we don't have an expected old balance, so just refresh after first check
          console.log('ETH balance check, refreshing UI...');
          refreshBalances();
          return true;
        }
        
        return false; // Balance hasn't changed yet
      } catch (error) {
        console.warn('Error checking balance:', error);
        return false;
      }
    };
    
    // Start polling
    const poll = async () => {
      const changed = await checkBalance();
      
      if (changed) {
        console.log('Balance polling completed successfully');
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.log('Balance polling timeout, refreshing anyway...');
        refreshBalances();
        return;
      }
      
      // Continue polling
      setTimeout(poll, pollInterval);
    };
    
    // Start with 1 second delay to let blockchain settle
    setTimeout(poll, pollInterval);
  }, [currentWallet?.address, currentNetworkConfig.rpcUrl, refreshBalances]);

  // Poll until balance is stable (for received tokens)
  const pollBalanceUntilStable = useCallback(async (
    tokenAddress: string,
    expectedBalance: string,
    maxAttempts: number = 10
  ) => {
    if (!currentWallet?.address) return;
    
    let attempts = 0;
    const pollInterval = 1000; // 1 second
    let lastBalance = expectedBalance;
    let stableCount = 0;
    const requiredStableChecks = 3; // Balance must be stable for 3 consecutive checks
    
    const checkBalance = async (): Promise<boolean> => {
      attempts++;
      console.log(`Checking balance stability (attempt ${attempts}/${maxAttempts})...`);
      
      try {
        const provider = new ethers.JsonRpcProvider(currentNetworkConfig.rpcUrl);
        const contract = new ethers.Contract(
          tokenAddress,
          ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
          provider
        );
        
        const balance = await contract.balanceOf(currentWallet.address);
        let decimals = 18;
        try {
          decimals = await contract.decimals();
        } catch {
          // Use default decimals if call fails
        }
        
        const currentBalance = ethers.formatUnits(balance, decimals);
        console.log(`Token balance stability check: ${lastBalance} -> ${currentBalance}`);
        
        if (currentBalance === lastBalance) {
          stableCount++;
          console.log(`Balance stable for ${stableCount}/${requiredStableChecks} checks`);
          
          if (stableCount >= requiredStableChecks) {
            console.log('Balance is stable! Refreshing UI...');
            refreshBalances();
            return true; // Balance is stable
          }
        } else {
          // Balance changed, reset stability counter
          stableCount = 0;
          lastBalance = currentBalance;
          console.log('Balance changed, resetting stability counter');
        }
        
        return false; // Balance not stable yet
      } catch (error) {
        console.warn('Error checking balance stability:', error);
        return false;
      }
    };
    
    // Start polling
    const poll = async () => {
      const stable = await checkBalance();
      
      if (stable) {
        console.log('Balance stability polling completed successfully');
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.log('Balance stability polling timeout, refreshing anyway...');
        refreshBalances();
        return;
      }
      
      // Continue polling
      setTimeout(poll, pollInterval);
    };
    
    // Start with 1 second delay to let blockchain settle
    setTimeout(poll, pollInterval);
  }, [currentWallet?.address, currentNetworkConfig.rpcUrl, refreshBalances]);

  const handleBalanceChangeEvent = useCallback((event: BalanceChangeEvent) => {
    console.log('Balance change detected:', event);
    
    // Show notification for received tokens
    if (event.type === 'TOKEN' && parseFloat(event.newBalance) > parseFloat(event.oldBalance)) {
      // Use a simple alert or console log instead of toast to avoid hook issues
      console.log(`🎉 Token Received! You received ${parseFloat(event.newBalance) - parseFloat(event.oldBalance)} ${event.tokenSymbol || 'tokens'}`);
      
      // We'll handle the toast notification in the TransactionNotification component
    }
    
    // For received tokens, we need to be more careful about when to refresh
    // The balance monitor might detect the change before the blockchain is fully settled
    if (event.type === 'TOKEN' && event.tokenAddress) {
      // For received tokens, we need to poll until the balance is stable (not changing anymore)
      // This ensures the blockchain state is fully settled
      pollBalanceUntilStable(event.tokenAddress, event.newBalance);
    } else if (event.type === 'ETH') {
      // For ETH, just poll without specific checks
      pollBalanceUntilChanged();
    }
  }, [pollBalanceUntilChanged, pollBalanceUntilStable]);

  const handleNetworkChange = useCallback((network: string) => {
    if (NETWORKS[network]) {
      console.log(`Switching to network: ${network}`);
      setCurrentNetworkState(network);
      setCurrentNetworkConfig(NETWORKS[network]);
      // Update the network in walletManager.ts to keep it synchronized
      setCurrentNetwork(network);
      // Clear tokens that don't belong to the new network
      clearNetworkTokens();
      // Initialize default tokens for the new network
      initializeDefaultTokens();
      // Refresh tokens for the new network
      refreshStoredData();
      // Trigger balance refresh for the new network
      refreshBalances();
      // Force a fresh balance fetch for the new network
      setTimeout(() => {
        console.log(`Forcing balance refresh for network: ${network}`);
        refreshBalances();
      }, 100);
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

  // Token management functions
  const addToken = useCallback((tokenInfo: TokenInfo) => {
    addCustomToken(tokenInfo);
    refreshStoredData();
  }, [refreshStoredData]);

  const removeToken = useCallback((address: string) => {
    removeCustomToken(address);
    refreshStoredData();
  }, [refreshStoredData]);

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
        // Initialize default tokens when wallet is unlocked (in case they weren't initialized before)
        initializeDefaultTokens();
        
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
        
        // Refresh stored data to pick up any newly initialized tokens
        refreshStoredData();
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    }
  }, [currentWallet?.mnemonic, isWalletUnlocked, refreshStoredData]);

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

  // Subscribe to blockchain events
  useEffect(() => {
    blockchainEventService.subscribeToTransactions(handleTransactionEvent);
    blockchainEventService.subscribeToBalanceUpdates(handleBalanceUpdateEvent);
    balanceMonitor.subscribe(handleBalanceChangeEvent);

    // Listen for custom balance polling events from SendTransaction component
    const handleBalancePollingEvent = (event: CustomEvent) => {
      const { tokenAddress, expectedOldBalance } = event.detail;
      console.log('Balance polling event received:', event.detail);
      
      if (tokenAddress && expectedOldBalance) {
        pollBalanceUntilChanged(tokenAddress, expectedOldBalance);
      } else {
        pollBalanceUntilChanged(); // For ETH or general polling
      }
    };

    window.addEventListener('triggerBalancePolling', handleBalancePollingEvent as EventListener);

    return () => {
      blockchainEventService.unsubscribeFromTransactions(handleTransactionEvent);
      blockchainEventService.unsubscribeFromBalanceUpdates(handleBalanceUpdateEvent);
      balanceMonitor.unsubscribe(handleBalanceChangeEvent);
      window.removeEventListener('triggerBalancePolling', handleBalancePollingEvent as EventListener);
    };
  }, [handleTransactionEvent, handleBalanceUpdateEvent, handleBalanceChangeEvent, pollBalanceUntilChanged, refreshStoredData]);

  // Start listening for blockchain events when wallet is loaded
  useEffect(() => {
    if (currentWallet?.address && currentNetworkConfig.rpcUrl && isWalletUnlocked) {
      blockchainEventService.startListening(
        currentWallet.address,
        currentNetwork,
        currentNetworkConfig.rpcUrl
      );
      
      // Also start transaction monitoring
      transactionMonitor.startMonitoring(
        currentWallet.address,
        currentNetwork,
        currentNetworkConfig.rpcUrl
      );

      // Start balance monitoring with current tokens
      const tokenAddresses = customTokens.map(token => token.address);
      balanceMonitor.startMonitoring(
        currentWallet.address,
        currentNetwork,
        currentNetworkConfig.rpcUrl,
        tokenAddresses
      );
    } else {
      blockchainEventService.stopListening();
      transactionMonitor.stopMonitoring();
      balanceMonitor.stopMonitoring();
    }

    return () => {
      blockchainEventService.stopListening();
      transactionMonitor.stopMonitoring();
      balanceMonitor.stopMonitoring();
    };
  }, [currentWallet?.address, currentNetwork, currentNetworkConfig.rpcUrl, isWalletUnlocked, customTokens]);

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
    // Token management functionality
    addToken,
    removeToken,
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
    addToken,
    removeToken,
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
