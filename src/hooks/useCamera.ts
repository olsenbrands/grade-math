'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  hasCamera: boolean;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => Blob | null;
  switchCamera: () => Promise<void>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { facingMode = 'environment', width = 1920, height = 1080 } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [currentFacingMode, setCurrentFacingMode] = useState(facingMode);

  // Check for camera support
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setHasCamera(false);
      setError('Camera not supported on this device');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (!hasCamera) {
      setError('Camera not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof Error) {
        // Ignore "play() interrupted" errors - these happen in React strict mode
        // when the component remounts quickly and are not real camera issues
        if (err.name === 'AbortError' || err.message.includes('interrupted')) {
          setIsLoading(false);
          return;
        }
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
          setHasCamera(false);
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError('Failed to access camera');
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasCamera, currentFacingMode, width, height]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  const capture = useCallback((): Blob | null => {
    if (!videoRef.current || !canvasRef.current || !isActive) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Convert to blob
    let blob: Blob | null = null;
    canvas.toBlob(
      (b) => {
        blob = b;
      },
      'image/jpeg',
      0.9
    );

    // toBlob is async, but we need sync return
    // Use a workaround with toDataURL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // Parse data URL: data:mime/type;base64,BASE64DATA
    const dataParts = dataUrl.split(',');
    const base64Data = dataParts[1];
    if (!base64Data) return null;

    const metaPart = dataParts[0];
    if (!metaPart) return null;

    const mimeMatch = metaPart.split(':')[1];
    if (!mimeMatch) return null;

    const mimeString = mimeMatch.split(';')[0];
    if (!mimeString) return null;

    const byteString = atob(base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }, [isActive]);

  const switchCamera = useCallback(async () => {
    const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    setCurrentFacingMode(newFacingMode);

    if (isActive) {
      stop();
      // Small delay to ensure stream is fully stopped
      await new Promise(resolve => setTimeout(resolve, 100));
      await start();
    }
  }, [currentFacingMode, isActive, stop, start]);

  return {
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
  };
}
