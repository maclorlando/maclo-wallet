'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ContextMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function ContextMenu({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'end',
  side = 'bottom'
}: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(open);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const alignmentClasses = {
        start: rect.left,
        center: rect.left + rect.width / 2,
        end: rect.right
      };
      
      const sideClasses = {
        top: rect.top - 8,
        right: rect.right + 8,
        bottom: rect.bottom + 8,
        left: rect.left - 8
      };

      setMenuPosition({
        top: sideClasses[side],
        left: alignmentClasses[align]
      });
    }
  }, [isOpen, align, side]);

  const alignmentStyles = {
    start: { left: menuPosition.left },
    center: { left: menuPosition.left - 100, transform: 'translateX(-50%)' },
    end: { left: menuPosition.left - 200 }
  };

  const sideStyles = {
    top: { bottom: 'auto', top: menuPosition.top },
    right: { left: 'auto', right: 'auto', top: menuPosition.top },
    bottom: { top: menuPosition.top },
    left: { left: 'auto', right: 'auto', top: menuPosition.top }
  };

  return (
    <div className="relative">
      <div ref={triggerRef} onClick={() => onOpenChange(!isOpen)}>
        {trigger}
      </div>
      
      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed min-w-[200px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl backdrop-blur-sm"
          style={{
            ...alignmentStyles[align],
            ...sideStyles[side],
            zIndex: 9999999,
          }}
        >
          <div className="py-2">
            {children}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface ContextMenuItemProps {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
}

export function ContextMenuItem({
  onClick,
  children,
  icon,
  variant = 'default'
}: ContextMenuItemProps) {
  const variantStyles = {
    default: 'text-white hover:bg-white/10',
    danger: 'text-red-400 hover:bg-red-400/10'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-200',
        variantStyles[variant]
      )}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  );
}
