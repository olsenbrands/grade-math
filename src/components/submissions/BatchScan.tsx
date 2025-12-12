'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCamera } from '@/hooks/useCamera';
import {
  calculateFrameStability,
  analyzeForDocument,
} from '@/lib/utils/image-processing';

interface BatchScanProps {
  onCapture: (files: File[]) => Promise<void>;
  onClose: () => void;
}

interface CapturedImage {
  id: string;
  file: File;
  preview: string;
  timestamp: Date;
}

// Configuration for auto-capture
const AUTO_CAPTURE_CONFIG = {
  stabilityThreshold: 0.97, // How stable the image needs to be (0-1)
  minStableFrames: 8, // Number of consecutive stable frames needed
  captureDelay: 500, // Delay after stability detected before capture (ms)
  cooldownAfterCapture: 1500, // Time to wait before next auto-capture (ms)
  documentConfidenceThreshold: 0.6, // Minimum confidence that a document is in frame
};

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
  } = useCamera({ facingMode: 'environment', width: 1920, height: 1080 });

  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [stability, setStability] = useState(0);
  const [documentDetected, setDocumentDetected] = useState(false);

  // Refs for auto-capture logic
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableFrameCountRef = useRef(0);
  const lastCaptureTimeRef = useRef(0);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize camera on mount
  useEffect(() => {
    start();
    return () => {
      stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [start, stop]);

  // Create analysis canvas (smaller for performance)
  useEffect(() => {
    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas');
      analysisCanvasRef.current.width = 320;
      analysisCanvasRef.current.height = 240;
    }
  }, []);

  // Auto-capture loop
  useEffect(() => {
    if (!isAutoMode || !isActive || !videoRef.current) {
      return;
    }

    const analyzeFrame = () => {
      if (!videoRef.current || !analysisCanvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx || video.videoWidth === 0) {
        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }

      // Draw scaled down frame for analysis
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const currentFrame = imageData.data;

      // Analyze for document
      const docAnalysis = analyzeForDocument(imageData);
      setDocumentDetected(docAnalysis.isLikelyDocument);

      // Calculate stability
      if (previousFrameRef.current) {
        const frameStability = calculateFrameStability(
          previousFrameRef.current,
          currentFrame,
          5
        );
        setStability(frameStability);

        // Check if stable enough and document detected
        const now = Date.now();
        const cooldownPassed =
          now - lastCaptureTimeRef.current > AUTO_CAPTURE_CONFIG.cooldownAfterCapture;

        if (
          frameStability > AUTO_CAPTURE_CONFIG.stabilityThreshold &&
          docAnalysis.confidence > AUTO_CAPTURE_CONFIG.documentConfidenceThreshold &&
          cooldownPassed
        ) {
          stableFrameCountRef.current++;
          setFeedback(`Hold steady... ${stableFrameCountRef.current}/${AUTO_CAPTURE_CONFIG.minStableFrames}`);

          if (stableFrameCountRef.current >= AUTO_CAPTURE_CONFIG.minStableFrames) {
            // Auto-capture!
            setTimeout(() => {
              handleCapture();
              stableFrameCountRef.current = 0;
              lastCaptureTimeRef.current = Date.now();
              setFeedback('Captured! Move to next page...');
            }, AUTO_CAPTURE_CONFIG.captureDelay);
            stableFrameCountRef.current = 0;
          }
        } else {
          stableFrameCountRef.current = 0;
          if (!cooldownPassed) {
            setFeedback('Move to next page...');
          } else if (!docAnalysis.isLikelyDocument) {
            setFeedback(docAnalysis.feedback);
          } else if (frameStability <= AUTO_CAPTURE_CONFIG.stabilityThreshold) {
            setFeedback('Hold camera steady...');
          }
        }
      }

      // Store current frame for next comparison
      previousFrameRef.current = new Uint8ClampedArray(currentFrame);

      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
    };

    animationFrameRef.current = requestAnimationFrame(analyzeFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAutoMode, isActive, videoRef]);

  const handleCapture = useCallback(() => {
    const blob = capture();
    if (!blob) return;

    const id = `capture-${Date.now()}`;
    const file = new File([blob], `${id}.jpg`, { type: 'image/jpeg' });
    const preview = URL.createObjectURL(blob);

    setCapturedImages((prev) => [
      ...prev,
      {
        id,
        file,
        preview,
        timestamp: new Date(),
      },
    ]);
  }, [capture]);

  const removeCapture = useCallback((id: string) => {
    setCapturedImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearAllCaptures = useCallback(() => {
    capturedImages.forEach((img) => URL.revokeObjectURL(img.preview));
    setCapturedImages([]);
  }, [capturedImages]);

  const handleUpload = useCallback(async () => {
    if (capturedImages.length === 0) return;

    setUploading(true);
    try {
      await onCapture(capturedImages.map((img) => img.file));
      clearAllCaptures();
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload images. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [capturedImages, onCapture, clearAllCaptures, onClose]);

  const toggleAutoMode = useCallback(() => {
    setIsAutoMode((prev) => !prev);
    setFeedback('');
    stableFrameCountRef.current = 0;
    previousFrameRef.current = null;
  }, []);

  if (!hasCamera) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">
              {error || 'Camera not available on this device'}
            </p>
            <Button onClick={onClose}>Close</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <svg
                className="h-8 w-8 animate-spin mx-auto mb-2"
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
              <p>Starting camera...</p>
            </div>
          </div>
        )}

        {/* Document alignment guide */}
        <div className="absolute inset-4 pointer-events-none">
          <div
            className={`w-full h-full border-2 rounded-lg transition-colors ${
              documentDetected
                ? 'border-green-500'
                : 'border-white/50'
            }`}
          />
          {/* Corner indicators */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
        </div>

        {/* Status overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          {/* Auto mode indicator */}
          <div
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              isAutoMode
                ? 'bg-green-500 text-white'
                : 'bg-white/20 text-white'
            }`}
          >
            {isAutoMode ? 'AUTO' : 'MANUAL'}
          </div>

          {/* Capture count */}
          <div className="bg-black/50 text-white px-3 py-1.5 rounded-full text-sm">
            {capturedImages.length} captured
          </div>
        </div>

        {/* Feedback */}
        {isAutoMode && feedback && (
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 text-center">
            <div className="inline-block bg-black/70 text-white px-4 py-2 rounded-lg text-lg font-medium">
              {feedback}
            </div>
          </div>
        )}

        {/* Stability indicator (auto mode) */}
        {isAutoMode && (
          <div className="absolute bottom-32 left-4 right-4">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  stability > AUTO_CAPTURE_CONFIG.stabilityThreshold
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                }`}
                style={{ width: `${stability * 100}%` }}
              />
            </div>
            <p className="text-white/70 text-xs text-center mt-1">
              Stability: {Math.round(stability * 100)}%
            </p>
          </div>
        )}

        {/* Captured thumbnails */}
        {capturedImages.length > 0 && (
          <div className="absolute bottom-24 left-4 right-4">
            <div className="flex gap-2 overflow-x-auto py-2">
              {capturedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-white"
                >
                  <img
                    src={img.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeCapture(img.id)}
                    className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs rounded-bl"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black p-4 safe-area-pb">
        <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
            disabled={uploading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-6 w-6"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>

          {/* Capture button (manual mode) or Auto toggle */}
          <div className="flex gap-2">
            <Button
              variant={isAutoMode ? 'outline' : 'default'}
              size="lg"
              onClick={isAutoMode ? toggleAutoMode : handleCapture}
              disabled={!isActive || uploading}
              className={`rounded-full w-16 h-16 ${
                isAutoMode
                  ? 'bg-white/20 border-white text-white'
                  : 'bg-white hover:bg-white/90'
              }`}
            >
              {isAutoMode ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-6 w-6"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <div className="w-10 h-10 rounded-full border-4 border-current" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAutoMode}
              disabled={uploading}
              className="bg-white/10 border-white/50 text-white hover:bg-white/20"
            >
              {isAutoMode ? 'Manual' : 'Auto'}
            </Button>
          </div>

          {/* Upload button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUpload}
            disabled={capturedImages.length === 0 || uploading}
            className="text-white hover:bg-white/20"
          >
            {uploading ? (
              <svg
                className="h-6 w-6 animate-spin"
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
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-6 w-6"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </Button>
        </div>

        {/* Action hint */}
        <p className="text-white/60 text-xs text-center mt-2">
          {isAutoMode
            ? 'Hold camera steady over each page - auto-captures when stable'
            : 'Tap capture button for each page, then upload all'}
        </p>
      </div>
    </div>
  );
}
