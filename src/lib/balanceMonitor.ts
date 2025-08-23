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
  private isInitialLoad: boolean = true; // Track if this is the initial load

  // Initialize provider for a network - we'll use fetch directly instead
  private async makeRPCRequest(network: string, method: string, params: any[] = []): Promise<any> {
    const response = await fetch('/api/rpc-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ network, method, params })
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    return data.result;
  }

  // Start monitoring balances for an address
  public startMonitoring(address: string, network: string, rpcUrl: string, tokenAddresses: string[] = []) {
    // Check if we're switching networks
    const isNetworkSwitch = this.isMonitoring && this.currentAddress === address && this.currentNetwork !== network;
    
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
    
    // Set initial load flag when switching networks
    if (isNetworkSwitch) {
      this.isInitialLoad = true;
    }

    // Get initial balances and start monitoring
    this.getCurrentBalances(address, network, rpcUrl).then(() => {
      // Start monitoring interval after initial balances are loaded
      this.monitoringInterval = setInterval(() => {
        if (this.currentAddress && this.currentNetwork) {
          this.checkBalanceChanges();
        }
      }, 15000); // Check every 15 seconds to reduce API calls

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
    this.isInitialLoad = true; // Reset initial load flag
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
      // Get ETH balance using proxy
      const ethBalanceHex = await this.makeRPCRequest(network, 'eth_getBalance', [address, 'latest']);
      const ethBalance = BigInt(ethBalanceHex);
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

          // Get balance using proxy
          const balanceData = '0x70a08231' + '000000000000000000000000' + address.slice(2);
          const balanceHex = await this.makeRPCRequest(network, 'eth_call', [{
            to: tokenAddress,
            data: balanceData
          }, 'latest']);
          
          // Handle empty or invalid hex strings
          let balance: bigint;
          if (!balanceHex || balanceHex === '0x' || balanceHex === '0x0') {
            balance = BigInt(0);
          } else {
            balance = BigInt(balanceHex);
          }
          
                     // Get decimals using proxy
           let decimals = 18;
           try {
             const decimalsHex = await this.makeRPCRequest(network, 'eth_call', [{
               to: tokenAddress,
               data: '0x313ce567' // decimals()
             }, 'latest']);
             const parsedDecimals = parseInt(decimalsHex, 16);
             // Validate that we got a valid number
             if (!isNaN(parsedDecimals) && parsedDecimals >= 0 && parsedDecimals <= 255) {
               decimals = parsedDecimals;
             }
           } catch (decimalsError: unknown) {
             const errorMessage = decimalsError instanceof Error ? decimalsError.message : 'Unknown error';
             console.debug(`Using default decimals (18) for token ${tokenAddress}:`, errorMessage);
           }
          
          // Get symbol using proxy
          let symbol = 'Unknown';
          try {
            const symbolHex = await this.makeRPCRequest(network, 'eth_call', [{
              to: tokenAddress,
              data: '0x95d89b41' // symbol()
            }, 'latest']);
            symbol = ethers.AbiCoder.defaultAbiCoder().decode(['string'], symbolHex)[0];
          } catch (symbolError: unknown) {
            const errorMessage = symbolError instanceof Error ? symbolError.message : 'Unknown error';
            console.debug(`Using default symbol for token ${tokenAddress}:`, errorMessage);
          }
          
          // Get name using proxy
          let name = 'Unknown Token';
          try {
            const nameHex = await this.makeRPCRequest(network, 'eth_call', [{
              to: tokenAddress,
              data: '0x06fdde03' // name()
            }, 'latest']);
            name = ethers.AbiCoder.defaultAbiCoder().decode(['string'], nameHex)[0];
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

      // Mark initial load as complete
      this.isInitialLoad = false;

    } catch (error) {
      console.error('Error getting current balances:', error);
    }
  }

  // Check for balance changes
  private async checkBalanceChanges() {
    if (!this.currentAddress || !this.currentNetwork) return;

    try {
      const currentBalanceInfo = this.currentBalances.get(this.currentAddress);
      
      if (!currentBalanceInfo) return;

      // Check ETH balance using proxy
      const newEthBalanceHex = await this.makeRPCRequest(this.currentNetwork, 'eth_getBalance', [this.currentAddress, 'latest']);
      const newEthBalance = BigInt(newEthBalanceHex);
      const newEthBalanceStr = ethers.formatEther(newEthBalance);

      if (newEthBalanceStr !== currentBalanceInfo.ethBalance) {
        // Only notify listeners if this is not the initial load
        if (!this.isInitialLoad) {
          const event: BalanceChangeEvent = {
            address: this.currentAddress,
            type: 'ETH',
            oldBalance: currentBalanceInfo.ethBalance,
            newBalance: newEthBalanceStr,
            timestamp: Date.now()
          };

          this.notifyListeners(event);
        }
        
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

          // Get balance using proxy
          const balanceData = '0x70a08231' + '000000000000000000000000' + this.currentAddress.slice(2);
          const balanceHex = await this.makeRPCRequest(this.currentNetwork, 'eth_call', [{
            to: tokenAddress,
            data: balanceData
          }, 'latest']);
          
          // Handle empty or invalid hex strings
          let balance: bigint;
          if (!balanceHex || balanceHex === '0x' || balanceHex === '0x0') {
            balance = BigInt(0);
          } else {
            balance = BigInt(balanceHex);
          }
          
                     // Get decimals using proxy
           let decimals = 18;
           try {
             const decimalsHex = await this.makeRPCRequest(this.currentNetwork, 'eth_call', [{
               to: tokenAddress,
               data: '0x313ce567' // decimals()
             }, 'latest']);
             const parsedDecimals = parseInt(decimalsHex, 16);
             // Validate that we got a valid number
             if (!isNaN(parsedDecimals) && parsedDecimals >= 0 && parsedDecimals <= 255) {
               decimals = parsedDecimals;
             }
           } catch (decimalsError: unknown) {
             const errorMessage = decimalsError instanceof Error ? decimalsError.message : 'Unknown error';
             console.debug(`Using default decimals (18) for token ${tokenAddress}:`, errorMessage);
           }
          
          const newTokenBalance = ethers.formatUnits(balance, decimals);
          const oldTokenBalance = currentBalanceInfo.tokenBalances.get(tokenAddress) || '0';

          if (newTokenBalance !== oldTokenBalance) {
            // Only notify listeners if this is not the initial load
            if (!this.isInitialLoad) {
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
            }
            
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
