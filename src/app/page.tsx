'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from '@/lib/walletContext';

import { 
  generateNewWallet, 
  importWalletFromMnemonic, 
  encryptMnemonic, 
  storeEncryptedWallet, 
  addCustomToken, 
  removeCustomToken, 
  getEthBalance,
  TokenInfoWithImage,
  NFTInfo,
  recoverWallet,
  getTokenImage
} from '@/lib/walletManager';
import { requestManager } from '@/lib/requestManager';
import SendTransaction from '@/components/SendTransaction';
import NetworkSwitcher from '@/components/NetworkSwitcher';
import { 
  CreateWalletModal,
  ImportWalletModal,
  RecoverWalletModal,
  AddTokenModal,
  AddNFTModal,
  ViewMnemonicModal
} from '@/components/modals';
import AccountManager from '@/components/AccountManager';

import NFTCollections from '@/components/NFTCollections';
import TokenList from '@/components/TokenList';
import MarketOverview from '@/components/MarketOverview';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Copy } from 'lucide-react';
import { Label, ConfirmationModal, ContextMenu, ContextMenuItem } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import TransactionNotification from '@/components/TransactionNotification';
import { 
  Cog6ToothIcon,
  UserIcon,
  KeyIcon
} from '@heroicons/react/24/outline';

interface TokenBalance {
  symbol: string;
  name: string;
  address: string;
  balance: string;
  usdValue: number;
  decimals: number;
  imageUrl?: string;
}



interface NewWalletData {
  address: string;
  mnemonic: string;
  privateKey: string;
}

