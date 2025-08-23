import { ethers } from 'ethers';

export interface TransactionEvent {
  type: 'sent' | 'received';
  tokenSymbol: string;
  amount: string;
  from: string;
  to: string;
  txHash: string;
  timestamp: number;
}

export interface BalanceUpdateEvent {
  address: string;
  tokenAddress?: string;
  newBalance: string;
  timestamp: number;
}

export type TransactionEventCallback = (event: TransactionEvent) => void;
export type BalanceUpdateEventCallback = (event: BalanceUpdateEvent) => void;

class BlockchainEventService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private transactionListeners: TransactionEventCallback[] = [];
  private balanceListeners: BalanceUpdateEventCallback[] = [];
  private isListening: boolean = false;
  private currentAddress: string | null = null;
  private currentNetwork: string | null = null;

  // Initialize provider for a network - we'll use fetch directly instead
  private async makeRPCRequest(network: string, method: string, params: unknown[] = []): Promise<unknown> {
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

  // Start listening for events
  public startListening(address: string, network: string, _rpcUrl: string) {
    if (this.isListening && this.currentAddress === address && this.currentNetwork === network) {
      return; // Already listening to the same address and network
    }

    this.stopListening();
    
    this.currentAddress = address;
    this.currentNetwork = network;
    this.isListening = true;

    // Use polling instead of WebSocket events to work with our proxy
    // Check for new blocks every 30 seconds
    setInterval(async () => {
      try {
        await this.checkForNewBlocks(address);
      } catch (error) {
        console.error('Error checking for new blocks:', error);
      }
    }, 30000); // Check every 30 seconds

    console.log(`Started listening for events on address: ${address} on network: ${network}`);
  }

  // Stop listening for events
  public stopListening() {
    if (!this.isListening) return;

    this.providers.forEach(provider => {
      provider.removeAllListeners();
    });

    this.isListening = false;
    this.currentAddress = null;
    this.currentNetwork = null;
    console.log('Stopped listening for blockchain events');
  }

  // Check for new blocks and transactions
  private async checkForNewBlocks(address: string) {
    try {
      // Get the latest block number
      const latestBlockHex = await this.makeRPCRequest(this.currentNetwork!, 'eth_blockNumber', []) as string;
      const _latestBlockNumber = parseInt(latestBlockHex, 16);
      
      // Get the block details
      const block = await this.makeRPCRequest(this.currentNetwork!, 'eth_getBlockByNumber', [latestBlockHex, true]) as { transactions?: unknown[] };
      if (!block || !block.transactions) return;

      for (const tx of block.transactions) {
        // Check if this transaction involves our address
        const transaction = tx as { from?: string; to?: string };
        if (transaction.from?.toLowerCase() === address.toLowerCase() || 
            transaction.to?.toLowerCase() === address.toLowerCase()) {
          
          await this.processTransactionFromBlock(tx as { hash: string; to?: string; from?: string; input?: string }, address);
        }
      }
    } catch (error) {
      console.error('Error checking for new blocks:', error);
    }
  }

  // Check for transactions in the latest block
  private async checkForTransactions(provider: ethers.JsonRpcProvider, address: string, blockNumber: number) {
    try {
      const block = await provider.getBlock(blockNumber, true);
      if (!block || !block.transactions) return;

      for (const tx of block.transactions) {
        if (typeof tx === 'string') continue; // Skip transaction hashes

        // Check if this transaction involves our address
        if ((tx as ethers.TransactionResponse).from?.toLowerCase() === address.toLowerCase() || 
            (tx as ethers.TransactionResponse).to?.toLowerCase() === address.toLowerCase()) {
          
          await this.processTransaction(provider, tx as ethers.TransactionResponse, address);
        }
      }
    } catch (error) {
      console.error('Error checking block for transactions:', error);
    }
  }

  // Check for pending transactions that might be incoming
  private async checkPendingTransactions(provider: ethers.JsonRpcProvider, address: string) {
    try {
      // Get pending transactions from the mempool
      const pendingTxs = await provider.send('txpool_content', []);
      
      if (pendingTxs && pendingTxs.pending) {
        for (const [, txs] of Object.entries(pendingTxs.pending)) {
          for (const [, tx] of Object.entries(txs as Record<string, unknown>)) {
            const transaction = tx as Record<string, unknown>;
            
            // Check if this transaction is coming to our address
            if (transaction.to && typeof transaction.to === 'string' && transaction.to.toLowerCase() === address.toLowerCase()) {
              console.log('Found pending incoming transaction:', transaction.hash);
              // We'll process it when it gets mined
            }
          }
        }
      }
    } catch (error) {
      // Some RPC providers don't support txpool_content, so we'll ignore this error
      console.debug('Could not check pending transactions:', error);
    }
  }

  // Process a transaction from block data
  private async processTransactionFromBlock(tx: { hash: string; to?: string; from?: string; input?: string }, address: string) {
    try {
      const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
      const isOutgoing = tx.from?.toLowerCase() === address.toLowerCase();

      if (!isIncoming && !isOutgoing) return;

      // Get transaction receipt using proxy
      const receipt = await this.makeRPCRequest(this.currentNetwork!, 'eth_getTransactionReceipt', [tx.hash]) as { status: string };
      if (!receipt || receipt.status !== '0x1') return; // Transaction failed

      // Check if it's a token transfer (has input data)
      if (tx.input && tx.input !== '0x') {
        await this.processTokenTransferFromBlock(tx, receipt, address, isIncoming);
      } else {
        // Native token transfer (ETH, etc.)
        await this.processNativeTransferFromBlock(tx, address, isIncoming);
      }

      // Emit balance update event
      this.emitBalanceUpdate(address);
    } catch (error) {
      console.error('Error processing transaction from block:', error);
    }
  }

  // Process a transaction and emit events
  private async processTransaction(provider: ethers.JsonRpcProvider, tx: ethers.TransactionResponse, address: string) {
    try {
      const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
      const isOutgoing = tx.from?.toLowerCase() === address.toLowerCase();

      if (!isIncoming && !isOutgoing) return;

      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(tx.hash);
      if (!receipt || receipt.status !== 1) return; // Transaction failed

      // Check if it's a token transfer (has input data)
      if (tx.data && tx.data !== '0x') {
        await this.processTokenTransfer(provider, tx, receipt, address, isIncoming);
      } else {
        // Native token transfer (ETH, etc.)
        await this.processNativeTransfer(tx, address, isIncoming);
      }

      // Emit balance update event
      this.emitBalanceUpdate(address);
    } catch (error) {
      console.error('Error processing transaction:', error);
    }
  }

  // Process token transfers (ERC20, ERC721)
  private async processTokenTransfer(
    provider: ethers.JsonRpcProvider, 
    tx: ethers.TransactionResponse, 
    receipt: ethers.TransactionReceipt, 
    address: string, 
    isIncoming: boolean
  ) {
    try {
      // Parse transaction data to determine token type and amount
      const data = tx.data;
      
      // ERC20 transfer: 0xa9059cbb (transfer function)
      if (data.startsWith('0xa9059cbb')) {
        await this.processERC20Transfer(provider, tx, address, isIncoming);
      }
      // ERC721 transfer: 0x23b872dd (transferFrom function)
      else if (data.startsWith('0x23b872dd')) {
        await this.processERC721Transfer(provider, tx, address, isIncoming);
      }
    } catch (error) {
      console.error('Error processing token transfer:', error);
    }
  }

  // Process ERC20 token transfers
  private async processERC20Transfer(
    provider: ethers.JsonRpcProvider, 
    tx: ethers.TransactionResponse, 
    address: string, 
    isIncoming: boolean
  ) {
    try {
      const tokenAddress = tx.to!;
      
      // Get token contract
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'],
        provider
      );

      // Parse transfer data
      const data = tx.data;
      const toAddress = '0x' + data.slice(34, 74); // Extract 'to' address
      const amountHex = data.slice(74); // Extract amount
      const amount = ethers.formatUnits(amountHex, 18); // Assume 18 decimals for now

      // Get token symbol
      let symbol = 'Unknown';
      try {
        symbol = await tokenContract.symbol();
      } catch (error) {
        console.warn('Could not get token symbol:', error);
      }

      // Emit transaction event
      const event: TransactionEvent = {
        type: isIncoming ? 'received' : 'sent',
        tokenSymbol: symbol,
        amount: amount,
        from: tx.from!,
        to: toAddress,
        txHash: tx.hash,
        timestamp: Date.now()
      };

      this.emitTransactionEvent(event);
    } catch (error) {
      console.error('Error processing ERC20 transfer:', error);
    }
  }

  // Process ERC721 token transfers
  private async processERC721Transfer(
    provider: ethers.JsonRpcProvider, 
    tx: ethers.TransactionResponse, 
    address: string, 
    isIncoming: boolean
  ) {
    try {
      const tokenAddress = tx.to!;
      
      // Get token contract
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function symbol() view returns (string)'],
        provider
      );

      // Parse transfer data
      const data = tx.data;
      const fromAddress = '0x' + data.slice(34, 74); // Extract 'from' address
      const toAddress = '0x' + data.slice(98, 138); // Extract 'to' address
      const tokenIdHex = data.slice(138); // Extract tokenId
      const tokenId = ethers.formatUnits(tokenIdHex, 0);

      // Get token symbol
      let symbol = 'Unknown NFT';
      try {
        symbol = await tokenContract.symbol();
      } catch (error) {
        console.warn('Could not get NFT symbol:', error);
      }

      // Emit transaction event
      const event: TransactionEvent = {
        type: isIncoming ? 'received' : 'sent',
        tokenSymbol: `${symbol} #${tokenId}`,
        amount: tokenId,
        from: fromAddress,
        to: toAddress,
        txHash: tx.hash,
        timestamp: Date.now()
      };

      this.emitTransactionEvent(event);
    } catch (error) {
      console.error('Error processing ERC721 transfer:', error);
    }
  }

  // Process native token transfers from block data
  private async processNativeTransferFromBlock(
    tx: { value?: string; from?: string; to?: string; hash: string }, 
    address: string, 
    isIncoming: boolean
  ) {
    const amount = ethers.formatEther(tx.value || '0x0');
    const networkSymbol = this.currentNetwork === 'base-sepolia' ? 'ETH' : 'ETH';

    const event: TransactionEvent = {
      type: isIncoming ? 'received' : 'sent',
      tokenSymbol: networkSymbol,
      amount: amount,
      from: tx.from || '',
      to: tx.to || '',
      txHash: tx.hash,
      timestamp: Date.now()
    };

    this.emitTransactionEvent(event);
  }

  // Process token transfers from block data
  private async processTokenTransferFromBlock(
    tx: { input?: string; to?: string; from?: string; hash: string }, 
    receipt: { status: string }, 
    address: string, 
    isIncoming: boolean
  ) {
    try {
      // Parse transaction data to determine token type and amount
      const data = tx.input || '0x';
      
      // ERC20 transfer: 0xa9059cbb (transfer function)
      if (data.startsWith('0xa9059cbb')) {
        await this.processERC20TransferFromBlock(tx, address, isIncoming);
      }
      // ERC721 transfer: 0x23b872dd (transferFrom function)
      else if (data.startsWith('0x23b872dd')) {
        await this.processERC721TransferFromBlock(tx, address, isIncoming);
      }
    } catch (error) {
      console.error('Error processing token transfer from block:', error);
    }
  }

  // Process ERC20 token transfers from block data
  private async processERC20TransferFromBlock(
    tx: { input?: string; to?: string; from?: string; hash: string }, 
    address: string, 
    isIncoming: boolean
  ) {
    try {
      const tokenAddress = tx.to || '';
      
      // Parse transfer data
      const data = tx.input || '0x';
      const toAddress = '0x' + data.slice(34, 74); // Extract 'to' address
      const amountHex = data.slice(74); // Extract amount
      const amount = ethers.formatUnits('0x' + amountHex, 18); // Assume 18 decimals for now

      // Get token symbol using proxy
      let symbol = 'Unknown';
      try {
        const symbolHex = await this.makeRPCRequest(this.currentNetwork!, 'eth_call', [{
          to: tokenAddress,
          data: '0x95d89b41' // symbol()
        }, 'latest']) as string;
        symbol = ethers.AbiCoder.defaultAbiCoder().decode(['string'], symbolHex)[0];
      } catch (error) {
        console.warn('Could not get token symbol:', error);
      }

      // Emit transaction event
      const event: TransactionEvent = {
        type: isIncoming ? 'received' : 'sent',
        tokenSymbol: symbol,
        amount: amount,
        from: tx.from || '',
        to: toAddress,
        txHash: tx.hash,
        timestamp: Date.now()
      };

      this.emitTransactionEvent(event);
    } catch (error) {
      console.error('Error processing ERC20 transfer from block:', error);
    }
  }

  // Process ERC721 token transfers from block data
  private async processERC721TransferFromBlock(
    tx: { input?: string; to?: string; from?: string; hash: string }, 
    address: string, 
    isIncoming: boolean
  ) {
    try {
      const tokenAddress = tx.to || '';
      
      // Parse transfer data
      const data = tx.input || '0x';
      const fromAddress = '0x' + data.slice(34, 74); // Extract 'from' address
      const toAddress = '0x' + data.slice(98, 138); // Extract 'to' address
      const tokenIdHex = data.slice(138); // Extract tokenId
      const tokenId = ethers.formatUnits('0x' + tokenIdHex, 0);

      // Get token symbol using proxy
      let symbol = 'Unknown NFT';
      try {
        const symbolHex = await this.makeRPCRequest(this.currentNetwork!, 'eth_call', [{
          to: tokenAddress,
          data: '0x95d89b41' // symbol()
        }, 'latest']) as string;
        symbol = ethers.AbiCoder.defaultAbiCoder().decode(['string'], symbolHex)[0];
      } catch (error) {
        console.warn('Could not get NFT symbol:', error);
      }

      // Emit transaction event
      const event: TransactionEvent = {
        type: isIncoming ? 'received' : 'sent',
        tokenSymbol: `${symbol} #${tokenId}`,
        amount: tokenId,
        from: fromAddress,
        to: toAddress,
        txHash: tx.hash,
        timestamp: Date.now()
      };

      this.emitTransactionEvent(event);
    } catch (error) {
      console.error('Error processing ERC721 transfer from block:', error);
    }
  }

  // Process native token transfers (ETH, etc.)
  private async processNativeTransfer(
    tx: ethers.TransactionResponse, 
    address: string, 
    isIncoming: boolean
  ) {
    const amount = ethers.formatEther(tx.value);
    const networkSymbol = this.currentNetwork === 'base-sepolia' ? 'ETH' : 'ETH';

    const event: TransactionEvent = {
      type: isIncoming ? 'received' : 'sent',
      tokenSymbol: networkSymbol,
      amount: amount,
      from: tx.from!,
      to: tx.to!,
      txHash: tx.hash,
      timestamp: Date.now()
    };

    this.emitTransactionEvent(event);
  }

  // Emit transaction event to all listeners
  private emitTransactionEvent(event: TransactionEvent) {
    this.transactionListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in transaction event callback:', error);
      }
    });
  }

  // Emit balance update event to all listeners
  private emitBalanceUpdate(address: string) {
    const event: BalanceUpdateEvent = {
      address,
      newBalance: '0', // Will be updated by the wallet context
      timestamp: Date.now()
    };

    this.balanceListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in balance event callback:', error);
      }
    });
  }

  // Subscribe to transaction events
  public subscribeToTransactions(callback: TransactionEventCallback) {
    this.transactionListeners.push(callback);
  }

  // Unsubscribe from transaction events
  public unsubscribeFromTransactions(callback: TransactionEventCallback) {
    const index = this.transactionListeners.indexOf(callback);
    if (index > -1) {
      this.transactionListeners.splice(index, 1);
    }
  }

  // Subscribe to balance events
  public subscribeToBalanceUpdates(callback: BalanceUpdateEventCallback) {
    this.balanceListeners.push(callback);
  }

  // Unsubscribe from balance events
  public unsubscribeFromBalanceUpdates(callback: BalanceUpdateEventCallback) {
    const index = this.balanceListeners.indexOf(callback);
    if (index > -1) {
      this.balanceListeners.splice(index, 1);
    }
  }

  // Manually trigger a balance check
  public async triggerBalanceCheck(address: string) {
    this.emitBalanceUpdate(address);
  }
}

// Export singleton instance
export const blockchainEventService = new BlockchainEventService();
