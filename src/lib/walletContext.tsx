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
  scanAllOwnedNFTs,
  initializeDefaultTokens,
  clearNetworkTokens,
  clearNetworkNFTs,
  migrateStoredTokens,
  migrateNFTStorage,
  getCurrentNetwork,
  setCurrentNetwork,
  initializeNetwork,
  NETWORKS,
  getAllAccountsFromMnemonic
} from './walletManager';
import { blockchainEventService, TransactionEvent, BalanceUpdateEvent } from './blockchainEvents';
// import { transactionMonitor } from './transactionMonitor';
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
  refreshNFTs: () => Promise<void>;
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



  const handleBalanceUpdateEvent = useCallback((_event: BalanceUpdateEvent) => {
    // Don't refresh balances here - let the balance monitor handle it
    // The balance monitor will detect actual balance changes and trigger refresh
  }, []);

  // Smart balance polling after transaction events
  const pollBalanceUntilChanged = useCallback(async (
    tokenAddress?: string,
    expectedOldBalance?: string,
    maxAttempts: number = 10
  ) => {
    if (!currentWallet?.address) return;
    
    let attempts = 0;
    const pollInterval = 500; // 0.5 seconds for faster detection
    
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
     
     // Start with 0.5 second delay to let blockchain settle
     setTimeout(poll, pollInterval);
  }, [currentWallet?.address, currentNetwork, refreshBalances]);

  // Poll until balance is stable (for received tokens or ETH)
  const pollBalanceUntilStable = useCallback(async (
    tokenAddress: string,
    expectedBalance: string,
    maxAttempts: number = 6
  ) => {
    if (!currentWallet?.address) return;
    
    let attempts = 0;
    const pollInterval = 500; // 0.5 seconds for faster detection
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
     
     // Start with 0.5 second delay to let blockchain settle
     setTimeout(poll, pollInterval);
  }, [currentWallet?.address, currentNetwork, refreshBalances]);

  const handleBalanceChangeEvent = useCallback((event: BalanceChangeEvent) => {
    // Show notification for received tokens and ETH
    if (event.type === 'TOKEN' && parseFloat(event.newBalance) > parseFloat(event.oldBalance)) {
      // Use a simple alert or console log instead of toast to avoid hook issues
      console.log(`🎉 Token Received! You received ${parseFloat(event.newBalance) - parseFloat(event.oldBalance)} ${event.tokenSymbol || 'tokens'}`);
      
      // We'll handle the toast notification in the TransactionNotification component
    } else if (event.type === 'ETH' && parseFloat(event.newBalance) > parseFloat(event.oldBalance)) {
      // Show notification for received ETH
      console.log(`🎉 ETH Received! You received ${parseFloat(event.newBalance) - parseFloat(event.oldBalance)} ETH`);
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
        // ETH was sent - trigger immediate refresh
        pollBalanceUntilChanged();
      } else {
        // ETH was received - trigger immediate refresh
        pollBalanceUntilChanged();
      }
    }
  }, [pollBalanceUntilChanged, pollBalanceUntilStable]);

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
    console.log(`Adding NFT: ${nftInfo.name} #${nftInfo.tokenId}`);
    
    // Check if NFT already exists to prevent duplicates
    const currentNFTs = getCustomNFTs();
    const existingNFT = currentNFTs.find(nft => 
      nft.address.toLowerCase() === nftInfo.address.toLowerCase() && 
      nft.tokenId === nftInfo.tokenId
    );
    
    if (existingNFT) {
      console.log(`NFT already exists: ${nftInfo.name} #${nftInfo.tokenId}`);
      return;
    }
    
    // Add to localStorage first
    addCustomNFT(nftInfo);
    
    // Update the state immediately
    const updatedNFTs = [...currentNFTs, nftInfo];
    setCustomNFTs(updatedNFTs);
    
    console.log(`NFT added. Total NFTs: ${updatedNFTs.length}`);
  }, [setCustomNFTs]);

  const removeNFT = useCallback((address: string, tokenId: string) => {
    console.log(`Removing NFT: ${address} #${tokenId}`);
    
    // Remove from localStorage first
    removeCustomNFT(address, tokenId);
    
    // Update the state immediately
    const currentNFTs = getCustomNFTs();
    const updatedNFTs = currentNFTs.filter(nft => 
      !(nft.address.toLowerCase() === address.toLowerCase() && nft.tokenId === tokenId)
    );
    setCustomNFTs(updatedNFTs);
    
    console.log(`NFT removed. Total NFTs remaining: ${updatedNFTs.length}`);
  }, [setCustomNFTs]);

  // NFT refresh function
  const refreshNFTs = useCallback(async () => {
    if (!currentWallet?.address) {
      console.log('No wallet address available for NFT refresh');
      return;
    }
    
    try {
      console.log('Starting NFT refresh...');
      console.log(`Wallet address: ${currentWallet.address}`);
      console.log(`Network: ${currentNetwork}`);
      
      // Use Alchemy API to scan for all NFTs
      console.log('Using Alchemy API to scan for NFTs...');
      const allOwnedNFTs = await scanAllOwnedNFTs(currentWallet.address, currentNetwork);
      
      console.log(`Alchemy scan found ${allOwnedNFTs.length} NFTs`);
      
      // Clear all existing NFTs for current network and add the new ones immediately
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(`customNFTs_${currentNetwork}`, JSON.stringify(allOwnedNFTs));
      }
      setCustomNFTs(allOwnedNFTs);
      console.log(`Total NFTs found for ${currentNetwork}: ${allOwnedNFTs.length}`);
    } catch (error) {
      console.error('Error refreshing NFTs:', error);
      throw error; // Re-throw to let the component handle it
    }
  }, [currentWallet?.address, currentNetwork, setCustomNFTs]);

  // Blockchain event handlers - moved after refreshNFTs to avoid dependency issues
  const handleTransactionEvent = useCallback((event: TransactionEvent) => {
    // Handle NFT transaction events specifically
    if (event.contractAddress) {
      // This is an NFT transaction
      console.log(`NFT transaction detected: ${event.type} ${event.tokenSymbol}`);
      
      // Trigger NFT refresh immediately for faster response
      if (event.contractAddress && currentWallet?.address) {
        console.log(`Triggering immediate NFT refresh for ${event.type} transaction`);
        // Single immediate refresh for better UX
        refreshNFTs();
      }
    }
    
    // Don't refresh balances here - let the balance monitor handle it
    // The balance monitor will detect actual balance changes and trigger refresh
  }, [refreshNFTs, currentWallet?.address]);

  // Network change handler - moved after refreshNFTs to avoid dependency issues
  const handleNetworkChange = useCallback((network: string) => {
    if (NETWORKS[network]) {
      console.log(`🔄 Switching to network: ${network}`);
      
      // First, clear the current NFT state to prevent "snap back"
      setCustomNFTs([]);
      
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
      // Refresh NFTs for the new network with longer delay to ensure network is fully switched
      setTimeout(() => {
        console.log(`🖼️ Refreshing NFTs after network switch to ${network}`);
        refreshNFTs();
      }, 300); // Reduced delay since we're now clearing state first
    }
  }, [refreshStoredData, refreshBalances, refreshNFTs]);

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
    migrateNFTStorage(); // Migrate NFTs to network-specific storage
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

    // Listen for blockchain event check events from SendTransaction component
    const handleBlockchainEventCheck = (event: CustomEvent) => {
      const { address, network, type } = event.detail;
      if (address && network) {
        if (type === 'NFT') {
          // Use enhanced NFT transfer detection
          blockchainEventService.checkForNFTTransfers(address);
        } else {
          blockchainEventService.triggerTransactionCheck(address);
        }
      }
    };

    // Listen for NFT refresh events from blockchain event service
    const handleNFTRefresh = (event: CustomEvent) => {
      const { address, contractAddress } = event.detail;
      if (address && address === currentWallet?.address) {
        console.log(`NFT refresh event triggered for contract: ${contractAddress}`);
        // Refresh all NFTs
        refreshNFTs();
      }
    };

    window.addEventListener('triggerBalancePolling', handleBalancePollingEvent as EventListener);
    window.addEventListener('triggerBlockchainEventCheck', handleBlockchainEventCheck as EventListener);
    window.addEventListener('triggerNFTRefresh', handleNFTRefresh as EventListener);

    return () => {
      blockchainEventService.unsubscribeFromTransactions(handleTransactionEvent);
      blockchainEventService.unsubscribeFromBalanceUpdates(handleBalanceUpdateEvent);
      balanceMonitor.unsubscribe(handleBalanceChangeEvent);
      window.removeEventListener('triggerBalancePolling', handleBalancePollingEvent as EventListener);
      window.removeEventListener('triggerBlockchainEventCheck', handleBlockchainEventCheck as EventListener);
      window.removeEventListener('triggerNFTRefresh', handleNFTRefresh as EventListener);
    };
  }, [handleTransactionEvent, handleBalanceUpdateEvent, handleBalanceChangeEvent, pollBalanceUntilChanged, refreshNFTs]);

      // Start listening for blockchain events when wallet is loaded
  useEffect(() => {
    if (currentWallet?.address && currentNetworkConfig.rpcUrl && isWalletUnlocked) {
             blockchainEventService.startListening(
        currentWallet.address,
        currentNetwork,
        '/api/rpc-proxy'
      );
      
             // Transaction monitoring is handled by blockchainEventService
      // transactionMonitor.startMonitoring(
      //   currentWallet.address,
      //   currentNetwork,
      //   '/api/rpc-proxy'
      // );

        // Start balance monitoring with current tokens
        const tokenAddresses = customTokens.map(token => token.address);
        balanceMonitor.startMonitoring(
          currentWallet.address,
          currentNetwork,
          '/api/rpc-proxy',
          tokenAddresses
        );

        // Set up periodic NFT detection check every 30 seconds
        const nftDetectionInterval = setInterval(() => {
          if (currentWallet?.address) {
            console.log(`🖼️ Periodic NFT detection check for ${currentWallet.address}`);
            blockchainEventService.triggerNFTDetection(currentWallet.address);
          }
        }, 30000); // Check every 30 seconds

        return () => {
          clearInterval(nftDetectionInterval);
        };
     } else {
       blockchainEventService.stopListening();
       // transactionMonitor.stopMonitoring();
       balanceMonitor.stopMonitoring();
     }

     return () => {
       blockchainEventService.stopListening();
       // transactionMonitor.stopMonitoring();
       balanceMonitor.stopMonitoring();
     };
      }, [currentWallet?.address, currentNetwork, isWalletUnlocked, customTokens, currentNetworkConfig.rpcUrl]);

  // Trigger NFT refresh when network changes
  useEffect(() => {
    if (currentWallet?.address && isWalletUnlocked) {
      console.log(`🖼️ Network changed to ${currentNetwork}, loading NFTs for this network`);
      // Load NFTs for the current network immediately from localStorage
      const networkNFTs = getCustomNFTs();
      setCustomNFTs(networkNFTs);
      console.log(`📦 Loaded ${networkNFTs.length} NFTs from localStorage for ${currentNetwork}`);
      
      // Then trigger a fresh scan to ensure we have the latest NFTs
      const timeoutId = setTimeout(() => {
        console.log(`🔄 Triggering fresh NFT scan for ${currentNetwork}`);
        refreshNFTs();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentNetwork, currentWallet?.address, isWalletUnlocked, refreshNFTs]);

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
    refreshNFTs,
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
    refreshNFTs,
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
