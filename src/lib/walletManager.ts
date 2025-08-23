import * as bip39 from 'bip39';
import * as CryptoJS from 'crypto-js';
import { deriveAddress } from './walletUtils';
import { ec as EC } from 'elliptic';
import hdkey from 'hdkey';

// Initialize elliptic curve
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ec = new EC('secp256k1');

export interface WalletData {
  address: string;
  privateKey: string;
  mnemonic: string;
  accountIndex?: number; // For HD wallet account index
}

export interface EncryptedWallet {
  encryptedMnemonic: string;
  address: string;
  salt: string;
  accountIndex?: number; // For HD wallet account index
}

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

export interface NFTInfo {
  symbol: string;
  name: string;
  address: string;
  tokenId: string;
  tokenURI?: string;
  imageUrl?: string;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  icon?: string;
  color?: string;
}

// Network configurations
export const NETWORKS: Record<string, NetworkConfig> = {
  'base-sepolia': {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: '/api/rpc-proxy', // Use proxy to hide API keys
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    },
    icon: '🔵',
    color: '#0052FF'
  },
  'ethereum-sepolia': {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: '/api/rpc-proxy', // Use proxy to hide API keys
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    },
    icon: '🔷',
    color: '#627EEA'
  }
};

// Default tokens for each network
export const DEFAULT_TOKENS: Record<string, TokenInfo[]> = {
  'base-sepolia': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000', // Native token
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x7c6b91D9Be155A5DbC1B0008DAD0Ceed320c82A1', // Base Sepolia USDT
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png'
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
      decimals: 8,
      logoURI: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png'
    }
  ],
  'ethereum-sepolia': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000', // Native token
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x7169D38820dfd117C3FA1f22a697dba58d90BA06', // Sepolia USDT
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png'
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // Sepolia WETH
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
    }
  ]
};

// Current network state
export let currentNetwork = 'base-sepolia';

// Network management functions
export function setCurrentNetwork(network: string): void {
  if (NETWORKS[network]) {
    currentNetwork = network;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('currentNetwork', network);
    }
  }
}

export function getCurrentNetwork(): string {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('currentNetwork');
    return stored && NETWORKS[stored] ? stored : 'base-sepolia';
  }
  return 'base-sepolia';
}

export function getCurrentNetworkConfig(): NetworkConfig {
  const network = getCurrentNetwork();
  return NETWORKS[network];
}

// Initialize current network from localStorage
export function initializeNetwork(): void {
  currentNetwork = getCurrentNetwork();
}

// Generate a new wallet with mnemonic (without ethers.js)
export function generateNewWallet(accountIndex: number = 0): WalletData {
  try {
    console.log('Starting wallet generation...');
    
    const mnemonic = bip39.generateMnemonic(256); // 24 words
    
    // Generate seed from mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    
    // Create HD wallet
    const hdWallet = hdkey.fromMasterSeed(seed);
    console.log('HD wallet created');
    
    // Derive the account (m/44'/60'/0'/0/{accountIndex})
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const childKey = hdWallet.derive(path);
    console.log('Child key derived');
    
    if (!childKey.privateKey) {
      throw new Error('Failed to derive private key');
    }
    const privateKey = childKey.privateKey.toString('hex');
    console.log('Private key:', privateKey.substring(0, 10) + '...');
    console.log('Private key length:', privateKey.length);
    console.log('Private key type:', typeof privateKey);
    
    // Derive address from private key
    console.log('Deriving address from private key...');
    const address = deriveAddress(privateKey);
    console.log('Address derived:', address);
    
    return {
      address: address,
      privateKey: privateKey,
      mnemonic: mnemonic,
      accountIndex: accountIndex
    };
  } catch (error) {
    console.error('Error in generateNewWallet:', error);
    throw error;
  }
}

