'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useWallet } from '@/lib/walletContext';
import { 
  generateNewWallet, 
  importWalletFromMnemonic, 
  encryptMnemonic, 
  storeEncryptedWallet, 
  addCustomToken, 
  removeCustomToken, 
  getEthBalance,
  getTokenImage,
  TokenInfoWithImage,
  recoverWallet
} from '@/lib/walletManager';
import { requestManager } from '@/lib/requestManager';
import SendTransaction from '@/components/SendTransaction';
import NetworkSwitcher from '@/components/NetworkSwitcher';
import { 
  WalletIcon, 
  PlusIcon, 
  ArrowPathIcon, 
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  CurrencyDollarIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon
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

interface Alert {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface NewWalletData {
  address: string;
  mnemonic: string;
  privateKey: string;
}

export default function Home() {
  const { 
    currentWallet, 
    setCurrentWallet, 
    storedAddresses, 
    customTokens, 
    refreshStoredData,
    isWalletUnlocked,
    setIsWalletUnlocked,
    currentNetwork,
    currentNetworkConfig
  } = useWallet();

  const [showNewWallet, setShowNewWallet] = useState(false);
  const [showImportWallet, setShowImportWallet] = useState(false);
  const [showRecoverWallet, setShowRecoverWallet] = useState(false);
  const [showAddToken, setShowAddToken] = useState(false);
  const [showSendTransaction, setShowSendTransaction] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  
  const [newWalletData, setNewWalletData] = useState<NewWalletData | null>(null);
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [recoverAddress, setRecoverAddress] = useState('');
  const [recoverPassword, setRecoverPassword] = useState('');
  
  const [tokenForm, setTokenForm] = useState({
    symbol: '',
    name: '',
    address: '',
    decimals: 18
  });

  // Token balances and USD values
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [ethBalance, setEthBalance] = useState<string>('0.000000');
  const [ethUsdValue, setEthUsdValue] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Alerts system
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Add alert function
  const addAlert = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    const newAlert = { id, type, message };
    setAlerts(prev => [...prev, newAlert]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeAlert(id);
    }, 5000);
  };

  // Remove alert function
  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

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
  const getTokenBalance = async (address: string, decimals: number): Promise<string> => {
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
  };

  // Famous tokens for autocomplete (network-specific)
  const getFamousTokens = () => {
    if (currentNetwork === 'base-sepolia') {
      return [
        { symbol: 'USDC', name: 'USD Coin', address: '0x036CbD53842c5426634e7929541eC2318f3dCF7c', decimals: 6, logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
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
        { symbol: 'USDC', name: 'USD Coin', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6, logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
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
  };

  const famousTokens = getFamousTokens();

  // Filter tokens based on input
  const getFilteredTokens = (input: string) => {
    if (!input) return [];
    const lowerInput = input.toLowerCase();
    return famousTokens.filter(token => 
      token.symbol.toLowerCase().includes(lowerInput) ||
      token.name.toLowerCase().includes(lowerInput) ||
      token.address.toLowerCase().includes(lowerInput)
    );
  };

  const [filteredTokens, setFilteredTokens] = useState<typeof famousTokens>([]);
  const [showTokenSuggestions, setShowTokenSuggestions] = useState(false);

  // Debounced fetch function to prevent rapid successive calls
  const [isFetching, setIsFetching] = useState(false);
  
  // Fetch all balances
  const fetchAllBalances = useCallback(async () => {
    if (!currentWallet?.address || isFetching) return;

    console.log('Fetching balances for network:', currentNetwork, 'RPC URL:', currentNetworkConfig.rpcUrl);

    setIsFetching(true);
    setIsLoadingBalance(true);

    try {
      // Get ETH balance
      const ethBalance = await getEthBalance(currentWallet.address);
      console.log('ETH balance fetched:', ethBalance);
      setEthBalance(ethBalance);

      // Get token prices
      const prices = await getTokenPrices();
      setEthUsdValue(Number(ethBalance) * prices.eth);

      // Get token balances
      const balances: TokenBalance[] = [];
      
      for (const token of customTokens) {
        if (token.address === '0x0000000000000000000000000000000000000000') {
          // ETH balance - use default image immediately
          balances.push({
            symbol: 'ETH',
            name: 'Ethereum',
            address: token.address,
            balance: ethBalance,
            usdValue: Number(ethBalance) * prices.eth,
            decimals: 18,
            imageUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
          });
        } else {
          // Token balance
          const balance = await getTokenBalance(token.address, token.decimals);
          const usdValue = token.symbol === 'USDC' ? Number(balance) * prices.usdc :
                          token.symbol === 'USDT' ? Number(balance) * prices.usdt : 0;
          
          // Use existing logoURI if available, otherwise fetch image
          let imageUrl = token.logoURI;
          if (!imageUrl) {
            try {
              imageUrl = await getTokenImage(token.symbol, token.address);
            } catch (error) {
              console.log(`Failed to fetch image for ${token.symbol}:`, error);
              imageUrl = 'https://cryptologos.cc/logos/ethereum-eth-logo.png'; // fallback
            }
          }
          
          balances.push({
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            balance,
            usdValue,
            decimals: token.decimals,
            imageUrl: imageUrl
          });
        }
      }

      setTokenBalances(balances);
    } catch (error) {
      console.error('Error fetching balances:', error);
      addAlert('error', 'Failed to fetch balances');
    } finally {
      setIsLoadingBalance(false);
      setIsFetching(false);
    }
  }, [currentWallet, currentNetwork, currentNetworkConfig, customTokens, addAlert, getTokenBalance, isFetching]);

  // Auto-refresh balances every 60 seconds (reduced frequency)
  useEffect(() => {
    if (currentWallet && isWalletUnlocked) {
      fetchAllBalances();
      
      const interval = setInterval(fetchAllBalances, 60000); // Changed from 30 to 60 seconds
      return () => clearInterval(interval);
    }
  }, [currentWallet, isWalletUnlocked, fetchAllBalances]);

  const handleCreateNewWallet = () => {
    try {
      console.log('Generating new wallet...');
      const wallet = generateNewWallet();
      console.log('Wallet generated:', wallet);
      setNewWalletData(wallet);
      setShowNewWallet(true);
    } catch (error) {
      console.error('Error creating wallet:', error);
      addAlert('error', 'Error creating wallet: ' + error);
    }
  };

  const handleSaveNewWallet = () => {
    if (!password) {
      addAlert('error', 'Please enter a password');
      return;
    }

    if (!newWalletData) {
      addAlert('error', 'No wallet data to save');
      return;
    }

    try {
      console.log(newWalletData)
      const encryptedWallet = encryptMnemonic(newWalletData.mnemonic, password, newWalletData.address);
      storeEncryptedWallet(encryptedWallet);
      setCurrentWallet(newWalletData);
      setIsWalletUnlocked(true);
      setShowNewWallet(false);
      refreshStoredData();
      
      // Only clear the data after successful save
      setNewWalletData(null);
      setPassword('');
      addAlert('success', 'Wallet created and saved successfully!');
    } catch (error) {
      console.error('Error saving wallet:', error);
      addAlert('error', 'Error saving wallet: ' + error);
      // Don't clear the data on error - let user try again
    }
  };

  const handleImportWallet = () => {
    if (!mnemonic || !password) {
      addAlert('error', 'Please enter both mnemonic and password');
      return;
    }

    try {
      const wallet = importWalletFromMnemonic(mnemonic);
      const encryptedWallet = encryptMnemonic(wallet.mnemonic, password, wallet.address);
      storeEncryptedWallet(encryptedWallet);
      console.log(wallet);
      setCurrentWallet(wallet);
      setIsWalletUnlocked(true);
      setShowImportWallet(false);
      refreshStoredData();
      
      // Only clear the form data after successful import
      setMnemonic('');
      setPassword('');
      addAlert('success', 'Wallet imported successfully!');
    } catch (error) {
      console.error('Error importing wallet:', error);
      addAlert('error', 'Error importing wallet: ' + error);
      // Don't clear the form data on error - let user try again
    }
  };

  const handleRecoverWallet = () => {
    if (!recoverAddress || !recoverPassword) {
      addAlert('error', 'Please enter both address and password');
      return;
    }

    try {
      const wallet = recoverWallet(recoverAddress, recoverPassword);
      setCurrentWallet(wallet);
      setIsWalletUnlocked(true);
      setShowRecoverWallet(false);
      
      // Only clear the form data after successful recovery
      setRecoverAddress('');
      setRecoverPassword('');
      addAlert('success', 'Wallet recovered successfully!');
    } catch (error) {
      console.error('Error recovering wallet:', error);
      // Don't clear the form data on error - let user try again
      if (error instanceof Error && error.message.includes('Invalid password')) {
        addAlert('error', 'Invalid password. Please try again.');
        setRecoverPassword(''); // Only clear password field for retry
      } else {
        addAlert('error', 'Error recovering wallet: ' + error);
      }
    }
  };

  const handleAddToken = () => {
    if (!tokenForm.symbol || !tokenForm.name || !tokenForm.address) {
      addAlert('error', 'Please fill all token fields');
      return;
    }

    try {
      addCustomToken(tokenForm as TokenInfoWithImage);
      setShowAddToken(false);
      setTokenForm({ symbol: '', name: '', address: '', decimals: 18 });
      setFilteredTokens([]);
      setShowTokenSuggestions(false);
      refreshStoredData();
      addAlert('success', 'Token added successfully!');
    } catch (error) {
      addAlert('error', 'Error adding token: ' + error);
    }
  };

  const handleTokenInputChange = (field: keyof typeof tokenForm, value: string) => {
    setTokenForm(prev => ({ ...prev, [field]: value }));
    
    if (field === 'symbol' || field === 'name') {
      const filtered = getFilteredTokens(value);
      setFilteredTokens(filtered);
      setShowTokenSuggestions(filtered.length > 0);
    }
  };

  const handleTokenSuggestionClick = (token: typeof famousTokens[0]) => {
    setTokenForm({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      decimals: token.decimals
    });
    setFilteredTokens([]);
    setShowTokenSuggestions(false);
  };

  const handleRemoveToken = (address: string) => {
    try {
      removeCustomToken(address);
      refreshStoredData();
      addAlert('success', 'Token removed successfully!');
    } catch (error) {
      addAlert('error', 'Error removing token: ' + error);
    }
  };

  const handleLogout = () => {
    setCurrentWallet(null);
    setIsWalletUnlocked(false);
    addAlert('info', 'Logged out successfully');
  };

  if (!isWalletUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        {/* Enhanced Alerts */}
        <div className="fixed top-4 right-4 z-50 space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center p-4 rounded-xl shadow-2xl transform transition-all duration-500 animate-in slide-in-from-right-4 ${
                alert.type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-l-4 border-green-400' :
                alert.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-l-4 border-red-400' :
                'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-l-4 border-blue-400'
              }`}
            >
              <div className={`mr-3 p-1 rounded-full ${
                alert.type === 'success' ? 'bg-green-400' :
                alert.type === 'error' ? 'bg-red-400' :
                'bg-blue-400'
              }`}>
                <CheckCircleIcon className="h-4 w-4 text-white" />
              </div>
              <span className="flex-1 font-medium">{alert.message}</span>
              <button
                onClick={() => removeAlert(alert.id)}
                className="ml-3 p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-all duration-200 cursor-pointer"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg">
              <WalletIcon className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Crypto Wallet
            </h2>
            <p className="mt-2 text-center text-sm text-gray-700">
              Secure your digital assets on Base Sepolia
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleCreateNewWallet}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg cursor-pointer active:scale-95"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create New Wallet
            </button>

            <button
              onClick={() => setShowImportWallet(true)}
              className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md cursor-pointer active:scale-95"
            >
              <KeyIcon className="h-5 w-5 mr-2" />
              Import Wallet
            </button>

            {storedAddresses.length > 0 && (
              <button
                onClick={() => setShowRecoverWallet(true)}
                className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md cursor-pointer active:scale-95"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Recover Wallet
              </button>
            )}
          </div>
        </div>

        {/* New Wallet Modal */}
        {showNewWallet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-6 border w-96 shadow-2xl rounded-xl bg-white">
              <div className="mt-3">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Create New Wallet</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wallet Address
                  </label>
                  <input
                    type="text"
                    value={newWalletData?.address || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-900 font-mono"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mnemonic Phrase
                  </label>
                  <div className="relative">
                    <textarea
                      value={showMnemonic ? newWalletData?.mnemonic || '' : '••••••••••••••••••••••••'}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-900 font-mono"
                      rows={3}
                    />
                    <button
                      onClick={() => setShowMnemonic(!showMnemonic)}
                      className="absolute right-2 top-2 p-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      {showMnemonic ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-600" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ Save this mnemonic phrase securely! You&apos;ll need it to recover your wallet.
                  </p>
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password to encrypt wallet"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleSaveNewWallet}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:from-blue-700 hover:to-indigo-700 transform transition-all duration-200 hover:scale-105"
                  >
                    Save Wallet
                  </button>
                  <button
                    onClick={() => {
                      setShowNewWallet(false);
                      setNewWalletData(null);
                      setPassword('');
                      setShowMnemonic(false);
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-400 transform transition-all duration-200 hover:scale-105"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import Wallet Modal */}
        {showImportWallet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-6 border w-96 shadow-2xl rounded-xl bg-white">
              <div className="mt-3">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Import Wallet</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mnemonic Phrase
                  </label>
                  <textarea
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                    placeholder="Enter your 12 or 24 word mnemonic phrase"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    rows={3}
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password to encrypt wallet"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleImportWallet}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:from-blue-700 hover:to-indigo-700 transform transition-all duration-200 hover:scale-105"
                  >
                    Import Wallet
                  </button>
                  <button
                    onClick={() => {
                      setShowImportWallet(false);
                      setMnemonic('');
                      setPassword('');
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-400 transform transition-all duration-200 hover:scale-105"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recover Wallet Modal */}
        {showRecoverWallet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-6 border w-96 shadow-2xl rounded-xl bg-white">
              <div className="mt-3">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Recover Wallet</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wallet Address
                  </label>
                  <select
                    value={recoverAddress}
                    onChange={(e) => setRecoverAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  >
                    <option value="">Select a wallet</option>
                    {storedAddresses.map((address) => (
                      <option key={address} value={address}>
                        {address.slice(0, 6)}...{address.slice(-4)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={recoverPassword}
                    onChange={(e) => setRecoverPassword(e.target.value)}
                    placeholder="Enter your wallet password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleRecoverWallet}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:from-blue-700 hover:to-indigo-700 transform transition-all duration-200 hover:scale-105"
                  >
                    Recover Wallet
                  </button>
                  <button
                    onClick={() => {
                      setShowRecoverWallet(false);
                      setRecoverAddress('');
                      setRecoverPassword('');
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-400 transform transition-all duration-200 hover:scale-105"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Enhanced Alerts */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-center p-4 rounded-xl shadow-2xl transform transition-all duration-500 animate-in slide-in-from-right-4 ${
              alert.type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-l-4 border-green-400' :
              alert.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-l-4 border-red-400' :
              'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-l-4 border-blue-400'
            }`}
          >
            <div className={`mr-3 p-1 rounded-full ${
              alert.type === 'success' ? 'bg-green-400' :
              alert.type === 'error' ? 'bg-red-400' :
              'bg-blue-400'
            }`}>
              <CheckCircleIcon className="h-4 w-4 text-white" />
            </div>
            <span className="flex-1 font-medium">{alert.message}</span>
            <button
              onClick={() => removeAlert(alert.id)}
              className="ml-3 p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-all duration-200 cursor-pointer"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
                <WalletIcon className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Crypto Wallet</h1>
            </div>
            <div className="flex items-center space-x-4">
              <NetworkSwitcher />
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transform transition-all duration-200 hover:scale-105"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Wallet Info */}
            <div className="lg:col-span-2">
              <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-200">
                <div className="px-6 py-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    Wallet Information
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={currentWallet?.address || ''}
                          readOnly
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-900 font-mono"
                        />
                                                 <button
                           onClick={() => {
                             navigator.clipboard.writeText(currentWallet?.address || '');
                             addAlert('success', 'Address copied to clipboard!');
                           }}
                           className="ml-3 px-4 py-3 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transform transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                         >
                           Copy
                         </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ETH Balance</label>
                      <div className="flex items-center">
                        <div className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm bg-gray-50">
                          {isLoadingBalance ? (
                            <span className="text-gray-600">Loading...</span>
                          ) : (
                            <div>
                              <div className="font-mono text-gray-900">{ethBalance} ETH</div>
                              <div className="text-sm text-gray-600">≈ ${ethUsdValue.toFixed(2)} USD</div>
                            </div>
                          )}
                        </div>
                                                 <button
                           onClick={fetchAllBalances}
                           disabled={isLoadingBalance}
                           className="ml-3 px-4 py-3 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 disabled:opacity-50 transform transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                         >
                           Refresh
                         </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Network</label>
                      <div className="px-4 py-3 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-900">
                        {currentNetworkConfig.name} (Chain ID: {currentNetworkConfig.chainId})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="lg:col-span-1">
              <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-200">
                <div className="px-6 py-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    Quick Actions
                  </h3>
                                     <div className="space-y-4">
                     <button
                       onClick={() => setShowSendTransaction(true)}
                       className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg cursor-pointer active:scale-95"
                     >
                       <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                       Send Transaction
                     </button>
                     <button
                       onClick={() => setShowAddToken(true)}
                       className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transform transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md cursor-pointer active:scale-95"
                     >
                       <PlusIcon className="h-5 w-5 mr-2" />
                       Add Token
                     </button>
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* Token Balances */}
          {tokenBalances.length > 0 && (
            <div className="mt-8">
              <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-200">
                <div className="px-6 py-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    Token Balances
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Token
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            USD Value
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Address
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tokenBalances.map((token, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full flex items-center justify-center mr-3 overflow-hidden bg-gray-100">
                                  {token.imageUrl ? (
                                    <Image 
                                      src={token.imageUrl} 
                                      alt={token.symbol}
                                      width={32}
                                      height={32}
                                      className="h-8 w-8 object-cover"
                                      onError={(e) => {
                                        // Handle error by showing fallback
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.nextElementSibling as HTMLElement;
                                        if (fallback) {
                                          fallback.classList.remove('hidden');
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div className={`h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center ${token.imageUrl ? 'hidden' : ''}`}>
                                    <span className="text-white text-xs font-bold">{token.symbol}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{token.symbol}</div>
                                  <div className="text-sm text-gray-500">{token.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-mono text-gray-900">{token.balance}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">${token.usdValue.toFixed(2)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {token.address.slice(0, 6)}...{token.address.slice(-4)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                             <button 
                                 onClick={() => handleRemoveToken(token.address)}
                                 className="text-red-600 hover:text-red-900 transform transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer p-1 rounded-full hover:bg-red-50"
                               >
                                 <TrashIcon className="h-4 w-4" />
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Token Modal */}
      {showAddToken && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-6 border w-96 shadow-2xl rounded-xl bg-white">
            <div className="mt-3">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Add Custom Token</h3>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Symbol
                  </label>
                  <input
                    type="text"
                    value={tokenForm.symbol}
                    onChange={(e) => handleTokenInputChange('symbol', e.target.value)}
                    placeholder="e.g., USDC"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                  {showTokenSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredTokens.map((token, index) => (
                        <div
                          key={index}
                          onClick={() => handleTokenSuggestionClick(token)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-900 border-b border-gray-100 last:border-b-0 flex items-center"
                        >
                          <div className="h-6 w-6 rounded-full flex items-center justify-center mr-3 overflow-hidden bg-gray-100">
                            {token.logoURI ? (
                                                          <Image 
                              src={token.logoURI} 
                              alt={token.symbol}
                              width={24}
                              height={24}
                              className="h-6 w-6 object-cover"
                              onError={(e) => {
                                // Handle error by showing fallback
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.classList.remove('hidden');
                                }
                              }}
                            />
                            ) : null}
                            <div className={`h-6 w-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center ${token.logoURI ? 'hidden' : ''}`}>
                              <span className="text-white text-xs font-bold">{token.symbol}</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{token.symbol}</div>
                            <div className="text-xs text-gray-500">{token.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={tokenForm.name}
                    onChange={(e) => handleTokenInputChange('name', e.target.value)}
                    placeholder="e.g., USD Coin"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contract Address
                  </label>
                  <input
                    type="text"
                    value={tokenForm.address}
                    onChange={(e) => handleTokenInputChange('address', e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Decimals
                  </label>
                  <input
                    type="number"
                    value={tokenForm.decimals}
                    onChange={(e) => handleTokenInputChange('decimals', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleAddToken}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:from-blue-700 hover:to-indigo-700 transform transition-all duration-200 hover:scale-105"
                  >
                    Add Token
                  </button>
                  <button
                    onClick={() => {
                      setShowAddToken(false);
                      setTokenForm({ symbol: '', name: '', address: '', decimals: 18 });
                      setFilteredTokens([]);
                      setShowTokenSuggestions(false);
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-400 transform transition-all duration-200 hover:scale-105"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Transaction Component */}
      <SendTransaction 
        isOpen={showSendTransaction} 
        onClose={() => setShowSendTransaction(false)} 
      />
    </div>
  );
}
