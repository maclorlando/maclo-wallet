'use client';

import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Modal, ModalBody, ModalFooter, Button, Tooltip } from '@/components/ui';

interface NewWalletData {
  address: string;
  mnemonic: string;
  privateKey: string;
}

interface CreateWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletData: NewWalletData | null;
  onSave: (password: string) => void;
  loading?: boolean;
}

export default function CreateWalletModal({
  open,
  onOpenChange,
  walletData,
  onSave,
  loading = false
}: CreateWalletModalProps) {
  const [password, setPassword] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);

  const handleSave = () => {
    if (!password.trim()) return;
    onSave(password);
  };

  const handleClose = () => {
    setPassword('');
    setShowMnemonic(false);
    onOpenChange(false);
  };



  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create New Wallet"
      size="md"
    >
      <ModalBody>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-3">
              Wallet Address
            </label>
            <input
              value={walletData?.address || ''}
              readOnly
              className="jupiter-input font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-3">
              Mnemonic Phrase
            </label>
            <div className="relative">
              <textarea
                value={showMnemonic ? walletData?.mnemonic || '' : '••••••••••••••••••••••••'}
                readOnly
                className="jupiter-input jupiter-textarea font-mono"
                rows={3}
              />
              <Tooltip content={showMnemonic ? "Hide mnemonic" : "Show mnemonic"}>
                <button
                  onClick={() => setShowMnemonic(!showMnemonic)}
                  className="absolute right-3 top-3 p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {showMnemonic ? (
                    <EyeSlashIcon className="h-5 w-5 text-white/60" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-white/60" />
                  )}
                </button>
              </Tooltip>
            </div>
            <p className="text-xs text-yellow-400 mt-2">
              ⚠️ Save this mnemonic phrase securely! You&apos;ll need it to recover your wallet.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-3">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to encrypt wallet"
              className="jupiter-input"
            />
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <div className="flex gap-4 w-full">
          <Button
            onClick={handleSave}
            disabled={!password.trim() || loading}
            loading={loading}
            className="flex-1"
          >
            {loading ? 'Saving...' : 'Save Wallet'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
