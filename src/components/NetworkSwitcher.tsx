'use client';

import React from 'react';
import { useWallet } from '@/lib/walletContext';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { Copy } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Tooltip, Label } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

export default function NetworkSwitcher() {
  const { toast } = useToast();
  const { currentWallet, currentNetwork, setCurrentNetwork, availableNetworks } = useWallet();

  const currentNetworkConfig = availableNetworks[currentNetwork];

  const handleCopyAddress = async () => {
    if (currentWallet?.address) {
      try {
        await navigator.clipboard.writeText(currentWallet.address);
        toast({
          variant: 'success',
          title: 'Address Copied',
          description: 'Wallet address copied to clipboard!',
        });
      } catch (error) {
        console.error('Failed to copy address:', error);
        toast({
          variant: 'error',
          title: 'Error',
          description: 'Failed to copy address',
        });
      }
    }
  };

  const handleNetworkChange = (network: string) => {
    setCurrentNetwork(network);
    toast({
      variant: 'info',
      title: 'Network Switched',
      description: `Switched to ${availableNetworks[network].name}`,
    });
  };

  return (
    <div className="flex items-center gap-3">
             {/* Wallet Address with Copy Button */}
       <div className="flex items-center gap-2">
         <Label showDot dotColor="bg-green-400">
           {currentWallet?.address?.slice(0, 6)}...{currentWallet?.address?.slice(-4)}
         </Label>
                 <Tooltip content="Copy address">
           <button
             onClick={handleCopyAddress}
             className="text-gray-400 hover:text-gray-200 transition-all duration-200 p-1 rounded-full hover:bg-gray-700/40"
           >
             <Copy className="h-3 w-3" />
           </button>
         </Tooltip>

      </div>

      {/* Network Switcher with Radix UI */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="jupiter-network-btn">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
              <span className="text-xs font-medium text-white">
                {currentNetworkConfig.name}
              </span>
            </div>
            <ChevronDownIcon className="h-2.5 w-2.5 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="jupiter-network-dropdown"
            sideOffset={4}
            align="end"
            side="bottom"
          >
            {Object.entries(availableNetworks).map(([key, network]) => (
              <DropdownMenu.Item
                key={key}
                className="jupiter-network-option"
                onClick={() => handleNetworkChange(key)}
                data-state={currentNetwork === key ? "checked" : "unchecked"}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                <span>{network.name}</span>
                {currentNetwork === key && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400"></div>
                )}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
