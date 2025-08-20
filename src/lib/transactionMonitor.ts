import { ethers } from 'ethers';

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  blockNumber?: number;
  timestamp: number;
}

export interface TransactionDetails {
  hash: string;
  from: string;
  to: string;
  value: string;
  data: string;
  type: 'ETH' | 'ERC20' | 'ERC721';
  tokenAddress?: string;
  tokenSymbol?: string;
  amount?: string;
}

class TransactionMonitor {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private rpcUrls: Map<string, string> = new Map(); // Store RPC URLs for each network
  private monitoredTransactions: Map<string, TransactionStatus> = new Map();
  private listeners: Map<string, (status: TransactionStatus) => void> = new Map();
  private isMonitoring: boolean = false;
  private currentAddress: string | null = null;
  private currentNetwork: string | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Initialize provider for a network
  private getProvider(network: string, rpcUrl: string): ethers.JsonRpcProvider {
    if (!this.providers.has(network)) {
      this.providers.set(network, new ethers.JsonRpcProvider(rpcUrl));
    }
    return this.providers.get(network)!;
  }

  // Start monitoring transactions for an address
  public startMonitoring(address: string, network: string, rpcUrl: string) {
    if (this.isMonitoring && this.currentAddress === address && this.currentNetwork === network) {
      return; // Already monitoring the same address and network
    }

    this.stopMonitoring();
    
    this.currentAddress = address;
    this.currentNetwork = network;
    this.rpcUrls.set(network, rpcUrl); // Store RPC URL
    this.isMonitoring = true;

    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.checkMonitoredTransactions();
    }, 3000); // Check every 3 seconds

    console.log(`Started monitoring transactions for address: ${address} on network: ${network}`);
  }

  // Stop monitoring
  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.currentAddress = null;
    this.currentNetwork = null;
    this.monitoredTransactions.clear();
    console.log('Stopped monitoring transactions');
  }

  // Add a transaction to monitor
  public async addTransactionToMonitor(
    txHash: string, 
    network: string, 
    rpcUrl: string,
    details?: TransactionDetails
  ) {
    try {
      const provider = this.getProvider(network, rpcUrl);
      
      // Add to monitored transactions
      this.monitoredTransactions.set(txHash, {
        hash: txHash,
        status: 'pending',
        confirmations: 0,
        timestamp: Date.now()
      });

      console.log(`Added transaction to monitor: ${txHash}`);

      // Immediately check the transaction status
      await this.checkTransactionStatus(txHash, provider);
    } catch (error: any) {
      console.warn(`Failed to add transaction ${txHash} to monitor:`, error?.message || 'Unknown error');
    }
  }

  // Check all monitored transactions
  private async checkMonitoredTransactions() {
    if (!this.currentAddress || !this.currentNetwork) return;

    const networkKey = this.currentNetwork;
    const rpcUrl = this.rpcUrls.get(networkKey);
    
    if (!rpcUrl) {
      console.warn('No RPC URL available for transaction monitoring');
      return;
    }

    // Get or create provider
    let provider = this.providers.get(networkKey);
    if (!provider) {
      provider = new ethers.JsonRpcProvider(rpcUrl);
      this.providers.set(networkKey, provider);
    }

    const promises = Array.from(this.monitoredTransactions.keys()).map(hash => 
      this.checkTransactionStatus(hash, provider!)
    );

    await Promise.all(promises);
  }

  // Check status of a specific transaction
  private async checkTransactionStatus(txHash: string, provider: ethers.JsonRpcProvider) {
    try {
      // Validate provider connection
      if (!provider || !provider.connection) {
        console.warn('Invalid provider for transaction status check');
        return;
      }

      const receipt = await provider.getTransactionReceipt(txHash);
      const currentStatus = this.monitoredTransactions.get(txHash);
      
      if (!currentStatus) return;

      if (receipt) {
        // Transaction has been mined
        const newStatus: TransactionStatus = {
          hash: txHash,
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          confirmations: receipt.confirmations || 0,
          blockNumber: receipt.blockNumber,
          timestamp: Date.now()
        };

        // Update status
        this.monitoredTransactions.set(txHash, newStatus);

        // Notify listeners
        this.notifyListeners(txHash, newStatus);

        // Remove from monitoring if confirmed or failed
        if (newStatus.status === 'confirmed' || newStatus.status === 'failed') {
          setTimeout(() => {
            this.monitoredTransactions.delete(txHash);
          }, 60000); // Keep for 1 minute after completion
        }
      } else {
        // Transaction still pending, check if it's been too long
        const timeSinceSubmission = Date.now() - currentStatus.timestamp;
        if (timeSinceSubmission > 300000) { // 5 minutes
          const failedStatus: TransactionStatus = {
            ...currentStatus,
            status: 'failed',
            timestamp: Date.now()
          };
          this.monitoredTransactions.set(txHash, failedStatus);
          this.notifyListeners(txHash, failedStatus);
          this.monitoredTransactions.delete(txHash);
        }
      }
    } catch (error) {
      // Handle specific RPC errors more gracefully
      if (error instanceof Error) {
        if (error.message.includes('unsupported protocol') || error.message.includes('UNSUPPORTED_OPERATION')) {
          console.warn(`RPC connection issue for transaction ${txHash}:`, error.message);
          return;
        }
      }
      console.error(`Error checking transaction status for ${txHash}:`, error);
    }
  }

  // Subscribe to transaction status updates
  public subscribe(txHash: string, callback: (status: TransactionStatus) => void) {
    this.listeners.set(txHash, callback);
  }

  // Unsubscribe from transaction status updates
  public unsubscribe(txHash: string) {
    this.listeners.delete(txHash);
  }

  // Notify listeners of status changes
  private notifyListeners(txHash: string, status: TransactionStatus) {
    const listener = this.listeners.get(txHash);
    if (listener) {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in transaction status listener:', error);
      }
    }
  }

  // Get current status of a transaction
  public getTransactionStatus(txHash: string): TransactionStatus | undefined {
    return this.monitoredTransactions.get(txHash);
  }

  // Get all monitored transactions
  public getMonitoredTransactions(): TransactionStatus[] {
    return Array.from(this.monitoredTransactions.values());
  }

  // Check if we're currently monitoring
  public isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }
}

// Export singleton instance
export const transactionMonitor = new TransactionMonitor();
