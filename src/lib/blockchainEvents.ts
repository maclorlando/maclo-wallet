import { ethers } from 'ethers';

export interface TransactionEvent {
  type: 'sent' | 'received';
  tokenSymbol: string;
  amount: string;
  from: string;
  to: string;
  txHash: string;
  timestamp: number;
  contractAddress?: string; // For NFT transfers
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
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Common token decimal mappings for better accuracy
  private readonly commonTokenDecimals: Record<string, number> = {
    // USDC has 6 decimals
    '0xa0b86a33e6441b8c4c8c8c8c8c8c8c8c8c8c8c8c': 6, // USDC on Base Sepolia
    '0x036c5230f9b0a4b0b0c0e0a4b0b0c0e0a4b0b0c0e': 6, // USDC on ETH Sepolia
    // USDT has 6 decimals
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 6, // USDT on Ethereum
    // Most other ERC20 tokens have 18 decimals
  };

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
    // Check for new blocks every 5 seconds for faster NFT detection
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewBlocks(address);
      } catch (error) {
        console.error('Error checking for new blocks:', error);
      }
    }, 5000); // Check every 5 seconds for faster NFT detection

    console.log(`Started listening for events on address: ${address} on network: ${network}`);
  }

  // Stop listening for events
  public stopListening() {
    if (!this.isListening) return;

    // Clear the monitoring interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

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
      const latestBlockNumber = parseInt(latestBlockHex, 16);
      
      // Check the last 5 blocks to catch transactions that might have been missed
      const startBlock = Math.max(0, latestBlockNumber - 4);
      
      console.log(`🔍 Checking blocks ${startBlock} to ${latestBlockNumber} for address ${address}`);
      
      for (let blockNumber = startBlock; blockNumber <= latestBlockNumber; blockNumber++) {
        const blockHex = '0x' + blockNumber.toString(16);
        const block = await this.makeRPCRequest(this.currentNetwork!, 'eth_getBlockByNumber', [blockHex, true]) as { transactions?: unknown[] };
        if (!block || !block.transactions) continue;

        console.log(`📦 Block ${blockNumber} has ${block.transactions.length} transactions`);

        for (const tx of block.transactions) {
          // Check if this transaction involves our address
          const transaction = tx as { from?: string; to?: string; hash?: string; input?: string };
          if (transaction.from?.toLowerCase() === address.toLowerCase() || 
              transaction.to?.toLowerCase() === address.toLowerCase()) {
            
            console.log(`🔍 Found transaction involving our address: ${transaction.hash || 'unknown'}`);
            console.log(`📤 From: ${transaction.from}`);
            console.log(`📥 To: ${transaction.to}`);
            console.log(`📋 Input data: ${transaction.input?.substring(0, 10)}...`);
            
            await this.processTransactionFromBlock(tx as { hash: string; to?: string; from?: string; input?: string }, address);
          }
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

      // Get token symbol and decimals
      let symbol = 'Unknown';
      let decimals = 18; // Default to 18 decimals
      
      // Check if we have a known decimal count for this token
      const normalizedTokenAddress = tokenAddress.toLowerCase();
      if (this.commonTokenDecimals[normalizedTokenAddress]) {
        decimals = this.commonTokenDecimals[normalizedTokenAddress];
        console.log(`🔍 Using known decimals for token: ${decimals}`);
      }
      
      try {
        symbol = await tokenContract.symbol();
        
        // Get token decimals (only if we don't have a known value)
        if (!this.commonTokenDecimals[normalizedTokenAddress]) {
          decimals = await tokenContract.decimals();
        }
        
        console.log(`🔍 Token ${symbol} has ${decimals} decimals`);
      } catch (error) {
        console.warn('Could not get token symbol or decimals:', error);
      }

      // Format amount with correct decimals
      const amount = ethers.formatUnits(amountHex, decimals);

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
        timestamp: Date.now(),
        contractAddress: tokenAddress
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
      
      console.log(`🔍 Processing token transfer with data: ${data.substring(0, 10)}...`);
      
      // ERC20 transfer: 0xa9059cbb (transfer function)
      if (data.startsWith('0xa9059cbb')) {
        console.log(`🪙 Detected ERC20 transfer`);
        await this.processERC20TransferFromBlock(tx, address, isIncoming);
      }
      // ERC721 transfer: 0x23b872dd (transferFrom function)
      else if (data.startsWith('0x23b872dd')) {
        console.log(`🖼️ Detected ERC721 transfer`);
        await this.processERC721TransferFromBlock(tx, address, isIncoming);
      } else {
        console.log(`❓ Unknown token transfer type`);
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

      // Get token symbol and decimals using proxy
      let symbol = 'Unknown';
      let decimals = 18; // Default to 18 decimals
      
      // Check if we have a known decimal count for this token
      const normalizedTokenAddress = tokenAddress.toLowerCase();
      if (this.commonTokenDecimals[normalizedTokenAddress]) {
        decimals = this.commonTokenDecimals[normalizedTokenAddress];
        console.log(`🔍 Using known decimals for token: ${decimals}`);
      }
      
      try {
        // Get token symbol
        const symbolHex = await this.makeRPCRequest(this.currentNetwork!, 'eth_call', [{
          to: tokenAddress,
          data: '0x95d89b41' // symbol()
        }, 'latest']) as string;
        symbol = ethers.AbiCoder.defaultAbiCoder().decode(['string'], symbolHex)[0];
        
        // Get token decimals (only if we don't have a known value)
        if (!this.commonTokenDecimals[normalizedTokenAddress]) {
          const decimalsHex = await this.makeRPCRequest(this.currentNetwork!, 'eth_call', [{
            to: tokenAddress,
            data: '0x313ce567' // decimals()
          }, 'latest']) as string;
          decimals = ethers.AbiCoder.defaultAbiCoder().decode(['uint8'], decimalsHex)[0];
        }
        
        console.log(`🔍 Token ${symbol} has ${decimals} decimals`);
      } catch (error) {
        console.warn('Could not get token symbol or decimals:', error);
      }

      // Format amount with correct decimals
      const amount = ethers.formatUnits('0x' + amountHex, decimals);

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

      console.log(`🔍 Processing NFT transfer: ${symbol} #${tokenId} from ${fromAddress} to ${toAddress}`);
      console.log(`📥 Is incoming to our address: ${isIncoming}`);
      console.log(`👤 Our address: ${address}`);
      console.log(`🔗 Transaction hash: ${tx.hash}`);
      console.log(`📋 Contract address: ${tokenAddress}`);

      // Emit transaction event
      const event: TransactionEvent = {
        type: isIncoming ? 'received' : 'sent',
        tokenSymbol: `${symbol} #${tokenId}`,
        amount: tokenId,
        from: fromAddress,
        to: toAddress,
        txHash: tx.hash,
        timestamp: Date.now(),
        contractAddress: tokenAddress
      };

      console.log(`Emitting NFT transaction event:`, event);
      this.emitTransactionEvent(event);
      
            // Trigger NFT refresh for the affected address (only once)
      if (isIncoming) {
        console.log(`Incoming NFT detected: ${symbol} #${tokenId} from ${fromAddress} to ${toAddress}`);
        // Dispatch custom event to trigger NFT refresh immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('triggerNFTRefresh', {
            detail: {
              address: address,
              contractAddress: tokenAddress
            }
          }));
        }
      } else {
        console.log(`Outgoing NFT detected: ${symbol} #${tokenId} from ${fromAddress} to ${toAddress}`);
        // For outgoing NFTs, also trigger refresh to remove from widget immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('triggerNFTRefresh', {
            detail: {
              address: address,
              contractAddress: tokenAddress
            }
          }));
        }
      }
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

  // Manually trigger a transaction check for immediate NFT detection
  public async triggerTransactionCheck(address: string) {
    if (this.currentAddress === address && this.isListening) {
      try {
        console.log(`🔍 Manual transaction check triggered for address: ${address}`);
        await this.checkForNewBlocks(address);
      } catch (error) {
        console.error('Error in manual transaction check:', error);
      }
    }
  }

  // Manually trigger NFT detection for a specific address
  public async triggerNFTDetection(address: string) {
    if (this.currentAddress === address && this.isListening) {
      try {
        console.log(`🖼️ Manual NFT detection triggered for address: ${address}`);
        await this.checkForNFTTransfers(address);
      } catch (error) {
        console.error('Error in manual NFT detection:', error);
      }
    }
  }

  // Enhanced NFT transfer detection
  public async checkForNFTTransfers(address: string, fromBlock?: number, toBlock?: number) {
    try {
      // Get the latest block if not specified
      if (!toBlock) {
        const latestBlockHex = await this.makeRPCRequest(this.currentNetwork!, 'eth_blockNumber', []) as string;
        toBlock = parseInt(latestBlockHex, 16);
      }
      
             if (!fromBlock) {
         fromBlock = Math.max(0, toBlock - 10); // Check last 10 blocks for faster detection
       }

      console.log(`Checking for NFT transfers from block ${fromBlock} to ${toBlock} for address ${address}`);

      // Check each block for NFT transfers
      for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
        const blockHex = '0x' + blockNumber.toString(16);
        const block = await this.makeRPCRequest(this.currentNetwork!, 'eth_getBlockByNumber', [blockHex, true]) as { transactions?: unknown[] };
        
        if (!block || !block.transactions) continue;

        for (const tx of block.transactions) {
          const transaction = tx as { hash: string; from?: string; to?: string; input?: string };
          
          // Check if this transaction involves our address and has NFT transfer data
          if ((transaction.from?.toLowerCase() === address.toLowerCase() || 
               transaction.to?.toLowerCase() === address.toLowerCase()) &&
              transaction.input && 
              transaction.input.startsWith('0x23b872dd')) { // ERC721 transferFrom
            
            console.log(`Found NFT transfer transaction: ${transaction.hash}`);
            await this.processTransactionFromBlock(transaction, address);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for NFT transfers:', error);
    }
  }

  // Scan for all NFT contracts that the user owns tokens from
  public async scanForOwnedNFTContracts(address: string): Promise<string[]> {
    try {
      const contractAddresses = new Set<string>();
      
      // Get the latest block
      const latestBlockHex = await this.makeRPCRequest(this.currentNetwork!, 'eth_blockNumber', []) as string;
      const latestBlock = parseInt(latestBlockHex, 16);
      
      // Check the last 100 blocks for NFT transfers involving this address
      const fromBlock = Math.max(0, latestBlock - 100);
      
      for (let blockNumber = fromBlock; blockNumber <= latestBlock; blockNumber++) {
        const blockHex = '0x' + blockNumber.toString(16);
        const block = await this.makeRPCRequest(this.currentNetwork!, 'eth_getBlockByNumber', [blockHex, true]) as { transactions?: unknown[] };
        
        if (!block || !block.transactions) continue;

        for (const tx of block.transactions) {
          const transaction = tx as { hash: string; from?: string; to?: string; input?: string };
          
          // Check if this transaction involves our address and has NFT transfer data
          if ((transaction.from?.toLowerCase() === address.toLowerCase() || 
               transaction.to?.toLowerCase() === address.toLowerCase()) &&
              transaction.input && 
              transaction.input.startsWith('0x23b872dd') && // ERC721 transferFrom
              transaction.to) {
            
            contractAddresses.add(transaction.to.toLowerCase());
          }
        }
      }
      
      return Array.from(contractAddresses);
    } catch (error) {
      console.error('Error scanning for owned NFT contracts:', error);
      return [];
    }
  }
}

// Export singleton instance
export const blockchainEventService = new BlockchainEventService();
