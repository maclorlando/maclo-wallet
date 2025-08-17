'use client';

import React, { useState } from 'react';
import { useWallet } from '@/lib/walletContext';
import { XMarkIcon, PlusIcon, UserIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/useToast';
import { ConfirmationModal } from '@/components/ui';
import { AccountNameModal } from '@/components/modals';

interface AccountManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountManager({ isOpen, onClose }: AccountManagerProps) {
  const { toast } = useToast();
  const { 
    allAccounts, 
    currentAccountIndex, 
    switchAccount, 
    addAccount, 
    currentWallet,
    getAccountName,
    setAccountName,
    getCurrentAccountName
  } = useWallet();
  const [showAddAccountConfirm, setShowAddAccountConfirm] = useState(false);
  const [showAccountNameModal, setShowAccountNameModal] = useState(false);
  const [editingAccountAddress, setEditingAccountAddress] = useState('');

  const handleSwitchAccount = (index: number) => {
    switchAccount(index);
    const accountName = getAccountName(allAccounts[index].address);
    toast({
      variant: 'success',
      title: 'Account Switched',
      description: `Switched to ${accountName}`,
    });
  };

  const handleAddAccount = () => {
    setShowAddAccountConfirm(true);
  };

  const handleConfirmAddAccount = () => {
    addAccount();
    toast({
      variant: 'success',
      title: 'Account Added',
      description: 'New account has been added successfully!',
    });
  };

  const handleEditAccountName = (address: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingAccountAddress(address);
    setShowAccountNameModal(true);
  };

  const handleSaveAccountName = (name: string) => {
    setAccountName(editingAccountAddress, name);
  };

  if (!isOpen) return null;

  return (
    <div className="jupiter-modal-overlay" onClick={onClose}>
      <div className="jupiter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jupiter-modal-header">
          <h3 className="jupiter-modal-title">Account Manager</h3>
          <button
            onClick={onClose}
            className="jupiter-modal-close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="jupiter-modal-content">
          <div className="space-y-4">
            {/* Current Account */}
            <div className="jupiter-card p-4">
              <div className="jupiter-card-content">
                <div className="jupiter-card-text">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <UserIcon className="h-4 w-4 text-white/60 mr-2" />
                      <span className="text-sm font-medium text-white/70">Current Account</span>
                    </div>
                    <button
                      onClick={(e) => handleEditAccountName(currentWallet?.address || '', e)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                    >
                      <PencilIcon className="h-3 w-3 text-white/60" />
                    </button>
                  </div>
                  <div className="jupiter-card-title text-sm">
                    {getCurrentAccountName()}
                  </div>
                  <div className="jupiter-card-description font-mono text-xs">
                    {currentWallet?.address ? `${currentWallet.address.slice(0, 6)}...${currentWallet.address.slice(-4)}` : 'No wallet selected'}
                  </div>
                </div>
                <div className="jupiter-card-icons">
                  <div className="jupiter-card-icon text-sm">👤</div>
                </div>
              </div>
            </div>

            {/* Account List */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-3">All Accounts</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allAccounts.map((account, index) => (
                  <div
                    key={index}
                    className={`jupiter-card cursor-pointer transition-all duration-200 p-3 ${
                      index === currentAccountIndex
                        ? 'ring-2 ring-green-400/50'
                        : 'hover:bg-white/5'
                    }`}
                    onClick={() => handleSwitchAccount(index)}
                  >
                    <div className="jupiter-card-content">
                      <div className="jupiter-card-text">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-3 ${
                              index === currentAccountIndex 
                                ? 'bg-green-400' 
                                : 'bg-white/30'
                            }`}></div>
                            <div>
                              <div className="jupiter-card-title text-sm">{getAccountName(account.address)}</div>
                              <div className="jupiter-card-description font-mono text-xs">
                                {account.address.slice(0, 6)}...{account.address.slice(-4)}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleEditAccountName(account.address, e)}
                            className="p-1 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <PencilIcon className="h-3 w-3 text-white/60" />
                          </button>
                        </div>
                      </div>
                      <div className="jupiter-card-icons">
                        {index === currentAccountIndex && (
                          <div className="text-green-400 text-xs font-medium">Active</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Account Button */}
            <button
              onClick={handleAddAccount}
              className="jupiter-btn jupiter-btn-secondary w-full py-3 px-4 text-sm"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add New Account
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Adding Account */}
      <ConfirmationModal
        open={showAddAccountConfirm}
        onOpenChange={setShowAddAccountConfirm}
        onConfirm={handleConfirmAddAccount}
        title="Add New Account"
        description="A new account will be created from your existing wallet's mnemonic phrase. This account will be automatically added to your wallet and you can switch between accounts."
        confirmText="Add Account"
        variant="info"
      />

      {/* Account Name Modal */}
      <AccountNameModal
        open={showAccountNameModal}
        onOpenChange={setShowAccountNameModal}
        currentName={getAccountName(editingAccountAddress)}
        onSave={handleSaveAccountName}
        accountAddress={editingAccountAddress}
      />
    </div>
  );
}