// Import wallet from mnemonic (without ethers.js)
export function importWalletFromMnemonic(mnemonic: string, accountIndex: number = 0): WalletData {
  // Validate mnemonic
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }
  
  // Generate seed from mnemonic
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  
  // Create HD wallet
  const hdWallet = hdkey.fromMasterSeed(seed);
  
  // Derive the account (m/44'/60'/0'/0/{accountIndex})
  const path = `m/44'/60'/0'/0/${accountIndex}`;
  const childKey = hdWallet.derive(path);
  if (!childKey.privateKey) {
    throw new Error('Failed to derive private key');
  }
  const privateKey = childKey.privateKey.toString('hex');
  
  // Derive address from private key
  const address = deriveAddress(privateKey);
  
  return {
    address: address,
    privateKey: privateKey,
    mnemonic: mnemonic,
    accountIndex: accountIndex
  };
}

// Derive additional accounts from existing mnemonic
export function deriveAccountFromMnemonic(mnemonic: string, accountIndex: number): WalletData {
  return importWalletFromMnemonic(mnemonic, accountIndex);
}

// Get all accounts from a mnemonic (up to a limit)
export function getAllAccountsFromMnemonic(mnemonic: string, maxAccounts: number = 10): WalletData[] {
  const accounts: WalletData[] = [];
  
  for (let i = 0; i < maxAccounts; i++) {
    try {
      const account = importWalletFromMnemonic(mnemonic, i);
      accounts.push(account);
    } catch (error) {
      console.error(`Failed to derive account ${i}:`, error);
      break;
    }
  }
  
  return accounts;
}

// Encrypt mnemonic with password
export function encryptMnemonic(mnemonic: string, password: string, address: string, accountIndex: number = 0): EncryptedWallet {
  try {
    console.log('encryptMnemonic called with:', { 
      mnemonicLength: mnemonic.length, 
      passwordLength: password.length, 
      address: address,
      accountIndex: accountIndex
    });
    
    const salt = CryptoJS.lib.WordArray.random(128/8).toString();
    console.log('Salt generated:', salt);
    
    const key = CryptoJS.PBKDF2(password, salt, { keySize: 256/32 });
    console.log('Key generated');
    console.log('Key type:', typeof key);
    console.log('Key object:', key);
    console.log('Key toString:', key.toString());
    
    // Convert key to proper format for AES encryption
    const keyString = key.toString();
    console.log('Key string for AES:', keyString);
    
    const encrypted = CryptoJS.AES.encrypt(mnemonic, keyString).toString();
    console.log('Mnemonic encrypted');
    
    const result = {
      encryptedMnemonic: encrypted,
      address: address,
      salt: salt,
      accountIndex: accountIndex
    };
    
    console.log('Encrypted wallet created');
    return result;
  } catch (error) {
    console.error('Error in encryptMnemonic:', error);
    throw error;
  }
}

// Decrypt mnemonic with password
export function decryptMnemonic(encryptedWallet: EncryptedWallet, password: string): string {
  const key = CryptoJS.PBKDF2(password, encryptedWallet.salt, { keySize: 256/32 });
  const keyString = key.toString();
  const decrypted = CryptoJS.AES.decrypt(encryptedWallet.encryptedMnemonic, keyString);
  const mnemonic = decrypted.toString(CryptoJS.enc.Utf8);
  
  if (!mnemonic) {
    throw new Error('Invalid password');
  }
  
  return mnemonic;
}

// Store encrypted wallet in localStorage
export function storeEncryptedWallet(encryptedWallet: EncryptedWallet): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const wallets = getStoredWallets();
    // Check if wallet with same address already exists
    const existingIndex = wallets.findIndex(w => w.address.toLowerCase() === encryptedWallet.address.toLowerCase());
    if (existingIndex >= 0) {
      wallets[existingIndex] = encryptedWallet; // Update existing wallet
    } else {
      wallets.push(encryptedWallet); // Add new wallet
    }
    localStorage.setItem('encryptedWallets', JSON.stringify(wallets));
  }
}

