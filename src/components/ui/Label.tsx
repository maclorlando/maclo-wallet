'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LabelProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showDot?: boolean;
  dotColor?: string;
}

export function Label({
  children,
  variant = 'default',
  size = 'sm',
  className,
  showDot = false,
  dotColor = 'bg-green-400'
}: LabelProps) {
  const baseClasses = 'inline-flex items-center rounded-full backdrop-blur-sm shadow-sm transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-gradient-to-r from-gray-800/80 to-gray-700/80 border border-gray-600/50 hover:from-gray-700/80 hover:to-gray-600/80',
    success: 'bg-gradient-to-r from-green-800/80 to-green-700/80 border border-green-600/50 hover:from-green-700/80 hover:to-green-600/80',
    warning: 'bg-gradient-to-r from-yellow-800/80 to-yellow-700/80 border border-yellow-600/50 hover:from-yellow-700/80 hover:to-yellow-600/80',
    error: 'bg-gradient-to-r from-red-800/80 to-red-700/80 border border-red-600/50 hover:from-red-700/80 hover:to-red-600/80'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  };

  const textClasses = {
    default: 'text-gray-100',
    success: 'text-green-100',
    warning: 'text-yellow-100',
    error: 'text-red-100'
  };

  return (
    <div className={cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className
    )}>
      {showDot && (
        <div className={cn('w-2 h-2 rounded-full mr-2 flex-shrink-0', dotColor)}></div>
      )}
      <span className={cn('font-mono tracking-wide', textClasses[variant])}>
        {children}
      </span>
    </div>
  );
}
