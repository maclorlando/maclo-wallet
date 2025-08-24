'use client';

import React, { useState, useMemo } from 'react';
import { useWallet } from '@/lib/walletContext';
import { NFTInfo } from '@/lib/walletManager';
import SafeImage from '@/components/SafeImage';
import { Pin, Send, Trash2, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Button, ConfirmationModal } from '@/components/ui';

interface NFTCollectionsProps {
  onAddNFT: () => void;
  onSendNFT: (nft: NFTInfo) => void;
}

interface Collection {
  address: string;
  name: string;
  symbol: string;
  nfts: NFTInfo[];
  pinnedNFTs: NFTInfo[];
}

export default function NFTCollections({ onAddNFT, onSendNFT }: NFTCollectionsProps) {
  const { customNFTs, removeNFT, refreshNFTs, currentWallet } = useWallet();
  const { toast } = useToast();
  const [pinnedNFTs, setPinnedNFTs] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ nft: NFTInfo | null }>({ nft: null });

  // Group NFTs by collection
  const collections = useMemo(() => {
    const collectionMap = new Map<string, Collection>();
    
    // Create a Map to track unique NFTs by address-tokenId combination
    const uniqueNFTs = new Map<string, NFTInfo>();
    
    customNFTs.forEach(nft => {
      const uniqueKey = `${nft.address.toLowerCase()}-${nft.tokenId}`;
      uniqueNFTs.set(uniqueKey, nft);
    });
    
    // Process unique NFTs
    uniqueNFTs.forEach(nft => {
      const key = nft.address.toLowerCase();
      const isPinned = pinnedNFTs.has(`${nft.address}-${nft.tokenId}`);
      
      if (!collectionMap.has(key)) {
        collectionMap.set(key, {
          address: nft.address,
          name: nft.name,
          symbol: nft.symbol,
          nfts: [],
          pinnedNFTs: []
        });
      }
      
      const collection = collectionMap.get(key)!;
      if (isPinned) {
        collection.pinnedNFTs.push(nft);
      } else {
        collection.nfts.push(nft);
      }
    });
    
    return Array.from(collectionMap.values()).filter(collection => 
      collection.nfts.length > 0 || collection.pinnedNFTs.length > 0
    );
  }, [customNFTs, pinnedNFTs]);

  const togglePin = (nft: NFTInfo) => {
    const key = `${nft.address}-${nft.tokenId}`;
    const newPinnedNFTs = new Set(pinnedNFTs);
    
    if (newPinnedNFTs.has(key)) {
      newPinnedNFTs.delete(key);
      toast({
        variant: 'info',
        title: 'NFT Unpinned',
        description: `${nft.name} #${nft.tokenId} has been unpinned`,
      });
    } else {
      newPinnedNFTs.add(key);
      toast({
        variant: 'success',
        title: 'NFT Pinned',
        description: `${nft.name} #${nft.tokenId} has been pinned to top`,
      });
    }
    
    setPinnedNFTs(newPinnedNFTs);
  };

  const handleDeleteNFT = (nft: NFTInfo) => {
    setShowDeleteConfirm({ nft });
  };

  const confirmDelete = () => {
    if (showDeleteConfirm.nft) {
      removeNFT(showDeleteConfirm.nft.address, showDeleteConfirm.nft.tokenId);
      toast({
        variant: 'success',
        title: 'NFT Removed',
        description: `${showDeleteConfirm.nft.name} #${showDeleteConfirm.nft.tokenId} has been removed`,
      });
      setShowDeleteConfirm({ nft: null });
    }
  };

  const handleRefreshNFTs = async () => {
    try {
      toast({
        variant: 'info',
        title: 'Refreshing NFTs',
        description: 'Scanning for owned NFTs using Alchemy API...',
      });
      
      // First trigger manual NFT detection to catch any missed transfers
      if (typeof window !== 'undefined' && currentWallet?.address) {
        window.dispatchEvent(new CustomEvent('triggerBlockchainEventCheck', {
          detail: {
            address: currentWallet.address,
            network: 'base-sepolia', // This will be updated by the context
            type: 'NFT'
          }
        }));
      }
      
      await refreshNFTs();
      
      // Get updated NFT count
      const updatedNFTs = customNFTs;
      
      if (updatedNFTs.length === 0) {
        toast({
          variant: 'info',
          title: 'No NFTs Found',
          description: 'No NFTs were found in your wallet. You can manually add NFTs using the "Add NFT" button.',
        });
      } else {
        toast({
          variant: 'success',
          title: 'NFTs Refreshed',
          description: `Found ${updatedNFTs.length} NFTs in your wallet`,
        });
      }
    } catch (error) {
      console.error('Error refreshing NFTs:', error);
      toast({
        variant: 'error',
        title: 'Refresh Failed',
        description: 'Failed to refresh NFT collection. Please try again.',
      });
    }
  };

  if (customNFTs.length === 0) {
    return (
      <div className="jupiter-section">
        <div className="jupiter-section-header">
          <h3 className="jupiter-section-title">NFT Collections</h3>
          <p className="jupiter-section-subtitle">Your NFT holdings</p>
        </div>
        
        <div className="jupiter-empty-state">
          <div className="jupiter-empty-icon">🖼️</div>
          <h4 className="jupiter-empty-title">No NFTs Found</h4>
          <p className="jupiter-empty-description">
            You haven&apos;t added any NFTs to your wallet yet.
          </p>
          <div className="flex space-x-2">
            <Button onClick={handleRefreshNFTs} className="jupiter-btn jupiter-btn-secondary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={onAddNFT} className="jupiter-btn jupiter-btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add NFT
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="jupiter-section">
      <div className="jupiter-section-header">
        <h3 className="jupiter-section-title">NFT Collections</h3>
        <p className="jupiter-section-subtitle">Your NFT holdings</p>
        <div className="flex space-x-2">
          <Button onClick={handleRefreshNFTs} className="jupiter-btn jupiter-btn-secondary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={onAddNFT} className="jupiter-btn jupiter-btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add NFT
          </Button>
        </div>
      </div>

      <div className="jupiter-nft-collections">
        {collections.map((collection) => (
          <div key={collection.address} className="jupiter-collection">
            <div className="jupiter-collection-header">
              <div className="jupiter-collection-info">
                <div className="jupiter-collection-name">{collection.name}</div>
                <div className="jupiter-collection-symbol">{collection.symbol}</div>
              </div>
              <div className="jupiter-collection-count">
                {collection.pinnedNFTs.length + collection.nfts.length} NFTs
              </div>
            </div>

            {/* Pinned NFTs */}
            {collection.pinnedNFTs.length > 0 && (
              <div className="jupiter-nft-grid">
                {collection.pinnedNFTs.map((nft) => (
                  <NFTItem
                    key={`${nft.address}-${nft.tokenId}`}
                    nft={nft}
                    isPinned={true}
                    onPin={togglePin}
                    onSend={onSendNFT}
                    onDelete={handleDeleteNFT}
                  />
                ))}
              </div>
            )}

            {/* Regular NFTs */}
            {collection.nfts.length > 0 && (
              <div className="jupiter-nft-grid">
                {collection.nfts.map((nft) => (
                  <NFTItem
                    key={`${nft.address}-${nft.tokenId}`}
                    nft={nft}
                    isPinned={false}
                    onPin={togglePin}
                    onSend={onSendNFT}
                    onDelete={handleDeleteNFT}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteConfirm.nft !== null}
        onOpenChange={(open) => {
          if (!open) setShowDeleteConfirm({ nft: null });
        }}
        onConfirm={confirmDelete}
        title="Remove NFT"
        description={`Are you sure you want to remove ${showDeleteConfirm.nft?.name} #${showDeleteConfirm.nft?.tokenId} from your wallet? This action cannot be undone.`}
        confirmText="Remove NFT"
        variant="danger"
      />
    </div>
  );
}

interface NFTItemProps {
  nft: NFTInfo;
  isPinned: boolean;
  onPin: (nft: NFTInfo) => void;
  onSend: (nft: NFTInfo) => void;
  onDelete: (nft: NFTInfo) => void;
}

function NFTItem({ nft, isPinned, onPin, onSend, onDelete }: NFTItemProps) {
  return (
    <div className={`jupiter-nft-item ${isPinned ? 'jupiter-nft-pinned' : ''}`}>
      <div className="jupiter-nft-image">
        {nft.imageUrl ? (
          <SafeImage
            src={nft.imageUrl}
            alt={`${nft.name} #${nft.tokenId}`}
            width={120}
            height={120}
            className="w-full h-full object-cover rounded-lg"
            fallbackText={`#${nft.tokenId}`}
          />
        ) : (
          <div className="jupiter-nft-placeholder">
            <span className="text-2xl">🖼️</span>
            <span className="text-xs mt-1">#{nft.tokenId}</span>
          </div>
        )}
        
        {isPinned && (
          <div className="jupiter-nft-pin-badge">
            <Pin className="h-3 w-3" />
          </div>
        )}
      </div>

      <div className="jupiter-nft-info">
        <div className="jupiter-nft-name">{nft.name}</div>
        <div className="jupiter-nft-token-id">#{nft.tokenId}</div>
      </div>

      <div className="jupiter-nft-actions">
        <button
          onClick={() => onPin(nft)}
          className="jupiter-nft-action-btn"
          title={isPinned ? 'Unpin NFT' : 'Pin NFT'}
        >
          <Pin className={`h-4 w-4 ${isPinned ? 'text-green-400' : ''}`} />
        </button>
        <button
          onClick={() => onSend(nft)}
          className="jupiter-nft-action-btn"
          title="Send NFT"
        >
          <Send className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(nft)}
          className="jupiter-nft-action-btn jupiter-nft-action-delete"
          title="Remove NFT"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
