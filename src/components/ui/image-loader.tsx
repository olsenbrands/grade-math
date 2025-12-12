'use client';

/**
 * Optimized Image Loader Component
 *
 * Provides lazy loading, blur placeholders, and error handling
 * for images throughout the application
 */

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ImageOff, Loader2 } from 'lucide-react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
  fallback?: React.ReactNode;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  containerClassName,
  priority = false,
  quality = 75,
  onLoad,
  onError,
  fallback,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted rounded',
          containerClassName
        )}
        style={{ width, height }}
      >
        {fallback || (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">Image unavailable</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', containerClassName)}
      style={{ width, height }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {isInView && (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          quality={quality}
          priority={priority}
          className={cn(
            'transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}

/**
 * Thumbnail image with loading state
 */
interface ThumbnailProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export function Thumbnail({
  src,
  alt,
  size = 'md',
  className,
  onClick,
}: ThumbnailProps) {
  const sizes = {
    sm: { width: 48, height: 48 },
    md: { width: 80, height: 80 },
    lg: { width: 120, height: 120 },
  };

  const { width, height } = sizes[size];

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all',
        className
      )}
      onClick={onClick}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="object-cover"
      />
    </div>
  );
}

/**
 * Image gallery with lazy loading
 */
interface ImageGalleryProps {
  images: Array<{ src: string; alt: string; id: string }>;
  columns?: 2 | 3 | 4;
  onImageClick?: (id: string) => void;
  className?: string;
}

export function ImageGallery({
  images,
  columns = 3,
  onImageClick,
  className,
}: ImageGalleryProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={cn('grid gap-2', gridCols[columns], className)}>
      {images.map((image) => (
        <Thumbnail
          key={image.id}
          src={image.src}
          alt={image.alt}
          size="lg"
          onClick={() => onImageClick?.(image.id)}
        />
      ))}
    </div>
  );
}
