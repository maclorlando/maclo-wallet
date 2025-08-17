'use client';

import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info';
}

export function ConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Continue',
  cancelText = 'Cancel',
  variant = 'warning'
}: ConfirmationModalProps) {
  const variantStyles = {
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    danger: 'bg-red-500/10 border-red-500/30 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
  };

  const buttonStyles = {
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    info: 'bg-blue-500 hover:bg-blue-600 text-white'
  };

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

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
         zIndex: 999999,
       }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        className="jupiter-modal max-w-md"
               style={{
         position: 'relative',
         zIndex: 1000000,
       }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jupiter-modal-header">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg border',
              variantStyles[variant]
            )}>
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <h2 className="jupiter-modal-title">{title}</h2>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="jupiter-modal-close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="jupiter-modal-content">
          <p className="text-gray-300 text-sm leading-relaxed mb-6">
            {description}
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="jupiter-btn jupiter-btn-secondary flex-1 py-2 px-4 text-sm"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={cn(
                'jupiter-btn flex-1 py-2 px-4 text-sm',
                buttonStyles[variant]
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
