import { ethers } from 'ethers';

export interface BalanceInfo {
  address: string;
  ethBalance: string;
  tokenBalances: Map<string, string>; // tokenAddress -> balance
  lastUpdated: number;
}

export interface BalanceChangeEvent {
  address: string;
  type: 'ETH' | 'TOKEN';
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
  oldBalance: string;
  newBalance: string;
  timestamp: number;
}

export type BalanceChangeCallback = (event: BalanceChangeEvent) => void;

interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
}

class BalanceMonitor {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private currentBalances: Map<string, BalanceInfo> = new Map();
  private listeners: BalanceChangeCallback[] = [];
  private isMonitoring: boolean = false;
  private currentAddress: string | null = null;
  private currentNetwork: string | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private fastMonitoringInterval: NodeJS.Timeout | null = null;
  private tokenAddresses: Set<string> = new Set();
  private tokenMetadata: Map<string, TokenMetadata> = new Map();
  private recentChangeDetected: boolean = false;

  // Initialize provider for a network
  private getProvider(network: string, rpcUrl: string): ethers.JsonRpcProvider {
    if (!this.providers.has(network)) {
      this.providers.set(network, new ethers.JsonRpcProvider(rpcUrl));
    }
    return this.providers.get(network)!;
  }

  // Start monitoring balances for an address
  public startMonitoring(address: string, network: string, rpcUrl: string, tokenAddresses: string[] = []) {
    if (this.isMonitoring && this.currentAddress === address && this.currentNetwork === network) {
      // Update token addresses if they've changed
      tokenAddresses.forEach(addr => this.tokenAddresses.add(addr));
      return;
    }

    this.stopMonitoring();
    
    this.currentAddress = address;
    this.currentNetwork = network;
    this.tokenAddresses.clear();
    tokenAddresses.forEach(addr => this.tokenAddresses.add(addr));
    this.isMonitoring = true;

    // Get initial balances and start monitoring
    this.getCurrentBalances(address, network, rpcUrl).then(() => {
      // Start monitoring interval after initial balances are loaded
      this.monitoringInterval = setInterval(() => {
        if (this.currentAddress && this.currentNetwork) {
          this.checkBalanceChanges();
        }
      }, 5000); // Check every 5 seconds to reduce API calls

      // Start fast monitoring for recent changes
      this.startFastMonitoring();
    });

    console.log(`Started monitoring balances for address: ${address} on network: ${network}`);
  }

