'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui';
import { NFTInfo } from '@/lib/walletManager';
import { useToast } from '@/hooks/useToast';
import { useWallet } from '@/lib/walletContext';
import { getERC721Owner } from '@/lib/walletUtils';
import { ethers } from 'ethers';

interface AddNFTModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (nftInfo: NFTInfo) => void;
  loading?: boolean;
}

interface NFTMetadata {
  name: string;
  symbol: string;
  token_uri?: string;
  image?: string;
}

export default function AddNFTModal({ open, onOpenChange, onAdd, loading = false }: AddNFTModalProps) {
  const { toast } = useToast();
  const { currentWallet, currentNetworkConfig, currentNetwork } = useWallet();
  const [formData, setFormData] = useState({
    address: '',
    tokenId: '',
    name: '',
    symbol: '',
    imageUrl: ''
  });
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isValidatingOwnership, setIsValidatingOwnership] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.address || !formData.tokenId || !formData.name || !formData.symbol) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    // Validate ownership before adding
    if (!currentWallet || !currentNetworkConfig) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Wallet not connected',
      });
      return;
    }

    setIsValidatingOwnership(true);
    try {
      const config = {
        privateKey: currentWallet.privateKey,
        chainId: currentNetworkConfig.chainId,
        network: currentNetwork
      };

      const owner = await getERC721Owner(config, formData.address, formData.tokenId);
      
      if (owner.toLowerCase() !== currentWallet.address.toLowerCase()) {
        toast({
          variant: 'error',
          title: 'Ownership Error',
          description: `You don't own this NFT. It belongs to ${owner}`,
        });
        return;
      }

      const nftInfo: NFTInfo = {
        address: formData.address,
        tokenId: formData.tokenId,
        name: formData.name,
        symbol: formData.symbol,
        imageUrl: formData.imageUrl || undefined
      };

      onAdd(nftInfo);
      resetForm();
      
      toast({
        variant: 'success',
        title: 'NFT Added',
        description: 'NFT has been successfully added to your wallet',
      });
    } catch (error) {
      console.error('Error validating NFT ownership:', error);
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Failed to validate NFT ownership. Please check the contract address and token ID.',
      });
    } finally {
      setIsValidatingOwnership(false);
    }
  };

  const resetForm = () => {
    setFormData({
      address: '',
      tokenId: '',
      name: '',
      symbol: '',
      imageUrl: ''
    });
  };

  const fetchNFTMetadata = async () => {
    if (!formData.address || !formData.tokenId) return;

    setIsLoadingMetadata(true);
    try {
      // Try to fetch metadata from the NFT contract
      const metadata = await fetchNFTMetadataFromContract();
      
      if (metadata) {
        setFormData(prev => ({
          ...prev,
          name: metadata.name || prev.name,
          symbol: metadata.symbol || prev.symbol,
          imageUrl: metadata.image || prev.imageUrl
        }));
        
        toast({
          variant: 'success',
          title: 'Metadata Fetched',
          description: 'NFT metadata has been automatically filled',
        });
      }
    } catch (error) {
      console.error('Error fetching NFT metadata:', error);
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Failed to fetch NFT metadata. Please fill in manually.',
      });
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const fetchNFTMetadataFromContract = async (): Promise<NFTMetadata | null> => {
    try {
      if (!formData.address || !formData.tokenId || !currentNetworkConfig) {
        return null;
      }

      // Get token name
      const nameResponse = await fetch('/api/rpc-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: currentNetwork,
          method: 'eth_call',
          params: [{
            to: formData.address,
            data: '0x06fdde03' // name()
          }, 'latest']
        })
      });

      let name = 'Unknown Collection';
      if (nameResponse.ok) {
        const nameData = await nameResponse.json();
        if (nameData.result) {
          name = ethers.AbiCoder.defaultAbiCoder().decode(['string'], nameData.result)[0];
        }
      }

      // Get token symbol
      const symbolResponse = await fetch('/api/rpc-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: currentNetwork,
          method: 'eth_call',
          params: [{
            to: formData.address,
            data: '0x95d89b41' // symbol()
          }, 'latest']
        })
      });

      let symbol = 'NFT';
      if (symbolResponse.ok) {
        const symbolData = await symbolResponse.json();
        if (symbolData.result) {
          symbol = ethers.AbiCoder.defaultAbiCoder().decode(['string'], symbolData.result)[0];
        }
      }

      // Try to get token URI and metadata
      const tokenURIResponse = await fetch('/api/rpc-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: currentNetwork,
          method: 'eth_call',
          params: [{
            to: formData.address,
            data: '0xc87b56dd' + BigInt(formData.tokenId).toString(16).padStart(64, '0') // tokenURI(uint256)
          }, 'latest']
        })
      });

      let imageUrl: string | undefined;
      if (tokenURIResponse.ok) {
        const tokenURIData = await tokenURIResponse.json();
        if (tokenURIData.result) {
          const tokenURI = ethers.AbiCoder.defaultAbiCoder().decode(['string'], tokenURIData.result)[0];
          
          // Fetch metadata from the URI
          const metadataResponse = await fetch(tokenURI);
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            if (metadata.image) {
              imageUrl = metadata.image;
            }
          }
        }
      }

      return {
        name,
        symbol,
        image: imageUrl
      };
    } catch (error) {
      console.error('Error fetching NFT metadata from contract:', error);
      return null;
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <div className="jupiter-modal-content">
        <div className="jupiter-modal-header">
          <div>
            <h2 className="jupiter-modal-title">Add NFT</h2>
            <p className="jupiter-modal-description">
              Add an NFT to your wallet by providing the contract address and token ID
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="jupiter-form">
          <div className="jupiter-form-group">
            <label className="jupiter-form-label">Contract Address *</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="0x..."
              className="jupiter-input"
              required
            />
          </div>

          <div className="jupiter-form-group">
            <label className="jupiter-form-label">Token ID *</label>
            <input
              type="text"
              value={formData.tokenId}
              onChange={(e) => setFormData(prev => ({ ...prev, tokenId: e.target.value }))}
              placeholder="123"
              className="jupiter-input"
              required
            />
          </div>

          <div className="jupiter-form-group">
            <label className="jupiter-form-label">Collection Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My NFT Collection"
              className="jupiter-input"
              required
            />
          </div>

          <div className="jupiter-form-group">
            <label className="jupiter-form-label">Collection Symbol *</label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
              placeholder="MNFT"
              className="jupiter-input"
              required
            />
          </div>

          <div className="jupiter-form-group">
            <label className="jupiter-form-label">Image URL (Optional)</label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://..."
              className="jupiter-input"
            />
          </div>

          <div className="jupiter-form-actions">
            <button
              type="button"
              onClick={fetchNFTMetadata}
              disabled={!formData.address || !formData.tokenId || isLoadingMetadata}
              className="jupiter-btn jupiter-btn-secondary"
            >
              {isLoadingMetadata ? 'Fetching...' : 'Auto-fill Metadata'}
            </button>
            
            <div className="jupiter-form-buttons">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="jupiter-btn jupiter-btn-ghost"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="jupiter-btn jupiter-btn-primary"
                disabled={loading || isValidatingOwnership}
              >
                {isValidatingOwnership ? 'Validating Ownership...' : (loading ? 'Adding...' : 'Add NFT')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
