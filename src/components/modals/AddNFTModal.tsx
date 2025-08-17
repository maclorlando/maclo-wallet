'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui';
import { NFTInfo } from '@/lib/walletManager';
import { useToast } from '@/hooks/useToast';

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
  const [formData, setFormData] = useState({
    address: '',
    tokenId: '',
    name: '',
    symbol: '',
    imageUrl: ''
  });
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.address || !formData.tokenId || !formData.name || !formData.symbol) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Please fill in all required fields',
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
      // This is a simplified version - in a real implementation, you'd need to:
      // 1. Call tokenURI() on the contract to get the metadata URI
      // 2. Fetch the metadata from that URI
      // 3. Parse the metadata to get name, symbol, image, etc.
      
      // For now, we'll return null to indicate manual input is needed
      return null;
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
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add NFT'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
