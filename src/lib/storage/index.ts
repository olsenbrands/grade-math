/**
 * Storage utilities for Supabase Storage
 * Centralized signed URL generation and file management
 */

import { createClient } from '@/lib/supabase/client';

// Storage bucket names
export const BUCKETS = {
  SUBMISSIONS: 'submissions',
  ANSWER_KEYS: 'answer-keys',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// Default signed URL expiry times (in seconds)
export const URL_EXPIRY = {
  SHORT: 300, // 5 minutes
  DEFAULT: 3600, // 1 hour
  LONG: 86400, // 24 hours
} as const;

export interface SignedUrlOptions {
  /** Expiry time in seconds (default: 3600) */
  expiresIn?: number;
  /** Transform options for images */
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
  };
}

export interface SignedUrlResult {
  signedUrl: string;
  path: string;
  expiresAt: Date;
}

/**
 * Generate a signed URL for a file in storage
 */
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  options: SignedUrlOptions = {}
): Promise<SignedUrlResult> {
  const supabase = createClient();
  const expiresIn = options.expiresIn ?? URL_EXPIRY.DEFAULT;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, {
      transform: options.transform,
    });

  if (error) {
    console.error(`Error creating signed URL for ${bucket}/${path}:`, error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return {
    signedUrl: data.signedUrl,
    path,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

/**
 * Generate signed URLs for multiple files
 */
export async function getSignedUrls(
  bucket: BucketName,
  paths: string[],
  options: SignedUrlOptions = {}
): Promise<Map<string, SignedUrlResult>> {
  const results = new Map<string, SignedUrlResult>();

  // Process in parallel for better performance
  const promises = paths.map(async (path) => {
    try {
      const result = await getSignedUrl(bucket, path, options);
      return { path, result, error: null };
    } catch (error) {
      return { path, result: null, error };
    }
  });

  const resolved = await Promise.all(promises);

  for (const { path, result } of resolved) {
    if (result) {
      results.set(path, result);
    }
  }

  return results;
}

/**
 * Get a thumbnail URL for an image (smaller dimensions)
 */
export async function getThumbnailUrl(
  bucket: BucketName,
  path: string,
  size: number = 200
): Promise<string> {
  const result = await getSignedUrl(bucket, path, {
    expiresIn: URL_EXPIRY.DEFAULT,
    transform: {
      width: size,
      height: size,
      quality: 80,
    },
  });

  return result.signedUrl;
}

/**
 * Upload a file to storage
 */
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: File | Blob,
  options?: {
    contentType?: string;
    upsert?: boolean;
  }
): Promise<{ path: string }> {
  const supabase = createClient();

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: options?.contentType || file.type,
    upsert: options?.upsert ?? false,
  });

  if (error) {
    console.error(`Error uploading to ${bucket}/${path}:`, error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return { path };
}

/**
 * Delete a file from storage
 */
export async function deleteFile(bucket: BucketName, path: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    console.error(`Error deleting ${bucket}/${path}:`, error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Delete multiple files from storage
 */
export async function deleteFiles(bucket: BucketName, paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const supabase = createClient();

  const { error } = await supabase.storage.from(bucket).remove(paths);

  if (error) {
    console.error(`Error deleting files from ${bucket}:`, error);
    throw new Error(`Failed to delete files: ${error.message}`);
  }
}

/**
 * Generate a unique storage path for a user's file
 */
export function generateStoragePath(
  userId: string,
  prefix: string,
  filename: string
): string {
  const timestamp = Date.now();
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  return `${userId}/${prefix}-${timestamp}.${ext}`;
}

/**
 * Check if a file exists in storage
 */
export async function fileExists(bucket: BucketName, path: string): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase.storage.from(bucket).list(
    path.split('/').slice(0, -1).join('/'),
    {
      search: path.split('/').pop(),
    }
  );

  if (error) {
    return false;
  }

  return data.length > 0;
}
