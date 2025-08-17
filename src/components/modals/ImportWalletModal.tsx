'use client';

import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button } from '@/components/ui';

interface ImportWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (mnemonic: string, password: string) => void;
  loading?: boolean;
}

export default function ImportWalletModal({
  open,
  onOpenChange,
  onImport,
  loading = false
}: ImportWalletModalProps) {
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');

  const handleImport = () => {
    if (!mnemonic.trim() || !password.trim()) return;
    onImport(mnemonic, password);
  };

  const handleClose = () => {
    setMnemonic('');
    setPassword('');
    onOpenChange(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && mnemonic.trim() && password.trim()) {
      handleImport();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Import Wallet"
      size="md"
    >
      <ModalBody>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-3">
              Mnemonic Phrase <span className="text-red-400">*</span>
            </label>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="Enter your 12 or 24 word mnemonic phrase"
              rows={3}
              className="jupiter-input jupiter-textarea"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-3">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter password to encrypt wallet"
              className="jupiter-input"
            />
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <div className="flex gap-4 w-full">
          <Button
            onClick={handleImport}
            loading={loading}
            disabled={!mnemonic.trim() || !password.trim()}
            className="flex-1"
          >
            Import Wallet
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
