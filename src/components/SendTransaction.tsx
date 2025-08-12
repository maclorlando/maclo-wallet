'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/walletContext';
import { buildAndSendRawTx, WalletConfig } from '@/lib/walletUtils';
import { getCurrentNetworkConfig } from '@/lib/walletManager';
import { 
  PaperAirplaneIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface SendTransactionProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SendTransaction({ isOpen, onClose }: SendTransactionProps) {
  const { currentWallet } = useWallet();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const handleSendTransaction = async () => {
    if (!currentWallet) {
      setError('No wallet selected');
      return;
    }

    if (!toAddress || !amount) {
      setError('Please fill in all fields');
      return;
    }

    // Validate address format
    if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
      setError('Invalid address format');
      return;
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Invalid amount');
      return;
    }

    setIsLoading(true);
    setError('');
    setTxHash('');

    try {
      // Create wallet config for raw transaction
      const walletConfig: WalletConfig = {
        privateKey: currentWallet.privateKey,
        chainId: getCurrentNetworkConfig().chainId,
        rpcUrl: getCurrentNetworkConfig().rpcUrl
      };

      // Send raw transaction using our manual implementation
      const hash = await buildAndSendRawTx(walletConfig, toAddress, amount);
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setToAddress('');
    setAmount('');
    setTxHash('');
    setError('');
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border w-96 shadow-2xl rounded-xl bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Send Transaction
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transform transition-all duration-200 hover:scale-110"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Address
              </label>
              <input
                type="text"
                value={currentWallet?.address || ''}
                readOnly
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Address
              </label>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (ETH)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.01"
                step="0.001"
                min="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Manual Transaction Creation</p>
                  <p className="mt-1">
                    This transaction is created manually without using wallet libraries. 
                    The nonce, gas estimation, and transaction signing are all implemented from scratch.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <XCircleIcon className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Error</p>
                    <p className="mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {txHash && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium">Transaction Sent!</p>
                    <p className="mt-1 break-all font-mono text-xs">{txHash}</p>
                    <a
                      href={`${getCurrentNetworkConfig().blockExplorer}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline mt-2 inline-block"
                    >
                      View on Explorer
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleSendTransaction}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-105"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                    Send Transaction
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transform transition-all duration-200 hover:scale-105"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
