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
    setTimeout(() => {
      setIsRefreshingBalances(false);
    }, 1000);
  }, []);

  // Blockchain event handlers
  const handleTransactionEvent = useCallback((_event: TransactionEvent) => {
    // Don't refresh balances here - let the balance monitor handle it
    // The balance monitor will detect actual balance changes and trigger refresh
  }, []);

  const handleBalanceUpdateEvent = useCallback((_event: BalanceUpdateEvent) => {
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
       
       try {
                          if (tokenAddress && expectedOldBalance) {
           // Check specific token balance using proxy
           const response = await fetch('/api/rpc-proxy', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               network: currentNetwork,
               method: 'eth_call',
               params: [{
                 to: tokenAddress,
                 data: '0x70a08231' + '000000000000000000000000' + currentWallet.address.slice(2)
               }, 'latest']
             })
           });
           
           if (!response.ok) {
             throw new Error(`RPC request failed: ${response.statusText}`);
           }
           
           const data = await response.json();
           if (data.error || !data.result) {
             throw new Error('Failed to get token balance');
           }
           
                      const balanceWei = BigInt(data.result);
           const currentBalance = ethers.formatUnits(balanceWei, 18);
           
           if (currentBalance !== expectedOldBalance) {
             refreshBalances();
             return true; // Balance changed
           }
                 } else {
           // Check ETH balance using proxy
           const response = await fetch('/api/rpc-proxy', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               network: currentNetwork,
               method: 'eth_getBalance',
               params: [currentWallet.address, 'latest']
             })
           });
           
           if (!response.ok) {
             throw new Error(`RPC request failed: ${response.statusText}`);
           }
           
           const data = await response.json();
           if (data.error || !data.result) {
             throw new Error('Failed to get ETH balance');
           }
           
           // For ETH, we don't have an expected old balance, so just refresh after first check
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
         return;
       }
       
       if (attempts >= maxAttempts) {
         refreshBalances();
         return;
       }
      
      // Continue polling
      setTimeout(poll, pollInterval);
    };
    
    // Start with 1 second delay to let blockchain settle
    setTimeout(poll, pollInterval);
  }, [currentWallet?.address, currentNetwork, refreshBalances]);

  // Poll until balance is stable (for received tokens or ETH)
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
    const isETH = tokenAddress === '0x0000000000000000000000000000000000000000';
    
         const checkBalance = async (): Promise<boolean> => {
       attempts++;
       
       try {
        let currentBalance: string;
        
        if (isETH) {
          // Check ETH balance using proxy
          const response = await fetch('/api/rpc-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              network: currentNetwork,
              method: 'eth_getBalance',
              params: [currentWallet.address, 'latest']
            })
          });
          
          if (!response.ok) {
            throw new Error(`RPC request failed: ${response.statusText}`);
          }
          
          const data = await response.json();
          if (data.error || !data.result) {
            throw new Error('Failed to get ETH balance');
          }
          
          const balanceWei = BigInt(data.result);
          currentBalance = ethers.formatEther(balanceWei);
        } else {
          // Check token balance using proxy
          const response = await fetch('/api/rpc-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              network: currentNetwork,
              method: 'eth_call',
              params: [{
                to: tokenAddress,
                data: '0x70a08231' + '000000000000000000000000' + currentWallet.address.slice(2)
              }, 'latest']
            })
          });
          
          if (!response.ok) {
            throw new Error(`RPC request failed: ${response.statusText}`);
          }
          
          const data = await response.json();
          if (data.error || !data.result) {
            throw new Error('Failed to get token balance');
          }
          
          const balanceWei = BigInt(data.result);
          currentBalance = ethers.formatUnits(balanceWei, 18);
        }
        
                 if (currentBalance === lastBalance) {
           stableCount++;
           
           if (stableCount >= requiredStableChecks) {
             refreshBalances();
             return true; // Balance is stable
           }
         } else {
           // Balance changed, reset stability counter
           stableCount = 0;
           lastBalance = currentBalance;
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
         return;
       }
       
       if (attempts >= maxAttempts) {
         refreshBalances();
         return;
       }
      
      // Continue polling
      setTimeout(poll, pollInterval);
    };
    
    // Start with 1 second delay to let blockchain settle
    setTimeout(poll, pollInterval);
  }, [currentWallet?.address, currentNetwork, refreshBalances]);

  const handleBalanceChangeEvent = useCallback((event: BalanceChangeEvent) => {
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
      // For ETH, check if it's a decrease (sending) or increase (receiving)
      const oldBalance = parseFloat(event.oldBalance);
      const newBalance = parseFloat(event.newBalance);
      
             if (newBalance < oldBalance) {
         // ETH was sent - poll until balance stabilizes
         pollBalanceUntilStable('0x0000000000000000000000000000000000000000', event.newBalance);
       } else {
         // ETH was received - just refresh
         pollBalanceUntilChanged();
       }
    }
  }, [pollBalanceUntilChanged, pollBalanceUntilStable]);

  const handleNetworkChange = useCallback((network: string) => {
    if (NETWORKS[network]) {
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
  }, [handleTransactionEvent, handleBalanceUpdateEvent, handleBalanceChangeEvent, pollBalanceUntilChanged]);

  // Start listening for blockchain events when wallet is loaded
  useEffect(() => {
    if (currentWallet?.address && currentNetworkConfig.rpcUrl && isWalletUnlocked) {
             blockchainEventService.startListening(
         currentWallet.address,
         currentNetwork,
         '/api/rpc-proxy'
       );
       
       // Also start transaction monitoring
       transactionMonitor.startMonitoring(
         currentWallet.address,
         currentNetwork,
         '/api/rpc-proxy'
       );

       // Start balance monitoring with current tokens
       const tokenAddresses = customTokens.map(token => token.address);
       balanceMonitor.startMonitoring(
         currentWallet.address,
         currentNetwork,
         '/api/rpc-proxy',
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
     }, [currentWallet?.address, currentNetwork, isWalletUnlocked, customTokens, currentNetworkConfig.rpcUrl]);

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
