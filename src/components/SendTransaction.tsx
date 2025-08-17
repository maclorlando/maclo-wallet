'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/lib/walletContext';
import { 
  XMarkIcon, 
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import { 
  buildAndSendRawTx, 
  sendERC20Token, 
  sendERC721NFT 
} from '@/lib/walletUtils';
import { useToast } from '@/hooks/useToast';

interface SendTransactionProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedToken?: {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
  };
  preSelectedNFT?: {
    address: string;
    tokenId: string;
  };
}

export default function SendTransaction({ isOpen, onClose, preSelectedToken, preSelectedNFT }: SendTransactionProps) {
  const { toast } = useToast();
  const { currentWallet, currentNetworkConfig, refreshBalances, customTokens } = useWallet();
  
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transferType, setTransferType] = useState<'ETH' | 'ERC20' | 'ERC721'>('ETH');
  const [selectedToken, setSelectedToken] = useState('');
  const [nftAddress, setNftAddress] = useState('');
  const [tokenId, setTokenId] = useState('');

  // Set pre-selected token or NFT when component opens
  useEffect(() => {
    if (isOpen) {
      if (preSelectedToken) {
        setTransferType('ERC20');
        setSelectedToken(preSelectedToken.address);
      } else if (preSelectedNFT) {
        setTransferType('ERC721');
        setNftAddress(preSelectedNFT.address);
        setTokenId(preSelectedNFT.tokenId);
      }
    }
  }, [isOpen, preSelectedToken, preSelectedNFT]);

  const handleSendTransaction = async () => {
    if (!toAddress || !amount || !currentWallet) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    setIsLoading(true);

    // Show processing toast
    toast({
      variant: 'info',
      title: 'Processing Transaction',
      description: 'Your transaction is being processed...',
    });

    try {
      let txHash: string;

      switch (transferType) {
        case 'ETH':
          txHash = await buildAndSendRawTx({
            privateKey: currentWallet.privateKey,
            rpcUrl: currentNetworkConfig.rpcUrl,
            chainId: currentNetworkConfig.chainId
          }, toAddress, amount);
          break;
        case 'ERC20':
          if (!selectedToken) {
            toast({
              variant: 'error',
              title: 'Error',
              description: 'Please select a token',
            });
            return;
          }
          // Find the selected token to get its decimals
          const selectedTokenInfo = customTokens.find(token => token.address === selectedToken);
          if (!selectedTokenInfo) {
            toast({
              variant: 'error',
              title: 'Error',
              description: 'Selected token not found',
            });
            return;
          }
          console.log('Sending ERC20 token:', {
            tokenAddress: selectedToken,
            toAddress,
            amount,
            decimals: selectedTokenInfo.decimals
          });
          txHash = await sendERC20Token({
            privateKey: currentWallet.privateKey,
            rpcUrl: currentNetworkConfig.rpcUrl,
            chainId: currentNetworkConfig.chainId
          }, selectedToken, toAddress, amount, selectedTokenInfo.decimals);
          break;
        case 'ERC721':
          if (!nftAddress || !tokenId) {
            toast({
              variant: 'error',
              title: 'Error',
              description: 'Please fill in NFT address and token ID',
            });
            return;
          }
          txHash = await sendERC721NFT({
            privateKey: currentWallet.privateKey,
            rpcUrl: currentNetworkConfig.rpcUrl,
            chainId: currentNetworkConfig.chainId
          }, nftAddress, currentWallet.address, toAddress, tokenId);
          break;
        default:
          throw new Error('Invalid transfer type');
      }

      // Check if we got a valid transaction hash
      if (!txHash || txHash.length < 10) {
        console.error('Invalid transaction hash received:', txHash);
        throw new Error(`Invalid transaction hash received: ${txHash}. This usually means the transaction failed to submit.`);
      }

      console.log('Transaction submitted with hash:', txHash);

      // Wait for transaction confirmation
      const receipt = await waitForTransaction(txHash, currentNetworkConfig.rpcUrl);
      
      if (receipt && receipt.status === '0x1') {
        toast({
          variant: 'success',
          title: 'Transaction Successful',
          description: `Transaction completed! Hash: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
        });
        // Refresh balances after successful transaction
        setTimeout(() => {
          // Trigger balance refresh by setting the flag
          refreshBalances();
        }, 2000); // Wait 2 seconds for blockchain to update
      } else if (receipt && receipt.status === '0x0') {
        throw new Error('Transaction was reverted by the blockchain');
      } else {
        throw new Error('Transaction failed or was reverted');
      }

      handleClose();
    } catch (error) {
      console.error('Transaction failed:', error);
      toast({
        variant: 'error',
        title: 'Transaction Failed',
        description: 'Transaction failed: ' + error,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to wait for transaction confirmation
  const waitForTransaction = async (txHash: string, rpcUrl: string): Promise<{ status: string; blockHash: string }> => {
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max wait
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionReceipt',
            params: [txHash]
          })
        });

        const data = await response.json();
        
        if (data.result && data.result.blockHash) {
          console.log('Transaction confirmed:', data.result);
          return data.result;
        }

        // Wait 2 seconds before next attempt
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        console.error('Error checking transaction receipt:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Transaction confirmation timeout');
  };

  const handleClose = () => {
    setToAddress('');
    setAmount('');
    setTransferType('ETH');
    setSelectedToken('');
    setNftAddress('');
    setTokenId('');
    onClose();
  };

  const handleTokenChange = (tokenAddress: string) => {
    setSelectedToken(tokenAddress);
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      setTransferType('ETH');
    } else {
      setTransferType('ERC20');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="jupiter-modal-overlay" onClick={handleClose}>
      <div className="jupiter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jupiter-modal-header">
          <h3 className="jupiter-modal-title">Send Transaction</h3>
          <button
            onClick={handleClose}
            className="jupiter-modal-close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="jupiter-modal-content">
          <div className="jupiter-form">
            {/* Token Selection Dropdown */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Select Token</label>
              <select
                value={selectedToken}
                onChange={(e) => handleTokenChange(e.target.value)}
                className="jupiter-input"
              >
                <option value="0x0000000000000000000000000000000000000000">ETH</option>
                {customTokens
                  .filter(token => token.address !== '0x0000000000000000000000000000000000000000')
                  .map((token) => (
                    <option key={token.address} value={token.address}>
                      {token.symbol} - {token.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* To Address */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">To Address</label>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="0x..."
                className="jupiter-input font-mono"
              />
            </div>

            {/* Amount Field */}
            {(transferType === 'ETH' || transferType === 'ERC20') && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Amount {transferType === 'ETH' ? '(ETH)' : ''}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="jupiter-input"
                />
              </div>
            )}

            {/* NFT Fields */}
            {transferType === 'ERC721' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">NFT Contract Address</label>
                  <input
                    type="text"
                    value={nftAddress}
                    onChange={(e) => setNftAddress(e.target.value)}
                    placeholder="0x..."
                    className="jupiter-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Token ID</label>
                  <input
                    type="text"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="0"
                    className="jupiter-input"
                  />
                </div>
              </>
            )}

            {/* Send Button */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSendTransaction}
                    disabled={isLoading}
                    className="jupiter-btn jupiter-btn-primary flex-1 py-2 px-4 text-sm"
                  >
                    {isLoading ? (
                      <>
                        <div className="jupiter-loading"></div>
                        {transferType === 'ETH' ? 'Sending ETH...' : transferType === 'ERC20' ? 'Sending Token...' : 'Sending NFT...'}
                      </>
                    ) : (
                      <>
                        <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                        Send {transferType === 'ETH' ? 'ETH' : transferType === 'ERC20' ? 'Token' : 'NFT'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={onClose}
                    className="jupiter-btn jupiter-btn-secondary flex-1 py-2 px-4 text-sm"
                  >
                    Cancel
                  </button>
                </div>
          </div>
        </div>
      </div>
    </div>
  );
}
