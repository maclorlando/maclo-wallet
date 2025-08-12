'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';

interface SafeImageProps {
  src: string;
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

  // If we've already had an error, show fallback immediately
  if (hasError) {
    return (
      <div 
        className={`${className} bg-gradient-to-r ${fallbackBgColor} rounded-full flex items-center justify-center`}
        style={{ width, height }}
      >
        <span className="text-white text-xs font-bold">
          {fallbackText || alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      {isLoading && (
        <div 
          className={`absolute inset-0 bg-gradient-to-r ${fallbackBgColor} rounded-full flex items-center justify-center animate-pulse`}
        >
          <span className="text-white text-xs font-bold">
            {fallbackText || alt.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={handleError}
        onLoad={handleLoad}
        unoptimized={false} // Let Next.js handle optimization
        priority={false} // Don't prioritize these images
      />
    </div>
  );
}
