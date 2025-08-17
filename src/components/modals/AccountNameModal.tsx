'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';

interface AccountNameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onSave: (name: string) => void;
  accountAddress: string;
}

export function AccountNameModal({
  open,
  onOpenChange,
  currentName,
  onSave,
  accountAddress
}: AccountNameModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName, open]);

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Account name cannot be empty',
      });
      return;
    }

    if (name.trim().length > 20) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Account name must be 20 characters or less',
      });
      return;
    }

    onSave(name.trim());
    onOpenChange(false);
    
    toast({
      variant: 'success',
      title: 'Account Name Updated',
      description: `Account name changed to "${name.trim()}"`,
    });
  };

  const handleClose = () => {
    setName(currentName);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Account Name"
      size="sm"
    >
      <ModalBody>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Account Address
            </label>
            <div className="text-sm text-gray-400 font-mono bg-gray-800/50 p-2 rounded border border-gray-700">
              {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Account Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter account name"
              className="jupiter-input"
              maxLength={20}
            />
            <p className="text-xs text-gray-400 mt-1">
              {name.length}/20 characters
            </p>
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <div className="flex gap-3 w-full">
          <Button
            onClick={handleSave}
            disabled={!name.trim() || name.trim() === currentName}
            className="flex-1"
          >
            Save Changes
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
