'use client';

import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button } from '@/components/ui';

interface RecoverWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storedAddresses: string[];
  onRecover: (address: string, password: string) => void;
  loading?: boolean;
}

export default function RecoverWalletModal({
  open,
  onOpenChange,
  storedAddresses,
  onRecover,
  loading = false
}: RecoverWalletModalProps) {
  // console.log('RecoverWalletModal render:', { open, storedAddresses: storedAddresses.length });
  const [recoverAddress, setRecoverAddress] = useState('');
  const [recoverPassword, setRecoverPassword] = useState('');

  const handleRecover = () => {
    if (!recoverAddress || !recoverPassword.trim()) return;
    onRecover(recoverAddress, recoverPassword);
  };

  const handleClose = () => {
    setRecoverAddress('');
    setRecoverPassword('');
    onOpenChange(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && recoverAddress && recoverPassword.trim()) {
      handleRecover();
    }
  };

  const addressOptions = storedAddresses.map(address => ({
    value: address,
    label: `${address.slice(0, 6)}...${address.slice(-4)}`
  }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Recover Wallet"
      size="md"
    >
      <ModalBody>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-3">
              Wallet Address <span className="text-red-400">*</span>
            </label>
            <select
              value={recoverAddress}
              onChange={(e) => setRecoverAddress(e.target.value)}
              className="jupiter-input jupiter-select"
            >
              <option value="">Select a wallet</option>
              {addressOptions.map((option, index) => (
                <option key={index} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-3">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={recoverPassword}
              onChange={(e) => setRecoverPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your wallet password"
              className="jupiter-input"
            />
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <div className="flex gap-4 w-full">
          <Button
            onClick={handleRecover}
            loading={loading}
            disabled={!recoverAddress || !recoverPassword.trim()}
            className="flex-1"
          >
            Recover Wallet
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
