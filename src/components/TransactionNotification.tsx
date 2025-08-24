'use client';

import { useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/walletContext';
import { blockchainEventService, TransactionEvent } from '@/lib/blockchainEvents';
import { balanceMonitor, BalanceChangeEvent } from '@/lib/balanceMonitor';
import { useToast } from '@/hooks/useToast';

export default function TransactionNotification() {
  const { currentWallet } = useWallet();
  const { toast } = useToast();

  // Helper function to handle received NFTs
  const handleReceivedNFT = useCallback(async (event: TransactionEvent) => {
    if (!currentWallet) return;
    
    try {
      // Extract NFT contract address and token ID from the transaction
      const tokenId = event.amount;
      const contractAddress = event.contractAddress;
      
      if (!contractAddress) {
        console.warn('No contract address in NFT transfer event');
        return;
      }
      
      console.log(`Received NFT detected: ${event.tokenSymbol} (${contractAddress} #${tokenId})`);
      
      // The NFT will be automatically added by the Alchemy API refresh
      // We just need to show the notification
      toast({
        variant: 'success',
        title: '🎉 NFT Received!',
        description: `${event.tokenSymbol} has been added to your wallet!`,
      });
    } catch (error) {
      console.error('Error handling received NFT:', error);
    }
  }, [currentWallet, toast]);

  // Helper function to handle sent NFTs
  const handleSentNFT = useCallback(async (event: TransactionEvent) => {
    if (!currentWallet) return;
    
    try {
      const tokenId = event.amount;
      const contractAddress = event.contractAddress;
      
      if (!contractAddress) {
        console.warn('No contract address in NFT transfer event');
        return;
      }
      
      console.log(`Sent NFT detected: ${event.tokenSymbol} (${contractAddress} #${tokenId})`);
      
      // The NFT will be automatically removed by the Alchemy API refresh
      // We just need to show the notification
      toast({
        variant: 'info',
        title: '📤 NFT Sent!',
        description: `${event.tokenSymbol} has been removed from your wallet.`,
      });
    } catch (error) {
      console.error('Error handling sent NFT:', error);
    }
  }, [currentWallet, toast]);

  useEffect(() => {
    if (!currentWallet?.address) return;

    const handleTransaction = (event: TransactionEvent) => {
      console.log('Transaction notification received:', event);
      
      // Check if this is an NFT transfer (tokenSymbol contains #)
      const isNFT = event.tokenSymbol.includes('#');
      
      // Handle NFT transactions with our helper functions
      if (isNFT) {
        if (event.type === 'received') {
          handleReceivedNFT(event);
        } else if (event.type === 'sent') {
          handleSentNFT(event);
        }
      }
      // Skip ERC20 token notifications from blockchainEventService
      // These will be handled by balanceMonitor for better formatting and accuracy
      else {
        console.log(`🔄 Skipping ERC20 notification for ${event.tokenSymbol} from blockchainEventService - will be handled by balanceMonitor`);
      }
    };

    const handleBalanceChange = (event: BalanceChangeEvent) => {
      console.log('Balance change notification received:', event);
      
      // Show notification for received tokens (when balance increases)
      if (event.type === 'TOKEN' && parseFloat(event.newBalance) > parseFloat(event.oldBalance)) {
        const amountReceived = parseFloat(event.newBalance) - parseFloat(event.oldBalance);
        const tokenSymbol = event.tokenSymbol || 'Unknown';
        const tokenName = event.tokenName || 'Unknown Token';
        const decimals = event.tokenDecimals || 18;
        
        // Format the amount properly based on token decimals
        const formattedAmount = amountReceived.toFixed(decimals > 6 ? 6 : decimals);
        
        toast({
          variant: 'success',
          title: '🎉 Token Received!',
          description: `You received ${formattedAmount} ${tokenSymbol} (${tokenName})`,
        });
      }
      
      // Show notification for sent tokens (when balance decreases)
      if (event.type === 'TOKEN' && parseFloat(event.newBalance) < parseFloat(event.oldBalance)) {
        const amountSent = parseFloat(event.oldBalance) - parseFloat(event.newBalance);
        const tokenSymbol = event.tokenSymbol || 'Unknown';
        const tokenName = event.tokenName || 'Unknown Token';
        const decimals = event.tokenDecimals || 18;
        
        // Format the amount properly based on token decimals
        const formattedAmount = amountSent.toFixed(decimals > 6 ? 6 : decimals);
        
        toast({
          variant: 'info',
          title: '📤 Token Sent!',
          description: `You sent ${formattedAmount} ${tokenSymbol} (${tokenName})`,
        });
      }
      
      // Show notification for ETH received
      if (event.type === 'ETH' && parseFloat(event.newBalance) > parseFloat(event.oldBalance)) {
        const amountReceived = parseFloat(event.newBalance) - parseFloat(event.oldBalance);
        
        toast({
          variant: 'success',
          title: '🎉 ETH Received!',
          description: `You received ${amountReceived.toFixed(6)} ETH`,
        });
      }
    };

    // Subscribe to transaction events
    blockchainEventService.subscribeToTransactions(handleTransaction);
    balanceMonitor.subscribe(handleBalanceChange);

    return () => {
      blockchainEventService.unsubscribeFromTransactions(handleTransaction);
      balanceMonitor.unsubscribe(handleBalanceChange);
    };
  }, [currentWallet?.address, toast, handleReceivedNFT, handleSentNFT]);

  // This component doesn't render anything visible
  return null;
}
