'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCamera } from '@/hooks/useCamera';

interface CapturedPage {
  url: string;
  blob: Blob;
  rotation: number;
}

interface CameraCaptureProps {
  onCapture: (files: File[]) => void;
  onClose?: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const {
    videoRef,
    canvasRef,
    isActive,
    isLoading,
    error,
    hasCamera,
    start,
    stop,
    capture,
    switchCamera,
  } = useCamera();

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [pages, setPages] = useState<CapturedPage[]>([]);

  const handleCapture = useCallback(() => {
    const blob = capture();
    if (blob) {
      const url = URL.createObjectURL(blob);
      setCapturedImage(url);
    }
  }, [capture]);

  const handleRetake = useCallback(() => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setRotation(0);
  }, [capturedImage]);

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  // Remove a saved page
  const handleRemovePage = useCallback((index: number) => {
    setPages((prev) => {
      const page = prev[index];
      if (page) {
        URL.revokeObjectURL(page.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Helper to apply rotation to an image blob
  const applyRotation = useCallback((imageUrl: string, rot: number): Promise<Blob> => {
    return new Promise((resolve) => {
      if (rot === 0) {
        fetch(imageUrl)
          .then((r) => r.blob())
          .then(resolve);
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (rot === 90 || rot === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
          },
          'image/jpeg',
          0.9
        );
      };
      img.src = imageUrl;
    });
  }, []);

  // Add current image as a page and continue capturing
  const handleAddPage = useCallback(async () => {
    if (!capturedImage) return;

    const blob = await applyRotation(capturedImage, rotation);
    setPages((prev) => [...prev, { url: capturedImage, blob, rotation }]);
    setCapturedImage(null);
    setRotation(0);

    // Force restart camera for next capture
    stop();
    // Small delay to ensure stream is fully stopped
    await new Promise(resolve => setTimeout(resolve, 100));
    start();
  }, [capturedImage, rotation, applyRotation, stop, start]);

  // Helper to load image from blob URL
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  // Submit all pages (including current one if any)
  const handleConfirm = useCallback(async () => {
    const allPages = [...pages];

    // Include current captured image if exists
    if (capturedImage) {
      const blob = await applyRotation(capturedImage, rotation);
      allPages.push({ url: capturedImage, blob, rotation });
    }

    if (allPages.length === 0) return;

    const timestamp = Date.now();
    let files: File[];

    if (allPages.length === 1 && allPages[0]) {
      // Single page - just use the image
      const file = new File([allPages[0].blob], `capture-${timestamp}.jpg`, { type: 'image/jpeg' });
      files = [file];
    } else if (allPages.length > 1) {
      // Multiple pages - combine into one tall image (stacked vertically)
      // Load all images first
      const loadedImages: HTMLImageElement[] = [];
      for (const page of allPages) {
        if (!page) continue;
        const img = await loadImage(URL.createObjectURL(page.blob));
        loadedImages.push(img);
      }

      if (loadedImages.length === 0) return;

      // Find max width and total height
      const maxWidth = Math.max(...loadedImages.map(img => img.width));
      const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0);
      const gap = 20; // Gap between pages
      const totalHeightWithGaps = totalHeight + (gap * (loadedImages.length - 1));

      // Create combined canvas
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = totalHeightWithGaps;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw each image stacked vertically, centered horizontally
      let yOffset = 0;
      for (let i = 0; i < loadedImages.length; i++) {
        const img = loadedImages[i];
        if (!img) continue;
        const xOffset = (maxWidth - img.width) / 2; // Center horizontally
        ctx.drawImage(img, xOffset, yOffset);
        yOffset += img.height + gap;

        // Draw a subtle divider line between pages (except after last)
        if (i < loadedImages.length - 1) {
          ctx.strokeStyle = '#e0e0e0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(20, yOffset - gap / 2);
          ctx.lineTo(maxWidth - 20, yOffset - gap / 2);
          ctx.stroke();
        }
      }

      // Convert to blob
      const combinedBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
          },
          'image/jpeg',
          0.9
        );
      });

      const file = new File([combinedBlob], `capture-${timestamp}-${allPages.length}pages.jpg`, { type: 'image/jpeg' });
      files = [file];
    } else {
      // Shouldn't happen, but handle gracefully
      return;
    }

    // Clean up URLs
    allPages.forEach((page) => URL.revokeObjectURL(page.url));
    setPages([]);
    setCapturedImage(null);
    setRotation(0);

    onCapture(files);
    stop();
    onClose?.();
  }, [pages, capturedImage, rotation, applyRotation, onCapture, stop, onClose]);

  const handleClose = useCallback(() => {
    stop();
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    pages.forEach((page) => URL.revokeObjectURL(page.url));
    setPages([]);
    onClose?.();
  }, [stop, capturedImage, pages, onClose]);

  const totalPages = pages.length + (capturedImage ? 1 : 0);

  if (!hasCamera) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6 text-muted-foreground"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Camera Not Available</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error || 'Your device does not have a camera or camera access is not supported.'}
          </p>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="mt-4">
              Close
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <Button variant="ghost" size="sm" onClick={handleClose} className="text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </Button>
        <span className="text-white font-medium">
          {capturedImage ? 'Preview' : 'Camera'}
          {pages.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-green-500 rounded-full text-xs">
              {pages.length} page{pages.length !== 1 ? 's' : ''} saved
            </span>
          )}
        </span>
        {isActive && !capturedImage && (
          <Button variant="ghost" size="sm" onClick={switchCamera} className="text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <path d="M9 9h.01" />
              <path d="M15 9h.01" />
            </svg>
          </Button>
        )}
        {capturedImage && (
          <Button variant="ghost" size="sm" onClick={handleRotate} className="text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </Button>
        )}
      </div>

      {/* Camera/Preview area */}
      <div className="flex-1 relative overflow-hidden">
        {capturedImage ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={capturedImage}
              alt="Captured"
              className="max-w-full max-h-full object-contain transition-transform"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Alignment guide overlay */}
            {isActive && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-8 border-2 border-white/30 rounded-lg" />
                <div className="absolute top-1/2 left-8 right-8 h-px bg-white/20" />
                <div className="absolute left-1/2 top-8 bottom-8 w-px bg-white/20" />
              </div>
            )}
          </>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="h-8 w-8 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-white text-sm">Starting camera...</span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center p-4">
              <p className="text-white mb-4">{error}</p>
              <Button onClick={start}>Try Again</Button>
            </div>
          </div>
        )}

        {/* Start camera prompt */}
        {!isActive && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button onClick={start} size="lg">
              Start Camera
            </Button>
          </div>
        )}
      </div>

      {/* Page thumbnails - show all pages including current capture */}
      {totalPages > 0 && (
        <div className="px-4 py-2 bg-black/70 flex gap-2 overflow-x-auto">
          {pages.map((page, index) => (
            <div key={index} className="relative flex-shrink-0">
              <img
                src={page.url}
                alt={`Page ${index + 1}`}
                className="h-12 w-12 object-cover rounded"
                style={{ transform: `rotate(${page.rotation}deg)` }}
              />
              <span className="absolute -bottom-1 -left-1 bg-green-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {index + 1}
              </span>
              {/* Delete button */}
              <button
                onClick={() => handleRemovePage(index)}
                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
              >
                ×
              </button>
            </div>
          ))}
          {/* Show current captured image as thumbnail too */}
          {capturedImage && (
            <div className="relative flex-shrink-0 ring-2 ring-blue-500 rounded">
              <img
                src={capturedImage}
                alt={`Page ${pages.length + 1}`}
                className="h-12 w-12 object-cover rounded"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
              <span className="absolute -bottom-1 -left-1 bg-blue-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {pages.length + 1}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="p-4 bg-black/50">
        {capturedImage ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={handleRetake} className="flex-1 max-w-28">
                Retake
              </Button>
              <Button
                variant="outline"
                onClick={handleAddPage}
                className="flex-1 max-w-28 bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              >
                + Add Page
              </Button>
              <Button onClick={handleConfirm} className="flex-1 max-w-28 bg-green-600 hover:bg-green-700">
                {totalPages > 1 ? `Done (${totalPages})` : 'Use Photo'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onClick={handleCapture}
              disabled={!isActive}
              className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Capture photo"
            />
          </div>
        )}
      </div>
    </div>
  );
}
