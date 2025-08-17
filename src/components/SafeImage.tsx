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
  if (!src || hasError || src.includes('cryptologos.cc')) {
    const displayText = fallbackText || alt.slice(0, 2).toUpperCase();
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-gradient-to-r ${fallbackBgColor} ${className}`}
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