export default function Home() {
  const { toast } = useToast();
  const { 
    currentWallet, 
    setCurrentWallet, 
    storedAddresses, 
    customTokens, 
    addNFT,
    refreshStoredData,
    isWalletUnlocked,
    setIsWalletUnlocked,
    currentNetwork,
    currentNetworkConfig,
    isRefreshingBalances,
    getCurrentAccountName
  } = useWallet();

  const [showNewWallet, setShowNewWallet] = useState(false);
  const [showImportWallet, setShowImportWallet] = useState(false);
  const [showRecoverWallet, setShowRecoverWallet] = useState(false);
  const [showAddToken, setShowAddToken] = useState(false);
  const [showAddNFT, setShowAddNFT] = useState(false);
  const [showSendTransaction, setShowSendTransaction] = useState(false);
  const [preSelectedToken, setPreSelectedToken] = useState<{
    symbol: string;
    name: string;
    address: string;
    decimals: number;
  } | undefined>(undefined);
  const [preSelectedNFT, setPreSelectedNFT] = useState<{
    address: string;
    tokenId: string;
  } | undefined>(undefined);

  const [showAccountManager, setShowAccountManager] = useState(false);
  const [showWalletCreationConfirm, setShowWalletCreationConfirm] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showViewMnemonic, setShowViewMnemonic] = useState(false);
  
  const [newWalletData, setNewWalletData] = useState<NewWalletData | null>(null);

  
  const [tokenForm, setTokenForm] = useState({
    symbol: '',
    name: '',
    address: '',
    decimals: 18
  });


  const [ethBalance, setEthBalance] = useState<string>('0.000000');

  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Track if we've already shown a welcome toast to prevent duplicates
  const hasShownWelcomeToast = useRef(false);


  // Get token prices from CoinGecko with rate limiting and graceful failure
  const getTokenPrices = async () => {
    try {
      const data = await requestManager.request<{
        ethereum?: { usd: number };
        'usd-coin'?: { usd: number };
        tether?: { usd: number };
      }>('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin,tether&vs_currencies=usd', {}, {
        cacheKey: 'token-prices',
        ttl: 300000, // 5 minutes cache
        retries: 1,
        timeout: 10000
      });
      return {
        eth: data.ethereum?.usd || 0,
        usdc: data['usd-coin']?.usd || 1,
        usdt: data.tether?.usd || 1
      };
    } catch (error) {
      console.error('Error fetching token prices:', error);
      return { eth: 0, usdc: 1, usdt: 1 };
    }
  };

  // Get token balance with rate limiting and graceful failure
  const getTokenBalance = useCallback(async (address: string, decimals: number): Promise<string> => {
    try {
      const data = await requestManager.request<{
        error?: { message: string };
        result?: string;
      }>(currentNetworkConfig.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{
            to: address,
            data: '0x70a08231' + '000000000000000000000000' + currentWallet?.address?.slice(2) || ''
          }, 'latest']
        })
      }, {
        cacheKey: `token-balance-${address}-${currentWallet?.address}-${currentNetwork}`,
        ttl: 30000, // 30 seconds cache
        retries: 1,
        timeout: 15000
      });

      if (data.error || !data.result) return '0.000000';
      
      // Handle empty or invalid result
      const result = data.result;
      if (result === '0x' || result === '0x0' || !result) return '0.000000';
      
      const balanceWei = BigInt(result);
      const balance = Number(balanceWei) / Math.pow(10, decimals);
      return balance.toFixed(6);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return '0.000000';
    }
  }, [currentNetworkConfig.rpcUrl, currentWallet?.address, currentNetwork]);

    // Memoize expensive computations
  const famousTokens = useMemo(() => {
    if (currentNetwork === 'base-sepolia') {
      return [
        { symbol: 'USDC', name: 'USD Coin', address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6, logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { symbol: 'USDT', name: 'Tether USD', address: '0x7c6b91D9Be155A5DbC1B0008DAD0Ceed320c82A1', decimals: 6, logoURI: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', decimals: 18, logoURI: 'https://cryptologos.cc/logos/weth-logo.png' },
        { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, logoURI: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png' },
        { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 8, logoURI: 'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png' },
        { symbol: 'LINK', name: 'Chainlink', address: '0x6D0F8D488B669aa9BA2Bb4392d841615884c61e', decimals: 18, logoURI: 'https://cryptologos.cc/logos/chainlink-link-logo.png' },
        { symbol: 'UNI', name: 'Uniswap', address: '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb', decimals: 18, logoURI: 'https://cryptologos.cc/logos/uniswap-uni-logo.png' },
        { symbol: 'AAVE', name: 'Aave', address: '0x2D3DCA0EF793C547F11fA4e8e98C4C3A76bc8F5', decimals: 18, logoURI: 'https://cryptologos.cc/logos/aave-aave-logo.png' }
      ];
    } else if (currentNetwork === 'ethereum-sepolia') {
      return [
        { symbol: 'USDC', name: 'USD Coin (Circle)', address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6, logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
        { symbol: 'USDT', name: 'Tether USD', address: '0x7169D38820dfd117C3FA1f22a697dba58d90BA06', decimals: 6, logoURI: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18, logoURI: 'https://cryptologos.cc/logos/weth-logo.png' },
        { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', decimals: 18, logoURI: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png' },
        { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x29f2D40B0604804367cF4ba6398e245E1b4a84', decimals: 8, logoURI: 'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png' },
        { symbol: 'LINK', name: 'Chainlink', address: '0x779877A7B0D9E8603169DdbD7836e478b4624789', decimals: 18, logoURI: 'https://cryptologos.cc/logos/chainlink-link-logo.png' },
        { symbol: 'UNI', name: 'Uniswap', address: '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb', decimals: 18, logoURI: 'https://cryptologos.cc/logos/uniswap-uni-logo.png' },
        { symbol: 'AAVE', name: 'Aave', address: '0x2D3DCA0EF793C547F11fA4e8e98C4C3A76bc8F5', decimals: 18, logoURI: 'https://cryptologos.cc/logos/aave-aave-logo.png' }
      ];
    }
    return [];
  }, [currentNetwork]);





  // Debounced fetch function to prevent rapid successive calls
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  
    // Fetch all balances with optimizations
  const fetchAllBalances = useCallback(async (force = false, showToast = true) => {
    if (!currentWallet?.address || isFetchingRef.current) return;

               // Prevent excessive calls - only allow once every 60 seconds unless forced
      const now = Date.now();
      if (!force && now - lastFetchTimeRef.current < 60000) {
        return;
      }

    isFetchingRef.current = true;
    setIsLoadingBalance(true);
    lastFetchTimeRef.current = now;

    try {
      // Parallel API calls for better performance
      const [ethBalance, prices] = await Promise.all([
        getEthBalance(currentWallet.address),
        getTokenPrices()
      ]);

             setEthBalance(ethBalance);

      // Only fetch token balances if there are custom tokens
      if (customTokens.length > 0) {
        const balances: TokenBalance[] = [];
        let hasTokens = false;
        
        // Process tokens in batches to avoid overwhelming the network
        const batchSize = 3;
        for (let i = 0; i < customTokens.length; i += batchSize) {
          const batch = customTokens.slice(i, i + batchSize);
          const batchPromises = batch.map(async (token) => {
            if (token.address === '0x0000000000000000000000000000000000000000') {
              // ETH balance - use default image immediately
              return {
                symbol: 'ETH',
                name: 'Ethereum',
                address: token.address,
                balance: ethBalance,
                usdValue: Number(ethBalance) * prices.eth,
                decimals: 18,
                imageUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
              };
            } else {
              // Token balance
              const balance = await getTokenBalance(token.address, token.decimals);
              const usdValue = token.symbol === 'USDC' ? Number(balance) * prices.usdc :
                              token.symbol === 'USDT' ? Number(balance) * prices.usdt : 0;
              
              // Fetch token image using the getTokenImage function (only for tokens with balance)
              let imageUrl: string | undefined;
              if (Number(balance) > 0) {
                try {
                  imageUrl = await getTokenImage(token.symbol, token.address);
                } catch {
                  // Silently fallback to existing logoURI if available
                  imageUrl = token.logoURI;
                }
              } else {
                // For tokens with zero balance, use existing logoURI or skip image fetching
                imageUrl = token.logoURI;
              }
              
              if (Number(balance) > 0) {
                hasTokens = true;
              }
              
              return {
                symbol: token.symbol,
                name: token.name,
                address: token.address,
                balance,
                usdValue,
                decimals: token.decimals,
                imageUrl
              };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          balances.push(...batchResults);
          
          // Small delay between batches to prevent rate limiting
          if (i + batchSize < customTokens.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }


        
        // Show specific toast messages based on what was updated
        if (force && showToast) {
          if (hasTokens) {
            toast({
              variant: 'success',
              title: 'Token Balances Updated',
              description: 'Your token balances have been refreshed!',
            });
          } else {
            toast({
              variant: 'info',
              title: 'ETH Balance Updated',
              description: 'Your ETH balance has been refreshed!',
            });
          }
        }
      } else {
        // Clear token balances if no custom tokens
        
        // Show ETH balance update toast
        if (force && showToast) {
          toast({
            variant: 'info',
            title: 'ETH Balance Updated',
            description: 'Your ETH balance has been refreshed!',
          });
        }
      }
         } catch (error) {
       console.error('Error fetching balances:', error);
       if (showToast) {
         toast({
           variant: 'error',
           title: 'Error',
           description: 'Failed to fetch balances',
         });
       }
           } finally {
       setIsLoadingBalance(false);
       isFetchingRef.current = false;
     }
   }, [currentWallet, customTokens, toast, getTokenBalance]);

  // Optimized auto-refresh with proper cleanup
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (currentWallet && isWalletUnlocked) {
      // Initial fetch with welcome toast
      fetchAllBalances(true, false);
      
      // Show welcome toast for first load only if we haven't shown one yet
      if (!hasShownWelcomeToast.current) {
        toast({
          variant: 'success',
          title: 'Wallet Loaded',
          description: `Welcome! Your wallet is ready on ${currentNetworkConfig.name}`,
        });
        hasShownWelcomeToast.current = true;
      }
      
      // Set up interval with longer delay to reduce load
      intervalId = setInterval(() => {
        fetchAllBalances(false, false);
      }, 300000); // Changed to 5 minutes to reduce API calls
    }

    // Proper cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentWallet, isWalletUnlocked, fetchAllBalances, toast, currentNetworkConfig.name]);

  // Separate effect for balance refresh trigger
  useEffect(() => {
    if (isRefreshingBalances && currentWallet && isWalletUnlocked) {
      // Show toast for balance refresh
      fetchAllBalances(true, true);
    }
  }, [isRefreshingBalances, currentWallet, isWalletUnlocked, fetchAllBalances]);

  const handleCreateNewWallet = () => {
    setShowWalletCreationConfirm(true);
  };

  const handleConfirmWalletCreation = () => {
    try {
      const wallet = generateNewWallet();
      setNewWalletData(wallet);
      setShowNewWallet(true);
    } catch (error) {
      console.error('Error creating wallet:', error);
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Error creating wallet: ' + error,
      });
    }
  };

  const handleSaveNewWallet = (password: string) => {
    if (!password) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Please enter a password',
      });
      return;
    }

    if (!newWalletData) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'No wallet data to save',
      });
      return;
    }

    try {
      const encryptedWallet = encryptMnemonic(newWalletData.mnemonic, password, newWalletData.address);
      storeEncryptedWallet(encryptedWallet);
      setCurrentWallet(newWalletData);
      setIsWalletUnlocked(true);
      setShowNewWallet(false);
      refreshStoredData();
      
      toast({
        variant: 'success',
        title: 'Wallet Unlocked',
        description: 'Welcome back! Your wallet is now unlocked.',
      });
      
      // Only clear the data after successful save
      setNewWalletData(null);
      toast({
        variant: 'success',
        title: 'Wallet Created',
        description: 'Your wallet has been created and saved successfully!',
      });
    } catch (error) {
      console.error('Error saving wallet:', error);
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Error saving wallet: ' + error,
      });
      // Don't clear the data on error - let user try again
    }
  };

  const handleImportWallet = (mnemonic: string, password: string) => {
    if (!mnemonic.trim() || !password.trim()) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Please enter both mnemonic and password',
      });
      return;
    }

    try {
      const wallet = importWalletFromMnemonic(mnemonic.trim());
      const encryptedWallet = encryptMnemonic(wallet.mnemonic, password, wallet.address);
      storeEncryptedWallet(encryptedWallet);
      setCurrentWallet(wallet);
      setIsWalletUnlocked(true);
      setShowImportWallet(false);
      refreshStoredData();
      
      toast({
        variant: 'success',
        title: 'Wallet Imported',
        description: 'Your wallet has been imported successfully!',
      });
    } catch (error) {
      console.error('Error importing wallet:', error);
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Error importing wallet: ' + error,
      });
    }
  };

  const handleRecoverWallet = (address: string, password: string) => {
    if (!address || !password) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Please enter both address and password',
      });
      return;
    }

    try {
      const wallet = recoverWallet(address, password);
      setCurrentWallet(wallet);
      setIsWalletUnlocked(true);
      setShowRecoverWallet(false);
      
      toast({
        variant: 'success',
        title: 'Wallet Recovered',
        description: 'Your wallet has been recovered successfully!',
      });
    } catch (error) {
      console.error('Error recovering wallet:', error);
      // Don't clear the form data on error - let user try again
      if (error instanceof Error && error.message.includes('Invalid password')) {
        toast({
          variant: 'error',
          title: 'Invalid Password',
          description: 'Invalid password. Please try again.',
        });
      } else {
        toast({
          variant: 'error',
          title: 'Error',
          description: 'Error recovering wallet: ' + error,
        });
      }
    }
  };

  const handleAddToken = (tokenData?: {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
  }) => {
    // Use the passed tokenData if available, otherwise use the local tokenForm
    const formData = tokenData || tokenForm;
    const trimmedSymbol = formData.symbol.trim();
    const trimmedName = formData.name.trim();
    const trimmedAddress = formData.address.trim();
    
    if (!trimmedSymbol || !trimmedName || !trimmedAddress) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Please fill all token fields',
      });
      return;
    }

    try {
      const trimmedTokenForm = {
        ...formData,
        symbol: trimmedSymbol,
        name: trimmedName,
        address: trimmedAddress
      };
      addCustomToken(trimmedTokenForm as TokenInfoWithImage);
      setShowAddToken(false);
      setTokenForm({ symbol: '', name: '', address: '', decimals: 18 });
      refreshStoredData();
      toast({
        variant: 'success',
        title: 'Token Added',
        description: `${trimmedSymbol} has been added to your wallet!`,
      });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Error adding token: ' + error,
      });
    }
  };





  const handleSendToken = (token: TokenBalance) => {
    // Set the pre-selected token and open send transaction modal
    setPreSelectedToken(token);
    setShowSendTransaction(true);
  };

  const handleAddNFT = (nftInfo: NFTInfo) => {
    try {
      addNFT(nftInfo);
      setShowAddNFT(false);
      toast({
        variant: 'success',
        title: 'NFT Added',
        description: `${nftInfo.name} #${nftInfo.tokenId} has been added to your wallet!`,
      });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Error adding NFT: ' + error,
      });
    }
  };

  const handleSendNFT = (nft: NFTInfo) => {
    // Set the pre-selected NFT and open send transaction modal
    setPreSelectedNFT({ address: nft.address, tokenId: nft.tokenId });
    setShowSendTransaction(true);
  };



  const handleLogout = () => {
    setCurrentWallet(null);
    setIsWalletUnlocked(false);
    hasShownWelcomeToast.current = false; // Reset welcome toast flag
    toast({
      variant: 'info',
      title: 'Logged Out',
      description: 'You have been logged out successfully',
    });
  };

  const handleCopyAddress = async () => {
    if (!currentWallet?.address) return;
    
    try {
      await navigator.clipboard.writeText(currentWallet.address);
      toast({
        variant: 'success',
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard!',
      });
    } catch (error) {
      console.error('Failed to copy address:', error);
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Failed to copy address',
      });
    }
  };





  // Refresh stored data on component mount
  useEffect(() => {
    refreshStoredData();
  }, [refreshStoredData]); // Include refreshStoredData in dependencies

     if (!isWalletUnlocked) {
     return (
       <div className="jupiter-container">
         <TransactionNotification />

                 {/* Desktop Navigation */}
         <div className="jupiter-desktop-nav">
           <div className="jupiter-desktop-nav-content">
             <div className="jupiter-desktop-nav-logo">
               <div className="jupiter-avatar">💼</div>
               <span>Maclo Wallet</span>
             </div>
                           <div className="jupiter-desktop-nav-actions">
                <NetworkSwitcher />
              </div>
           </div>
         </div>



                 {/* Header */}
                   <div className="jupiter-header">
            <div className="jupiter-avatar">💼</div>
          </div>

         {/* Welcome Section */}
         <div className="jupiter-welcome">
           <h1>Maclo Wallet</h1>
           <p>Your secure Ethereum wallet</p>
           
           
         </div>

        {/* Main Content */}
        <div className="jupiter-main">
          {/* Action Cards */}
          <div className="jupiter-actions-container">
            <div className="jupiter-card" onClick={handleCreateNewWallet}>
              <div className="jupiter-card-content">
                <div className="jupiter-card-text">
                  <div className="jupiter-card-title">Create New Wallet</div>
                  <div className="jupiter-card-description">
                    Generate a new secure wallet →
                  </div>
                </div>
                <div className="jupiter-card-icons">
                  <div className="jupiter-card-icon">💳</div>
                  <div className="jupiter-card-icon">🔐</div>
                </div>
              </div>
            </div>

            <div className="jupiter-card" onClick={() => setShowImportWallet(true)}>
              <div className="jupiter-card-content">
                <div className="jupiter-card-text">
                  <div className="jupiter-card-title">Import Wallet</div>
                  <div className="jupiter-card-description">
                    Import existing wallet with mnemonic →
                  </div>
                </div>
                <div className="jupiter-card-icons">
                  <div className="jupiter-card-icon">📥</div>
                  <div className="jupiter-card-icon">🔑</div>
                </div>
              </div>
            </div>

                         {storedAddresses.length > 0 ? (
               <div className="jupiter-card" onClick={() => setShowRecoverWallet(true)}>
                <div className="jupiter-card-content">
                  <div className="jupiter-card-text">
                    <div className="jupiter-card-title">Recover Wallet</div>
                    <div className="jupiter-card-description">
                      Recover saved wallet with password →
                    </div>
                  </div>
                  <div className="jupiter-card-icons">
                    <div className="jupiter-card-icon">🔄</div>
                    <div className="jupiter-card-icon">🔓</div>
                  </div>
                </div>
              </div>
            ) : (
                             <div className="jupiter-card opacity-50 cursor-not-allowed" onClick={() => refreshStoredData()}>
                <div className="jupiter-card-content">
                  <div className="jupiter-card-text">
                    <div className="jupiter-card-title">Recover Wallet</div>
                    <div className="jupiter-card-description">
                      No saved wallets to recover (Click to refresh)
                    </div>
                  </div>
                  <div className="jupiter-card-icons">
                    <div className="jupiter-card-icon">🔄</div>
                    <div className="jupiter-card-icon">🔓</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        

        {/* Modal Components */}
        <CreateWalletModal
          open={showNewWallet}
                     onOpenChange={(open) => {
             if (!open) {
               setShowNewWallet(false);
               setNewWalletData(null);
             } else {
               setShowNewWallet(true);
             }
           }}
          walletData={newWalletData}
          onSave={handleSaveNewWallet}
        />

        <ImportWalletModal
          open={showImportWallet}
          onOpenChange={(open) => {
            if (!open) {
              setShowImportWallet(false);
            } else {
              setShowImportWallet(true);
            }
          }}
          onImport={handleImportWallet}
          loading={false}
        />

        <RecoverWalletModal
          open={showRecoverWallet}
                     onOpenChange={(open) => {
             if (!open) {
               setShowRecoverWallet(false);
             } else {
               setShowRecoverWallet(true);
             }
           }}
          storedAddresses={storedAddresses}
          onRecover={handleRecoverWallet}
          loading={false}
        />

        {/* Confirmation Modal for Wallet Creation */}
        <ConfirmationModal
          open={showWalletCreationConfirm}
          onOpenChange={setShowWalletCreationConfirm}
          onConfirm={handleConfirmWalletCreation}
          title="Create New Wallet"
          description="A new wallet will be created and you will be shown a mnemonic phrase. Please write down this phrase and keep it safe - it's the only way to recover your wallet if you lose access to it."
          confirmText="Create Wallet"
          variant="warning"
        />
      </div>
    );
  }

     return (
     <div className="jupiter-container">
       <TransactionNotification />

      {/* Desktop Navigation */}
      <div className="jupiter-desktop-nav">
        <div className="jupiter-desktop-nav-content">
          <div className="jupiter-desktop-nav-logo">
            <div className="jupiter-avatar">💼</div>
            <span>Maclo Wallet</span>
          </div>
          <div className="jupiter-desktop-nav-actions">
            <NetworkSwitcher />
            <button className="jupiter-btn jupiter-btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>



             {/* Header */}
               <div className="jupiter-header">
          <div className="flex items-start gap-8">
            <div className="jupiter-avatar flex items-center justify-center">💼</div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-white mb-1">{getCurrentAccountName()}</div>
              <div className="text-sm text-gray-300 mb-4">
                {isLoadingBalance ? 'Loading...' : `${ethBalance} ETH`}
              </div>
              
              {/* Desktop Wallet Address - Hidden on Mobile */}
              <div className="flex items-center gap-4 hidden sm:flex">
                <Label showDot dotColor="bg-green-400">
                  {currentWallet?.address?.slice(0, 6)}...{currentWallet?.address?.slice(-4)}
                </Label>
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button 
                        onClick={handleCopyAddress}
                        className="p-2.5 text-gray-300 hover:text-white transition-all duration-200 rounded-full hover:bg-gradient-to-r hover:from-gray-700/60 hover:to-gray-600/60 hover:scale-105 flex items-center justify-center group border border-gray-600/40 hover:border-gray-500/60 shadow-sm"
                      >
                        <Copy className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      </button>
                    </Tooltip.Trigger>
                                       <Tooltip.Portal>
                      <Tooltip.Content
                        className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg border border-gray-700 backdrop-blur-sm z-[9999]"
                        sideOffset={5}
                      >
                        Copy address to clipboard
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>
              
              {/* Mobile Wallet Address and Network Switcher */}
              <div className="sm:hidden">
                <div className="flex items-center gap-2 mb-2">
                  <Label showDot dotColor="bg-green-400" className="text-xs">
                    {currentWallet?.address?.slice(0, 6)}...{currentWallet?.address?.slice(-4)}
                  </Label>
                  <button 
                    onClick={handleCopyAddress}
                    className="p-1.5 text-gray-300 hover:text-white transition-all duration-200 rounded-full hover:bg-gradient-to-r hover:from-gray-700/60 hover:to-gray-600/60 hover:scale-105 flex items-center justify-center group border border-gray-600/40 hover:border-gray-500/60 shadow-sm"
                  >
                    <Copy className="h-3 w-3 group-hover:scale-110 transition-transform" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <NetworkSwitcher />
                </div>
              </div>
            </div>
          </div>
                                                                                       <div className="jupiter-actions">
              <ContextMenu
                open={showContextMenu}
                onOpenChange={setShowContextMenu}
                trigger={
                  <button className="jupiter-action-btn">
                    <Cog6ToothIcon className="h-5 w-5" />
                  </button>
                }
              >
                <ContextMenuItem
                  onClick={() => {
                    setShowAccountManager(true);
                    setShowContextMenu(false);
                  }}
                  icon={<UserIcon />}
                >
                  Account Manager
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    setShowViewMnemonic(true);
                    setShowContextMenu(false);
                  }}
                  icon={<KeyIcon />}
                >
                  Recover Mnemonic
                </ContextMenuItem>
              </ContextMenu>
            </div>
        </div>

      {/* Main Content */}
      <div className="jupiter-main">
        {/* Quick Actions */}
        <div className="jupiter-actions-container">
          <div className="jupiter-card" onClick={() => setShowSendTransaction(true)}>
            <div className="jupiter-card-content">
              <div className="jupiter-card-text">
                <div className="jupiter-card-title">Send Transaction</div>
                <div className="jupiter-card-description">
                  Send ETH or tokens to another address →
                </div>
              </div>
              <div className="jupiter-card-icons">
                <div className="jupiter-card-icon">💸</div>
                <div className="jupiter-card-icon">📤</div>
              </div>
            </div>
          </div>

          <div className="jupiter-card" onClick={() => setShowAddToken(true)}>
            <div className="jupiter-card-content">
              <div className="jupiter-card-text">
                <div className="jupiter-card-title">Add Token</div>
                <div className="jupiter-card-description">
                  Add custom tokens to your wallet →
                </div>
              </div>
              <div className="jupiter-card-icons">
                <div className="jupiter-card-icon">🪙</div>
                <div className="jupiter-card-icon">➕</div>
              </div>
            </div>
          </div>

          <div className="jupiter-card" onClick={() => setShowAddNFT(true)}>
            <div className="jupiter-card-content">
              <div className="jupiter-card-text">
                <div className="jupiter-card-title">Add NFT</div>
                <div className="jupiter-card-description">
                  Add NFTs to your wallet →
                </div>
              </div>
              <div className="jupiter-card-icons">
                <div className="jupiter-card-icon">🖼️</div>
                <div className="jupiter-card-icon">➕</div>
              </div>
            </div>
          </div>



           

           
        </div>

                 {/* Token List and Market Overview - Side by Side */}
         <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
           <div className="w-full h-full max-w-2xl mx-auto">
             <TokenList onSendToken={handleSendToken} />
           </div>
           <div className="w-full h-full max-w-2xl mx-auto">
             <MarketOverview />
           </div>
         </div>

        {/* NFT Collections */}
        <div style={{ marginTop: '32px' }}>
          <NFTCollections 
            onAddNFT={() => setShowAddNFT(true)}
            onSendNFT={handleSendNFT}
          />
        </div>
      </div>

      

             <AddTokenModal
         open={showAddToken}
         onOpenChange={(open) => {
           if (!open) {
             setShowAddToken(false);
             setTokenForm({ symbol: '', name: '', address: '', decimals: 18 });
           } else {
             setShowAddToken(true);
           }
         }}
         onAdd={handleAddToken}
         tokenSuggestions={famousTokens}
         loading={false}
       />

       <AddNFTModal
         open={showAddNFT}
         onOpenChange={(open) => {
           if (!open) {
             setShowAddNFT(false);
           } else {
             setShowAddNFT(true);
           }
         }}
         onAdd={handleAddNFT}
         loading={false}
       />

             {/* Send Transaction Component */}
       <SendTransaction 
         isOpen={showSendTransaction} 
         onClose={() => {
           setShowSendTransaction(false);
           setPreSelectedToken(undefined);
           setPreSelectedNFT(undefined);
         }}
         preSelectedToken={preSelectedToken}
         preSelectedNFT={preSelectedNFT}
       />

             {/* Account Manager */}
               <AccountManager 
          isOpen={showAccountManager} 
          onClose={() => setShowAccountManager(false)} 
        />

        {/* Confirmation Modal for Wallet Creation */}
        <ConfirmationModal
          open={showWalletCreationConfirm}
          onOpenChange={setShowWalletCreationConfirm}
          onConfirm={handleConfirmWalletCreation}
          title="Create New Wallet"
          description="A new wallet will be created and you will be shown a mnemonic phrase. Please write down this phrase and keep it safe - it's the only way to recover your wallet if you lose access to it."
          confirmText="Create Wallet"
          variant="warning"
        />
        
        {/* View Mnemonic Modal */}
        <ViewMnemonicModal
          open={showViewMnemonic}
          onOpenChange={setShowViewMnemonic}
          walletAddress={currentWallet?.address || ''}
        />
        
      </div>
    );
  }
