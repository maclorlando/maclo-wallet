'use client';

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TrashIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/useToast';

interface TokenContextMenuProps {
  token: {
    symbol: string;
    name: string;
    address: string;
    balance: string;
    usdValue: number;
    decimals: number;
  };
  onDelete: (address: string) => void;
  onSend: (token: {
    symbol: string;
    name: string;
    address: string;
    balance: string;
    usdValue: number;
    decimals: number;
  }) => void;
  children: React.ReactNode;
}

export default function TokenContextMenu({ token, onDelete, onSend, children }: TokenContextMenuProps) {
  const { toast } = useToast();

  const handleDelete = () => {
    onDelete(token.address);
    toast({
      variant: 'success',
      title: 'Token Removed',
      description: `${token.symbol} has been removed from tracking`,
    });
  };

  const handleSend = () => {
    onSend(token);
    toast({
      variant: 'info',
      title: 'Send Token',
      description: `Preparing to send ${token.symbol}`,
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <div className="cursor-pointer">
          {children}
        </div>
      </DropdownMenu.Trigger>
      
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[180px] bg-gray-900/95 border border-gray-700/50 rounded-xl p-1 shadow-2xl backdrop-blur-md z-[999999]"
          sideOffset={5}
          align="end"
        >
          <DropdownMenu.Item
            className="flex items-center gap-3 px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-all duration-200 outline-none"
            onClick={handleSend}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            Send {token.symbol}
          </DropdownMenu.Item>
          
          <DropdownMenu.Separator className="h-px bg-gray-700/50 my-1" />
          
          <DropdownMenu.Item
            className="flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer transition-all duration-200 outline-none"
            onClick={handleDelete}
          >
            <TrashIcon className="h-4 w-4" />
            Stop Tracking
          </DropdownMenu.Item>
          
          <DropdownMenu.Arrow className="fill-gray-900/95" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
