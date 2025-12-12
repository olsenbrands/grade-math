'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  isHeicFile,
  isPdfFile,
  processUploadBatch,
  type ProcessedFile,
} from '@/lib/utils/image-processing';

interface FileUploadProps {
  projectId: string;
  onUpload: (files: File[]) => Promise<void>;
  onClose?: () => void;
  maxFiles?: number;
  maxSizeMB?: number;
  maxTotalSizeMB?: number;
}

interface FileWithPreview {
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'uploading' | 'success' | 'error';
  error?: string;
  originalName?: string;
  pageNumber?: number;
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

export function FileUpload({
  onUpload,
  onClose,
  maxFiles = 50,
  maxSizeMB = 5,
  maxTotalSizeMB = 25,
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate current total size
  const totalSizeBytes = files.reduce((sum, f) => sum + f.file.size, 0);
  const totalSizeMB = totalSizeBytes / 1024 / 1024;
  const remainingSizeMB = maxTotalSizeMB - totalSizeMB;

  const validateFile = useCallback((file: File): string | null => {
    // Check by MIME type or extension for HEIC
    const isAcceptedType = ACCEPTED_TYPES.includes(file.type) || isHeicFile(file) || isPdfFile(file);
    if (!isAcceptedType) {
      return 'File type not supported';
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB`;
    }
    return null;
  }, [maxSizeMB]);

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const remaining = maxFiles - files.length;

    if (remaining <= 0) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Check total size limit
    const currentTotalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
    const maxTotalBytes = maxTotalSizeMB * 1024 * 1024;

    // Filter files that would fit within total limit
    let availableBytes = maxTotalBytes - currentTotalBytes;
    const toAdd: File[] = [];
    let skippedForSize = 0;

    for (const file of fileArray.slice(0, remaining)) {
      if (file.size <= availableBytes) {
        toAdd.push(file);
        availableBytes -= file.size;
      } else {
        skippedForSize++;
      }
    }

    if (skippedForSize > 0 && toAdd.length === 0) {
      alert(`Cannot add files: Would exceed ${maxTotalSizeMB}MB total limit`);
      return;
    } else if (skippedForSize > 0) {
      alert(`${skippedForSize} file(s) skipped: Would exceed ${maxTotalSizeMB}MB total limit`);
    }

    if (toAdd.length === 0) return;

    // Check for PDFs or HEIC files that need processing
    const needsProcessing = toAdd.some((f) => isPdfFile(f) || isHeicFile(f));

    if (needsProcessing) {
      setProcessing(true);
      setProcessingMessage('Processing files...');

      try {
        const processed = await processUploadBatch(toAdd, (msg) => {
          setProcessingMessage(msg);
        });

        const newFileItems: FileWithPreview[] = [];
        for (const item of processed) {
          const error = validateFile(item.file);
          const preview = item.file.type.startsWith('image/')
            ? URL.createObjectURL(item.file)
            : '';

          newFileItems.push({
            file: item.file,
            preview,
            status: error ? 'error' : 'pending',
            error: error || undefined,
            originalName: item.originalName,
            pageNumber: item.pageNumber,
          });
        }

        setFiles((prev) => [...prev, ...newFileItems]);
      } catch (error) {
        console.error('Processing error:', error);
        alert('Failed to process some files. Please try again.');
      } finally {
        setProcessing(false);
        setProcessingMessage('');
      }
    } else {
      // No processing needed, add files directly
      const newFileItems: FileWithPreview[] = [];

      for (const file of toAdd) {
        const error = validateFile(file);
        const preview = file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : '';

        newFileItems.push({
          file,
          preview,
          status: error ? 'error' : 'pending',
          error: error || undefined,
        });
      }

      setFiles((prev) => [...prev, ...newFileItems]);
    }
  }, [files, maxFiles, maxTotalSizeMB, validateFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void addFiles(e.target.files);
    }
  }, [addFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const file = prev[index];
      if (file && file.preview && file.preview.startsWith('blob:')) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearAll = useCallback(() => {
    files.forEach((f) => {
      if (f.preview && f.preview.startsWith('blob:')) {
        URL.revokeObjectURL(f.preview);
      }
    });
    setFiles([]);
  }, [files]);

  const handleUpload = useCallback(async () => {
    const validFiles = files.filter((f) => f.status === 'pending');
    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Update statuses to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'pending' ? { ...f, status: 'uploading' as const } : f
        )
      );

      // Upload all files
      await onUpload(validFiles.map((f) => f.file));

      // Update statuses to success
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading' ? { ...f, status: 'success' as const } : f
        )
      );

      setUploadProgress(100);

      // Clear after short delay
      setTimeout(() => {
        clearAll();
        onClose?.();
      }, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading'
            ? { ...f, status: 'error' as const, error: 'Upload failed' }
            : f
        )
      );
    } finally {
      setUploading(false);
    }
  }, [files, onUpload, clearAll, onClose]);

  const pendingCount = files.filter((f) => f.status === 'pending').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Submissions</CardTitle>
        <CardDescription>
          Upload photos or PDFs of student homework
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading || processing}
          />
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
          </div>
          <p className="font-medium">
            {dragActive ? 'Drop files here' : 'Drag and drop files here'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to select files ({maxSizeMB}MB per file, {maxTotalSizeMB}MB total)
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Supports: JPEG, PNG, WebP, HEIC, PDF (multi-page PDFs auto-split)
          </p>
        </div>

        {/* Processing indicator */}
        {processing && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <svg
              className="h-5 w-5 animate-spin text-blue-500"
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
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {processingMessage || 'Processing files...'}
            </span>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-medium">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        totalSizeMB > maxTotalSizeMB * 0.9 ? 'bg-red-500' :
                        totalSizeMB > maxTotalSizeMB * 0.7 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (totalSizeMB / maxTotalSizeMB) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {totalSizeMB.toFixed(1)} / {maxTotalSizeMB}MB
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={uploading || processing}
              >
                Clear all
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {files.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-2 rounded-lg border ${
                    item.status === 'error'
                      ? 'border-destructive/50 bg-destructive/5'
                      : item.status === 'success'
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-border'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                    {item.preview && item.file.type.startsWith('image/') ? (
                      <img
                        src={item.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
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
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14,2 14,8 20,8" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.file.name}
                      {item.pageNumber && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (Page {item.pageNumber})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                      {item.originalName && item.originalName !== item.file.name && (
                        <span className="ml-1">from {item.originalName}</span>
                      )}
                      {item.error && (
                        <span className="text-destructive ml-2">- {item.error}</span>
                      )}
                    </p>
                  </div>

                  {/* Status/Remove */}
                  <div className="flex-shrink-0">
                    {item.status === 'uploading' ? (
                      <svg
                        className="h-5 w-5 animate-spin text-primary"
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
                    ) : item.status === 'success' ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="h-5 w-5 text-green-500"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={uploading}
                        className="h-8 w-8 p-0"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          className="h-4 w-4"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleUpload}
            disabled={pendingCount === 0 || uploading || processing}
            className="flex-1"
          >
            {uploading
              ? 'Uploading...'
              : processing
              ? 'Processing...'
              : `Upload ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose} disabled={uploading || processing}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
