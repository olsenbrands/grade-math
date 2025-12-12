'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCamera } from '@/hooks/useCamera';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
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

  const handleConfirm = useCallback(() => {
    if (!capturedImage) return;

    // If rotated, we need to apply rotation
    if (rotation !== 0) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Swap dimensions for 90/270 rotation
        if (rotation === 90 || rotation === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        // Rotate and draw
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `capture-${Date.now()}.jpg`, {
                type: 'image/jpeg',
              });
              onCapture(file);
              handleRetake();
              stop();
            }
          },
          'image/jpeg',
          0.9
        );
      };
      img.src = capturedImage;
    } else {
      // No rotation, use original blob
      fetch(capturedImage)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], `capture-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          onCapture(file);
          handleRetake();
          stop();
        });
    }
  }, [capturedImage, rotation, onCapture, handleRetake, stop]);

  const handleClose = useCallback(() => {
    stop();
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    onClose?.();
  }, [stop, capturedImage, onClose]);

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

      {/* Controls */}
      <div className="p-4 bg-black/50">
        {capturedImage ? (
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" onClick={handleRetake} className="flex-1 max-w-32">
              Retake
            </Button>
            <Button onClick={handleConfirm} className="flex-1 max-w-32">
              Use Photo
            </Button>
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
