'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCamera } from '@/hooks/useCamera';

interface CapturedPage {
  url: string;
  blob: Blob;
  rotation: number;
}

interface UploadedAssignment {
  id: string;
  thumbnails: string[]; // URLs for display only
  pageCount: number;
}

interface BatchScanProps {
  onCapture: (files: File[]) => Promise<void>;
  onClose: () => void;
}

export function BatchScan({ onCapture, onClose }: BatchScanProps) {
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
  } = useCamera({ facingMode: 'environment', width: 1920, height: 1080 });

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [uploadedAssignments, setUploadedAssignments] = useState<UploadedAssignment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Initialize camera on mount
  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [start, stop]);

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

  // Submit current assignment (all pages) and continue for next student
  const handleUsePhoto = useCallback(async () => {
    const allPages = [...pages];

    // Include current captured image if exists
    if (capturedImage) {
      const blob = await applyRotation(capturedImage, rotation);
      allPages.push({ url: capturedImage, blob, rotation });
    }

    if (allPages.length === 0) return;

    setUploading(true);
    try {
      const timestamp = Date.now();
      let file: File;

      if (allPages.length === 1 && allPages[0]) {
        // Single page - just use the image
        file = new File([allPages[0].blob], `capture-${timestamp}.jpg`, { type: 'image/jpeg' });
      } else {
        // Multiple pages - combine into one tall image (stacked vertically)
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
        const gap = 20;
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
          const xOffset = (maxWidth - img.width) / 2;
          ctx.drawImage(img, xOffset, yOffset);
          yOffset += img.height + gap;

          // Draw a subtle divider line between pages
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

        file = new File([combinedBlob], `capture-${timestamp}-${allPages.length}pages.jpg`, { type: 'image/jpeg' });
      }

      // Upload this assignment
      await onCapture([file]);

      // Save thumbnails for display (keep URLs for now, don't revoke)
      const thumbnailUrls = allPages.map(page => page.url);
      const newUploadedAssignments = [
        ...uploadedAssignments,
        {
          id: `uploaded-${timestamp}`,
          thumbnails: thumbnailUrls,
          pageCount: allPages.length,
        },
      ];
      setUploadedAssignments(newUploadedAssignments);

      // Clear current pages (but URLs are kept in uploadedAssignments)
      setPages([]);
      setCapturedImage(null);
      setRotation(0);

      // Check if we've hit the limit of 5 assignments
      if (newUploadedAssignments.length >= 5) {
        // Auto-close after reaching limit
        stop();
        // Clean up URLs on close
        newUploadedAssignments.forEach((a) => a.thumbnails.forEach((url) => URL.revokeObjectURL(url)));
        onClose();
        return;
      }

      // Restart camera for next student
      stop();
      await new Promise(resolve => setTimeout(resolve, 100));
      start();
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [pages, capturedImage, rotation, applyRotation, onCapture, stop, start, uploadedAssignments, onClose]);

  const handleClose = useCallback(() => {
    stop();
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    pages.forEach((page) => URL.revokeObjectURL(page.url));
    uploadedAssignments.forEach((a) => a.thumbnails.forEach((url) => URL.revokeObjectURL(url)));
    setPages([]);
    setUploadedAssignments([]);
    onClose();
  }, [stop, capturedImage, pages, uploadedAssignments, onClose]);

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
          <Button variant="outline" onClick={onClose} className="mt-4">
            Close
          </Button>
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
          {capturedImage ? 'Preview' : 'Batch Scan'}
          <span className="ml-2 px-2 py-0.5 bg-gray-600 rounded-full text-xs">
            {uploadedAssignments.length}/5
          </span>
          {pages.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500 rounded-full text-xs">
              {pages.length} page{pages.length !== 1 ? 's' : ''}
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

      {/* Thumbnails - uploaded assignments and current pages */}
      {(uploadedAssignments.length > 0 || totalPages > 0) && (
        <div className="px-4 py-2 bg-black/70 flex gap-3 overflow-x-auto items-end">
          {/* Uploaded assignments - grouped with green border */}
          {uploadedAssignments.map((assignment, aIndex) => (
            <div
              key={assignment.id}
              className="relative flex-shrink-0 flex gap-1 p-1 rounded-lg bg-green-900/50 border border-green-500"
            >
              {/* Delete button for group */}
              <button
                onClick={() => {
                  // Revoke URLs and remove from state
                  assignment.thumbnails.forEach((url) => URL.revokeObjectURL(url));
                  setUploadedAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
                }}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-md"
              >
                ×
              </button>
              {assignment.thumbnails.map((url, pIndex) => (
                <div key={pIndex} className="relative">
                  <img
                    src={url}
                    alt={`Assignment ${aIndex + 1}, Page ${pIndex + 1}`}
                    className="h-10 w-10 object-cover rounded"
                  />
                  {pIndex === 0 && (
                    <span className="absolute -top-1 -left-1 bg-green-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {aIndex + 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Divider if both uploaded and current exist */}
          {uploadedAssignments.length > 0 && totalPages > 0 && (
            <div className="w-px h-12 bg-white/30 flex-shrink-0" />
          )}

          {/* Current assignment pages - blue styling */}
          {totalPages > 0 && (
            <div className="flex-shrink-0 flex gap-1 p-1 rounded-lg bg-blue-900/50 border border-blue-500">
              {pages.map((page, index) => (
                <div key={index} className="relative">
                  <img
                    src={page.url}
                    alt={`Page ${index + 1}`}
                    className="h-10 w-10 object-cover rounded"
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                  />
                  {index === 0 && (
                    <span className="absolute -top-1 -left-1 bg-blue-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {uploadedAssignments.length + 1}
                    </span>
                  )}
                </div>
              ))}
              {/* Current captured image */}
              {capturedImage && (
                <div className="relative ring-2 ring-white rounded">
                  <img
                    src={capturedImage}
                    alt={`Page ${pages.length + 1}`}
                    className="h-10 w-10 object-cover rounded"
                    style={{ transform: `rotate(${rotation}deg)` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="p-4 bg-black/50">
        {capturedImage ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={handleRetake} className="flex-1 max-w-28" disabled={uploading}>
                Retake
              </Button>
              <Button
                variant="outline"
                onClick={handleAddPage}
                className="flex-1 max-w-28 bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                disabled={uploading}
              >
                + Add Page
              </Button>
              <Button
                onClick={handleUsePhoto}
                className="flex-1 max-w-28 bg-green-600 hover:bg-green-700"
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : totalPages > 1 ? `Use Photo (${totalPages})` : 'Use Photo'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            {/* Spacer for balance */}
            <div className="w-14 h-14" />

            {/* Capture button */}
            <button
              onClick={handleCapture}
              disabled={!isActive || uploading}
              className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Capture photo"
            />

            {/* Done button - only show when there are uploaded assignments */}
            {uploadedAssignments.length > 0 ? (
              <button
                onClick={handleClose}
                className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors shadow-lg"
                aria-label="Done - finish batch scan"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  className="h-7 w-7"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </button>
            ) : (
              <div className="w-14 h-14" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
