'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { decryptMnemonic, getStoredWallets } from '@/lib/walletManager';
import { cn } from '@/lib/utils';

interface ViewMnemonicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string;
}

export function ViewMnemonicModal({
  open,
  onOpenChange,
  walletAddress
}: ViewMnemonicModalProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const unlockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const handleClose = () => {
    setPassword('');
    setShowMnemonic(false);
    setMnemonic('');
    setIsUnlocking(false);
    setUnlockProgress(0);
    setShowConfirm(false);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    setShowConfirm(true);
  };

  const handleUnlockStart = () => {
    if (!password.trim()) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Please enter your password',
      });
      return;
    }

    setIsUnlocking(true);
    setUnlockProgress(0);
    startTimeRef.current = Date.now();

    unlockIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / 3000) * 100, 100);
      setUnlockProgress(progress);

      if (progress >= 100) {
        handleUnlockComplete();
      }
    }, 50);
  };

  const handleUnlockStop = () => {
    if (unlockIntervalRef.current) {
      clearInterval(unlockIntervalRef.current);
      unlockIntervalRef.current = null;
    }
    setIsUnlocking(false);
    setUnlockProgress(0);
  };

  const handleUnlockComplete = () => {
    if (unlockIntervalRef.current) {
      clearInterval(unlockIntervalRef.current);
      unlockIntervalRef.current = null;
    }

    try {
      const wallets = getStoredWallets();
      const wallet = wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const decryptedMnemonic = decryptMnemonic(wallet, password);
      setMnemonic(decryptedMnemonic);
      setShowMnemonic(true);
      setIsUnlocking(false);
      
      toast({
        variant: 'success',
        title: 'Mnemonic Unlocked',
        description: 'Your mnemonic phrase is now visible',
      });
    } catch (error) {
      setIsUnlocking(false);
      setUnlockProgress(0);
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Invalid password. Please try again.',
      });
    }
  };

  useEffect(() => {
    return () => {
      if (unlockIntervalRef.current) {
        clearInterval(unlockIntervalRef.current);
      }
    };
  }, []);

  if (!showConfirm) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Recover Mnemonic Phrase"
        size="md"
      >
        <ModalBody>
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-yellow-400 mb-1">Security Warning</h4>
                <p className="text-xs text-yellow-300">
                  Recovering your mnemonic phrase will display it in plain text. Make sure you&apos;re in a secure, private location and no one can see your screen.
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Your mnemonic phrase is the master key to your wallet. Anyone who has access to this phrase can control all your funds. 
                <br /><br />
                Are you sure you want to proceed?
              </p>
            </div>
          </div>
        </ModalBody>
        
        <ModalFooter>
          <div className="flex gap-4 w-full">
            <Button
              onClick={handleConfirm}
              className="flex-1"
            >
              Yes, Show Mnemonic
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

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Recover Mnemonic Phrase"
      size="md"
    >
      <ModalBody>
        <div className="space-y-6">
          {!showMnemonic ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-3">
                  Wallet Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your wallet password"
                  className="jupiter-input"
                  disabled={isUnlocking}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-3">
                  Hold to Unlock
                </label>
                <div className="relative">
                  <button
                    onMouseDown={handleUnlockStart}
                    onMouseUp={handleUnlockStop}
                    onMouseLeave={handleUnlockStop}
                    onTouchStart={handleUnlockStart}
                    onTouchEnd={handleUnlockStop}
                    disabled={!password.trim() || isUnlocking}
                    className={cn(
                      "w-full h-12 rounded-lg font-medium transition-all duration-200 relative overflow-hidden",
                      isUnlocking
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <div className="relative z-10">
                      {isUnlocking ? "Unlocking..." : "Hold for 3 seconds to unlock"}
                    </div>
                    {isUnlocking && (
                      <div 
                        className="absolute inset-0 bg-green-500 transition-all duration-50 ease-linear"
                        style={{ width: `${unlockProgress}%` }}
                      />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Hold the button for 3 seconds to decrypt and display your mnemonic phrase
                </p>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-3">
                Your Mnemonic Phrase
              </label>
              <div className="relative">
                <textarea
                  value={mnemonic}
                  readOnly
                  className="jupiter-input jupiter-textarea font-mono"
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">
                  ⚠️ Keep this phrase secure! Anyone with access to it can control your wallet.
                </p>
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      
      <ModalFooter>
        <div className="flex gap-4 w-full">
          {showMnemonic ? (
            <Button
              onClick={handleClose}
              className="flex-1"
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => setShowConfirm(false)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="secondary"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
