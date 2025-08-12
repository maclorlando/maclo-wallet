'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useWallet } from '@/lib/walletContext';
import { buildAndSendRawTx, WalletConfig } from '@/lib/walletUtils';
import { BASE_SEPOLIA_CONFIG } from '@/lib/walletManager';
import { 
  ArrowPathIcon,
  XMarkIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

interface TokenSwapProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SwapToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

const SWAP_TOKENS: SwapToken[] = [
  { symbol: 'USDC', name: 'USD Coin', address: '0x036CbD53842c5426634e7929541eC2318f3dCF7c', decimals: 6, logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
  { symbol: 'USDT', name: 'Tether USD', address: '0x7c6b91D9Be155A5DbC1B0008DAD0Ceed320c82A1', decimals: 6, logoURI: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', decimals: 18, logoURI: 'https://cryptologos.cc/logos/weth-logo.png' },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, logoURI: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png' }
];

export default function TokenSwap({ isOpen, onClose }: TokenSwapProps) {
  const { currentWallet } = useWallet();
  const [selectedToken, setSelectedToken] = useState<SwapToken | null>(null);
  const [ethAmount, setEthAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const handleSwap = async () => {
    if (!currentWallet || !selectedToken) {
      setError('Please select a token and enter amount');
      return;
    }

    if (!ethAmount || parseFloat(ethAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setError('');
    setTxHash('');

    try {
      // For demo purposes, we'll simulate a swap by sending ETH to a faucet-like address
      // In a real implementation, you'd integrate with a DEX like Uniswap
      const walletConfig: WalletConfig = {
        privateKey: currentWallet.privateKey,
        chainId: BASE_SEPOLIA_CONFIG.chainId,
        rpcUrl: BASE_SEPOLIA_CONFIG.rpcUrl
      };

      // Send a small amount of ETH to simulate the swap
      const hash = await buildAndSendRawTx(walletConfig, selectedToken.address, '0.001');
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedToken(null);
    setEthAmount('');
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
              Swap ETH for Tokens
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transform transition-all duration-200 hover:scale-110 cursor-pointer"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Token
              </label>
              <div className="grid grid-cols-2 gap-3">
                {SWAP_TOKENS.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => setSelectedToken(token)}
                    className={`p-3 rounded-lg border-2 transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-95 ${
                      selectedToken?.address === token.address
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden bg-gray-100">
                        {token.logoURI ? (
                          <Image 
                            src={token.logoURI} 
                            alt={token.symbol}
                            width={32}
                            height={32}
                            className="h-8 w-8 object-cover"
                            onError={(e) => {
                              // Handle error by showing fallback
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) {
                                fallback.classList.remove('hidden');
                              }
                            }}
                          />
                        ) : null}
                        <div className={`h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center ${token.logoURI ? 'hidden' : ''}`}>
                          <span className="text-white text-xs font-bold">{token.symbol}</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900">{token.symbol}</div>
                      <div className="text-xs text-gray-500">{token.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ETH Amount
              </label>
              <input
                type="number"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                placeholder="0.01"
                step="0.001"
                min="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 cursor-text"
              />
            </div>

            {selectedToken && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <CurrencyDollarIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Swap Preview</p>
                    <p className="mt-1">
                      You will receive approximately {ethAmount ? (parseFloat(ethAmount) * 1000).toFixed(2) : '0'} {selectedToken.symbol} 
                      for {ethAmount || '0'} ETH
                    </p>
                    <p className="text-xs mt-2 opacity-75">
                      Note: This is a demo swap. In production, you&apos;d integrate with a real DEX.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <XMarkIcon className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
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
                  <ArrowPathIcon className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium">Swap Initiated!</p>
                    <p className="mt-1 break-all font-mono text-xs">{txHash}</p>
                    <a
                      href={`${BASE_SEPOLIA_CONFIG.blockExplorer}/tx/${txHash}`}
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
                onClick={handleSwap}
                disabled={isLoading || !selectedToken || !ethAmount}
                className="flex-1 flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transform transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Swapping...
                  </>
                ) : (
                  <>
                    <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                    Swap Tokens
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transform transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
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
