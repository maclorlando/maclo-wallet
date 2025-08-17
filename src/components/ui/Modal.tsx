'use client';

import React from 'react';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  children,
  title,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl'
  };

  // console.log('Modal render:', { open, title, children: !!children, childrenType: typeof children });

  if (!open) return null;

  return (
    <div 
      className="jupiter-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 100001,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        className={cn('jupiter-modal', sizes[size])}
        style={{
          position: 'relative',
          zIndex: 100002,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <ModalHeader>
            {title && (
              <h2 className="jupiter-modal-title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button 
                onClick={() => onOpenChange(false)}
                className="jupiter-modal-close"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </ModalHeader>
        )}
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ 
  className, 
  children, 
  ...props 
}: ModalHeaderProps) {
  return (
    <div
      className={cn('jupiter-modal-header', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ModalBody({ 
  className, 
  children, 
  ...props 
}: ModalBodyProps) {
  return (
    <div
      className={cn('jupiter-modal-content', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ModalFooter({ 
  className, 
  children, 
  ...props 
}: ModalFooterProps) {
  return (
    <div
      className={cn('flex items-center justify-end gap-3 pt-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}