// Get all stored encrypted wallets
export function getStoredWallets(): EncryptedWallet[] {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('encryptedWallets');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
}

// Remove wallet from storage
export function removeStoredWallet(address: string): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const wallets = getStoredWallets();
    const filtered = wallets.filter(w => w.address.toLowerCase() !== address.toLowerCase());
    localStorage.setItem('encryptedWallets', JSON.stringify(filtered));
  }
}

// Recover wallet from encrypted storage
export function recoverWallet(address: string, password: string): WalletData {
  const wallets = getStoredWallets();
  const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
  
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  try {
    const mnemonic = decryptMnemonic(wallet, password);
    return importWalletFromMnemonic(mnemonic, wallet.accountIndex || 0);
  } catch {
    throw new Error('Invalid password');
  }
}

// Get wallet addresses from storage
export function getStoredWalletAddresses(): string[] {
  const wallets = getStoredWallets();
  return wallets.map(w => w.address);
}

// Get wallet info from storage
export function getStoredWalletInfo(): Array<{ address: string; accountIndex: number }> {
  const wallets = getStoredWallets();
  return wallets.map(w => ({ 
    address: w.address, 
    accountIndex: w.accountIndex || 0 
  }));
}

// Token management
export function addCustomToken(tokenInfo: TokenInfo): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const tokens = getCustomTokens();
    // Check if token already exists
    const existingIndex = tokens.findIndex(t => t.address.toLowerCase() === tokenInfo.address.toLowerCase());
    if (existingIndex >= 0) {
      tokens[existingIndex] = tokenInfo; // Update existing token
    } else {
      tokens.push(tokenInfo); // Add new token
    }
    localStorage.setItem('customTokens', JSON.stringify(tokens));
  }
}

export function getCustomTokens(): TokenInfo[] {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('customTokens');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
}

export function removeCustomToken(address: string): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const tokens = getCustomTokens();
    const filtered = tokens.filter(t => t.address.toLowerCase() !== address.toLowerCase());
    localStorage.setItem('customTokens', JSON.stringify(filtered));
  }
}


// NFT management
export function addCustomNFT(nftInfo: NFTInfo): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const nfts = getCustomNFTs();
    // Check if NFT already exists
    const existingIndex = nfts.findIndex(n => 
      n.address.toLowerCase() === nftInfo.address.toLowerCase() && 
      n.tokenId === nftInfo.tokenId
    );
    if (existingIndex >= 0) {
      nfts[existingIndex] = nftInfo; // Update existing NFT
    } else {
      nfts.push(nftInfo); // Add new NFT
    }
    localStorage.setItem('customNFTs', JSON.stringify(nfts));
  }
}

export function getCustomNFTs(): NFTInfo[] {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('customNFTs');
    return stored ? JSON.parse(stored) : [];
  }
  return [];
}

export function removeCustomNFT(address: string, tokenId: string): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const nfts = getCustomNFTs();
    const filtered = nfts.filter(n => 
      !(n.address.toLowerCase() === address.toLowerCase() && n.tokenId === tokenId)
    );
    localStorage.setItem('customNFTs', JSON.stringify(filtered));
  }
}

// Initialize default tokens for current network
export function initializeDefaultTokens(): void {
  const network = getCurrentNetwork();
  const existingTokens = getCustomTokens();
  
  // Get default tokens for current network
  const defaultTokens = DEFAULT_TOKENS[network] || DEFAULT_TOKENS['base-sepolia'];
  
  console.log(`Initializing default tokens for network ${network}:`, defaultTokens.map(t => t.symbol));
  
  // Add default tokens that don't already exist
  defaultTokens.forEach(token => {
    const exists = existingTokens.some(existing => 
      existing.address.toLowerCase() === token.address.toLowerCase() ||
      (existing.symbol === token.symbol && existing.address === '0x0000000000000000000000000000000000000000')
    );
    if (!exists) {
      console.log(`Adding default token: ${token.symbol} (${token.address})`);
      addCustomToken(token);
    } else {
      console.log(`Default token already exists: ${token.symbol}`);
    }
  });
}

