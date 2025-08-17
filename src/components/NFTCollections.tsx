'use client';

import React, { useState, useMemo } from 'react';
import { useWallet } from '@/lib/walletContext';
import { NFTInfo } from '@/lib/walletManager';
import SafeImage from '@/components/SafeImage';
import { Pin, Send, Trash2, Plus } from 'lucide-react';
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
  const { customNFTs, removeNFT } = useWallet();
  const { toast } = useToast();
  const [pinnedNFTs, setPinnedNFTs] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ nft: NFTInfo | null }>({ nft: null });

  // Group NFTs by collection
  const collections = useMemo(() => {
    const collectionMap = new Map<string, Collection>();
    
    customNFTs.forEach(nft => {
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
            You haven't added any NFTs to your wallet yet.
          </p>
          <Button onClick={onAddNFT} className="jupiter-btn jupiter-btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add NFT
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="jupiter-section">
      <div className="jupiter-section-header">
        <h3 className="jupiter-section-title">NFT Collections</h3>
        <p className="jupiter-section-subtitle">Your NFT holdings</p>
        <Button onClick={onAddNFT} className="jupiter-btn jupiter-btn-secondary">
          <Plus className="h-4 w-4 mr-2" />
          Add NFT
        </Button>
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
