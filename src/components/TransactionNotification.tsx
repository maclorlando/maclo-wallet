'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@/lib/walletContext';
import { blockchainEventService, TransactionEvent } from '@/lib/blockchainEvents';
import { balanceMonitor, BalanceChangeEvent } from '@/lib/balanceMonitor';
import { useToast } from '@/hooks/useToast';

export default function TransactionNotification() {
  const { currentWallet } = useWallet();
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (!currentWallet?.address) return;

    const handleTransaction = (event: TransactionEvent) => {
      console.log('Transaction notification received:', event);
      
      // Show notification for received transactions
      if (event.type === 'received') {
        toast({
          variant: 'success',
          title: '🎉 Token Received!',
          description: `You received ${event.amount} ${event.tokenSymbol}`,
        });
      }
      // Show notification for sent transactions
      else if (event.type === 'sent') {
        toast({
          variant: 'info',
          title: '📤 Token Sent!',
          description: `You sent ${event.amount} ${event.tokenSymbol}`,
        });
      }
    };

    const handleBalanceChange = (event: BalanceChangeEvent) => {
      console.log('Balance change notification received:', event);
      
      // Show notification for received tokens (when balance increases)
      if (event.type === 'TOKEN' && parseFloat(event.newBalance) > parseFloat(event.oldBalance)) {
        const amountReceived = parseFloat(event.newBalance) - parseFloat(event.oldBalance);
        const tokenSymbol = event.tokenSymbol || 'Unknown';
        const tokenName = event.tokenName || 'Unknown Token';
        
        toast({
          variant: 'success',
          title: '🎉 Token Received!',
          description: `You received ${amountReceived.toFixed(6)} ${tokenSymbol} (${tokenName})`,
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
    setIsListening(true);

    return () => {
      blockchainEventService.unsubscribeFromTransactions(handleTransaction);
      balanceMonitor.unsubscribe(handleBalanceChange);
      setIsListening(false);
    };
  }, [currentWallet?.address, toast]);

  // This component doesn't render anything visible
  return null;
}
