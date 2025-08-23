'use client';

import React, { useState } from 'react';
import { useWallet } from '@/lib/walletContext';
import { createNFTService, MintResult } from '@/lib/nftService';
import { useToast } from '@/hooks/useToast';
import { Modal, Button } from '@/components/ui';
import { Sparkles, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface MintNFTModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MintNFTModal({ isOpen, onClose }: MintNFTModalProps) {
  const { currentWallet, currentNetwork } = useWallet();
  const { toast } = useToast();
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [mintCount, setMintCount] = useState(1);

  const handleMint = async (count: number = 1) => {
    if (!currentWallet?.privateKey) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Wallet not available',
      });
      return;
    }

    setIsMinting(true);
    setMintResult(null);

    try {
      const nftService = createNFTService(currentWallet.privateKey);
      
      if (!nftService.isContractAvailable()) {
        toast({
          variant: 'error',
          title: 'Contract Not Available',
          description: 'NFT contract is not deployed on this network yet',
        });
        return;
      }

      let result: MintResult;
      
      if (count === 1) {
        result = await nftService.mintNFT();
      } else {
        result = await nftService.mintBatchNFTs(count);
      }

      setMintResult(result);

      if (result.success) {
        const tokenInfo = count === 1 
          ? `Token ID: ${result.tokenId}`
          : `${result.tokenIds?.length} NFTs minted`;
          
        toast({
          variant: 'success',
          title: 'NFT Minted Successfully!',
          description: `${tokenInfo}. Transaction: ${result.transactionHash?.slice(0, 10)}...`,
        });
      } else {
        toast({
          variant: 'error',
          title: 'Minting Failed',
          description: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      console.error('Minting error:', error);
      toast({
        variant: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsMinting(false);
    }
  };

  const handleClose = () => {
    setMintResult(null);
    setMintCount(1);
    onClose();
  };

  const networkName = currentNetwork === 'ethereum-sepolia' ? 'Ethereum Sepolia' : 'Base Sepolia';

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()} title="Mint Test NFT">
      <div className="space-y-6">
        {/* Network Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-blue-900 dark:text-blue-100">
              Minting on {networkName}
            </span>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            This will mint a test NFT to your wallet for testing purposes.
          </p>
        </div>

        {/* Mint Options */}
        {!isMinting && !mintResult && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Number of NFTs to mint:
              </label>
              <div className="flex space-x-2">
                {[1, 2, 3].map((count) => (
                  <Button
                    key={count}
                    variant={mintCount === count ? 'primary' : 'secondary'}
                    onClick={() => setMintCount(count)}
                    className="flex-1"
                  >
                    {count} NFT{count > 1 ? 's' : ''}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={() => handleMint(mintCount)}
                disabled={isMinting}
                className="flex-1"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Mint {mintCount} NFT{mintCount > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Minting Progress */}
        {isMinting && (
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <div>
              <p className="font-medium">Minting NFT{mintCount > 1 ? 's' : ''}...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This may take a few moments
              </p>
            </div>
          </div>
        )}

        {/* Mint Result */}
        {mintResult && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${
              mintResult.success 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <div className="flex items-center space-x-2">
                {mintResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <span className={`font-medium ${
                  mintResult.success 
                    ? 'text-green-900 dark:text-green-100' 
                    : 'text-red-900 dark:text-red-100'
                }`}>
                  {mintResult.success ? 'Minting Successful!' : 'Minting Failed'}
                </span>
              </div>
              
              {mintResult.success && (
                <div className="mt-2 space-y-1 text-sm">
                  {mintResult.tokenId && (
                    <p className="text-green-700 dark:text-green-300">
                      Token ID: {mintResult.tokenId}
                    </p>
                  )}
                  {mintResult.tokenIds && (
                    <p className="text-green-700 dark:text-green-300">
                      Token IDs: {mintResult.tokenIds.join(', ')}
                    </p>
                  )}
                  {mintResult.transactionHash && (
                    <p className="text-green-700 dark:text-green-300">
                      Transaction: {mintResult.transactionHash.slice(0, 20)}...
                    </p>
                  )}
                </div>
              )}
              
              {mintResult.error && (
                <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                  Error: {mintResult.error}
                </p>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={handleClose}
                variant="secondary"
                className="flex-1"
              >
                Close
              </Button>
              {mintResult.success && (
                <Button
                  onClick={() => {
                    setMintResult(null);
                    setMintCount(1);
                  }}
                  className="flex-1"
                >
                  Mint Another
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