  // Stop monitoring
  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.fastMonitoringInterval) {
      clearInterval(this.fastMonitoringInterval);
      this.fastMonitoringInterval = null;
    }
    this.isMonitoring = false;
    this.currentAddress = null;
    this.currentNetwork = null;
    this.currentBalances.clear();
    this.tokenAddresses.clear();
    this.recentChangeDetected = false;
    console.log('Stopped monitoring balances');
  }

  // Start fast monitoring when changes are detected
  private startFastMonitoring() {
    if (this.fastMonitoringInterval) {
      clearInterval(this.fastMonitoringInterval);
    }

    this.fastMonitoringInterval = setInterval(() => {
      if (this.recentChangeDetected && this.currentAddress && this.currentNetwork) {
        this.checkBalanceChanges();
        
        // Reset the flag after some time
        setTimeout(() => {
          this.recentChangeDetected = false;
        }, 30000); // Stop fast monitoring after 30 seconds
      }
    }, 2000); // Check every 2 seconds when changes are recent to reduce API calls
  }

  // Get current balances
  private async getCurrentBalances(address: string, network: string, rpcUrl: string) {
    try {
      const provider = this.getProvider(network, rpcUrl);
      
      // Get ETH balance
      const ethBalance = await provider.getBalance(address);
      const ethBalanceStr = ethers.formatEther(ethBalance);

      // Get token balances and metadata
      const tokenBalances = new Map<string, string>();
      const tokenPromises = Array.from(this.tokenAddresses).map(async (tokenAddress) => {
        try {
          // Validate token address format
          if (!ethers.isAddress(tokenAddress)) {
            console.debug(`Skipping invalid token address: ${tokenAddress}`);
            return;
          }

          // Skip zero address
          if (tokenAddress === ethers.ZeroAddress) {
            console.debug(`Skipping zero address token: ${tokenAddress}`);
            return;
          }

          const contract = new ethers.Contract(
            tokenAddress,
            [
              'function balanceOf(address) view returns (uint256)', 
              'function decimals() view returns (uint8)',
              'function symbol() view returns (string)',
              'function name() view returns (string)'
            ],
            provider
          );
          
          // Get balance first
          const balance = await contract.balanceOf(address);
          
          // Get decimals with fallback
          let decimals = 18;
          try {
            decimals = await contract.decimals();
          } catch (decimalsError: unknown) {
            const errorMessage = decimalsError instanceof Error ? decimalsError.message : 'Unknown error';
            console.debug(`Using default decimals (18) for token ${tokenAddress}:`, errorMessage);
          }
          
          // Get symbol and name with fallbacks
          let symbol = 'Unknown';
          let name = 'Unknown Token';
          
          try {
            symbol = await contract.symbol();
          } catch (symbolError: unknown) {
            const errorMessage = symbolError instanceof Error ? symbolError.message : 'Unknown error';
            console.debug(`Using default symbol for token ${tokenAddress}:`, errorMessage);
          }
          
          try {
            name = await contract.name();
          } catch (nameError: unknown) {
            const errorMessage = nameError instanceof Error ? nameError.message : 'Unknown error';
            console.debug(`Using default name for token ${tokenAddress}:`, errorMessage);
          }
         
          // Store token metadata
          this.tokenMetadata.set(tokenAddress, {
            symbol,
            name,
            decimals
          });
          
          const formattedBalance = ethers.formatUnits(balance, decimals);
          tokenBalances.set(tokenAddress, formattedBalance);
        } catch (error: unknown) {
          // Handle specific error types
          const errorMessage = error instanceof Error ? error.message : '';
          
          if (errorMessage.includes('ENS') || 
              errorMessage.includes('network does not support') ||
              errorMessage.includes('could not decode result data') ||
              errorMessage.includes('bad address checksum') ||
              errorMessage.includes('BAD_DATA')) {
            console.debug(`Skipping token ${tokenAddress} due to contract/network limitation:`, errorMessage);
          } else {
            console.warn(`Failed to get balance for token ${tokenAddress}:`, error);
          }
          
          tokenBalances.set(tokenAddress, '0');
          // Set default metadata for failed tokens
          this.tokenMetadata.set(tokenAddress, {
            symbol: 'Unknown',
            name: 'Unknown Token',
            decimals: 18
          });
        }
      });

      await Promise.all(tokenPromises);

      // Store current balances
      this.currentBalances.set(address, {
        address,
        ethBalance: ethBalanceStr,
        tokenBalances,
        lastUpdated: Date.now()
      });

      console.log(`Initial balances loaded for ${address}:`, {
        eth: ethBalanceStr,
        tokens: Object.fromEntries(tokenBalances)
      });

    } catch (error) {
      console.error('Error getting current balances:', error);
    }
  }

  // Check for balance changes
  private async checkBalanceChanges() {
    if (!this.currentAddress || !this.currentNetwork) return;

    try {
      // Get provider from the map instead of creating a new one
      const provider = this.providers.get(this.currentNetwork);
      if (!provider) {
        console.warn('No provider available for balance monitoring');
        return;
      }

      const currentBalanceInfo = this.currentBalances.get(this.currentAddress);
      
      if (!currentBalanceInfo) return;

      // Check ETH balance
      const newEthBalance = await provider.getBalance(this.currentAddress);
      const newEthBalanceStr = ethers.formatEther(newEthBalance);

      if (newEthBalanceStr !== currentBalanceInfo.ethBalance) {
        const event: BalanceChangeEvent = {
          address: this.currentAddress,
          type: 'ETH',
          oldBalance: currentBalanceInfo.ethBalance,
          newBalance: newEthBalanceStr,
          timestamp: Date.now()
        };

        this.notifyListeners(event);
        
        // Update stored balance
        currentBalanceInfo.ethBalance = newEthBalanceStr;
        currentBalanceInfo.lastUpdated = Date.now();
        
        // Trigger fast monitoring for more frequent checks
        this.recentChangeDetected = true;
      }

      // Check token balances
      for (const tokenAddress of this.tokenAddresses) {
        try {
          // Validate token address format
          if (!ethers.isAddress(tokenAddress)) {
            console.debug(`Skipping invalid token address: ${tokenAddress}`);
            continue;
          }

          // Skip zero address
          if (tokenAddress === ethers.ZeroAddress) {
            console.debug(`Skipping zero address token: ${tokenAddress}`);
            continue;
          }

          const contract = new ethers.Contract(
            tokenAddress,
            ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
            provider
          );
          
          // Get balance first, then decimals with fallback
          const balance = await contract.balanceOf(this.currentAddress);
          let decimals = 18; // Default fallback
          
          try {
            decimals = await contract.decimals();
          } catch (decimalsError: unknown) {
            // If decimals call fails (e.g., ENS resolution), use default
            const errorMessage = decimalsError instanceof Error ? decimalsError.message : 'Unknown error';
            console.debug(`Using default decimals (18) for token ${tokenAddress}:`, errorMessage);
          }
          
          const newTokenBalance = ethers.formatUnits(balance, decimals);
          const oldTokenBalance = currentBalanceInfo.tokenBalances.get(tokenAddress) || '0';

          if (newTokenBalance !== oldTokenBalance) {
            const tokenMeta = this.tokenMetadata.get(tokenAddress);
            const event: BalanceChangeEvent = {
              address: this.currentAddress,
              type: 'TOKEN',
              tokenAddress,
              tokenSymbol: tokenMeta?.symbol || 'Unknown',
              tokenName: tokenMeta?.name || 'Unknown Token',
              oldBalance: oldTokenBalance,
              newBalance: newTokenBalance,
              timestamp: Date.now()
            };

            this.notifyListeners(event);
            
            // Update stored balance
            currentBalanceInfo.tokenBalances.set(tokenAddress, newTokenBalance);
            currentBalanceInfo.lastUpdated = Date.now();
            
            // Trigger fast monitoring for more frequent checks
            this.recentChangeDetected = true;
          }
        } catch (error: unknown) {
          // Handle specific error types
          const errorMessage = error instanceof Error ? error.message : '';
          
          if (errorMessage.includes('ENS') || 
              errorMessage.includes('network does not support') ||
              errorMessage.includes('could not decode result data') ||
              errorMessage.includes('bad address checksum') ||
              errorMessage.includes('BAD_DATA')) {
            console.debug(`Skipping token ${tokenAddress} due to contract/network limitation:`, errorMessage);
          } else {
            console.warn(`Failed to check balance for token ${tokenAddress}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Error checking balance changes:', error);
    }
  }

  // Add token to monitor
  public addTokenToMonitor(tokenAddress: string) {
    this.tokenAddresses.add(tokenAddress);
  }

  // Remove token from monitor
  public removeTokenFromMonitor(tokenAddress: string) {
    this.tokenAddresses.delete(tokenAddress);
  }

  // Subscribe to balance changes
  public subscribe(callback: BalanceChangeCallback) {
    this.listeners.push(callback);
  }

  // Unsubscribe from balance changes
  public unsubscribe(callback: BalanceChangeCallback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notify listeners of balance changes
  private notifyListeners(event: BalanceChangeEvent) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in balance change listener:', error);
      }
    });
  }

  // Get current balance info
  public getCurrentBalanceInfo(address: string): BalanceInfo | undefined {
    return this.currentBalances.get(address);
  }

  // Force refresh balances
  public async forceRefresh(address: string, network: string, rpcUrl: string) {
    await this.getCurrentBalances(address, network, rpcUrl);
  }

  // Check if currently monitoring
  public isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }
}

// Export singleton instance
export const balanceMonitor = new BalanceMonitor();
