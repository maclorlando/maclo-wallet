'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';

interface SafeImageProps {
  src?: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallbackText?: string;
  fallbackBgColor?: string;
}

export default function SafeImage({
  src,
  alt,
  width,
  height,
  className = '',
  fallbackText,
  fallbackBgColor = 'from-blue-500 to-indigo-600'
}: SafeImageProps) {
  // Generate a consistent fallback color based on the alt text
  const getFallbackColor = (text: string) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-green-500 to-emerald-600',
      'from-purple-500 to-violet-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
      'from-yellow-500 to-amber-600',
      'from-teal-500 to-cyan-600',
      'from-gray-500 to-slate-600'
    ];
    
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const dynamicFallbackColor = fallbackBgColor || getFallbackColor(alt);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback(() => {
    console.log(`Image failed to load: ${src}`);
    setHasError(true);
    setIsLoading(false);
  }, [src]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // If no src or has error, show fallback
  if (!src || hasError) {
    const displayText = fallbackText || alt.slice(0, 2).toUpperCase();
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-gradient-to-r ${dynamicFallbackColor} ${className}`}
        style={{ width, height }}
      >
        <span className="text-white font-bold text-xs">
          {displayText}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-r from-gray-600 to-gray-700 animate-pulse"
          style={{ width, height }}
        >
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`rounded-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={true}
      />
    </div>
  );
}