// Clear tokens that don't belong to the current network
export function clearNetworkTokens(): void {
  const network = getCurrentNetwork();
  const existingTokens = getCustomTokens();
  const defaultTokens = DEFAULT_TOKENS[network] || DEFAULT_TOKENS['base-sepolia'];
  
  // Keep only tokens that are in the default tokens for current network
  const validTokens = existingTokens.filter(token => {
    // Always keep native ETH token
    if (token.address === '0x0000000000000000000000000000000000000000') {
      return true;
    }
    
    // Check if token exists in default tokens for current network
    return defaultTokens.some(defaultToken => 
      defaultToken.address.toLowerCase() === token.address.toLowerCase()
    );
  });
  
  // Update localStorage with valid tokens only
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem('customTokens', JSON.stringify(validTokens));
    console.log(`Cleared tokens for network ${network}. Kept ${validTokens.length} tokens.`);
  }
}

// Migrate stored tokens to use new URLs (remove old cryptologos.cc URLs)
export function migrateStoredTokens(): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const tokens = getCustomTokens();
    let hasChanges = false;
    
    const updatedTokens = tokens.map(token => {
      // If token has old cryptologos.cc URL, remove it to force refetch
      if (token.logoURI && token.logoURI.includes('cryptologos.cc')) {
        hasChanges = true;
        return {
          ...token,
          logoURI: undefined // Remove old URL to force refetch
        };
      }
      return token;
    });
    
    if (hasChanges) {
      localStorage.setItem('customTokens', JSON.stringify(updatedTokens));
      console.log('Migrated stored tokens to remove old cryptologos.cc URLs');
    }
  }
}

// Get ETH balance for an address on current network
export async function getEthBalance(address: string): Promise<string> {
  try {
    const networkConfig = getCurrentNetworkConfig();
    const currentNetwork = getCurrentNetwork();
    
    const response = await fetch('/api/rpc-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network: currentNetwork,
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
    });
    
    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    // Convert from hex to decimal
    if (!data.result) {
      throw new Error('No result from RPC call');
    }
    const balanceWei = BigInt(data.result);
    const balanceEth = Number(balanceWei) / Math.pow(10, 18);
    return balanceEth.toFixed(6);
  } catch (error) {
    console.error('Error fetching balance:', error);
    return '0.000000';
  }
}

import { requestManager } from './requestManager';
import { coingeckoService } from './coingeckoService';
import { getFallbackImage } from './fallbackData';

// Token image fetching function with CoinGecko integration
export async function getTokenImage(symbol: string, address: string): Promise<string | undefined> {
  try {
    // First try CoinGecko API for better quality images
    const coingeckoImage = await coingeckoService.getTokenImageByContract(address);
    if (coingeckoImage) {
      return coingeckoImage;
    }
    
    // Fallback to existing image fetching method
    const fallbackImage = await requestManager.getImageUrl(symbol, address);
    if (fallbackImage) {
      return fallbackImage;
    }
    
    // Final fallback to our default images
    return getFallbackImage(address);
  } catch (error) {
    console.error('Error fetching token image:', error);
    // Return fallback image
    return getFallbackImage(address);
  }
}

// Function to clear image cache (useful for debugging)
export function clearImageCache(): void {
  requestManager.clearImageCache();
}

// Enhanced token info with image
export interface TokenInfoWithImage extends TokenInfo {
  imageUrl?: string;
}

// Legacy support - keep for backward compatibility
export const BASE_SEPOLIA_CONFIG = NETWORKS['base-sepolia'];
export const DEFAULT_TOKENS_LEGACY = DEFAULT_TOKENS['base-sepolia'];
