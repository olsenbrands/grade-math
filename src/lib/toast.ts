/**
 * Toast Notification Utilities
 *
 * Provides consistent toast notifications throughout the app
 * Uses sonner under the hood
 */

import { toast as sonnerToast } from 'sonner';

/**
 * Success toast - for completed actions
 */
export function toastSuccess(message: string, description?: string) {
  sonnerToast.success(message, {
    description,
    duration: 4000,
  });
}

/**
 * Error toast - for failures and errors
 */
export function toastError(message: string, description?: string) {
  sonnerToast.error(message, {
    description,
    duration: 6000,
  });
}

/**
 * Warning toast - for non-critical issues
 */
export function toastWarning(message: string, description?: string) {
  sonnerToast.warning(message, {
    description,
    duration: 5000,
  });
}

/**
 * Info toast - for informational messages
 */
export function toastInfo(message: string, description?: string) {
  sonnerToast.info(message, {
    description,
    duration: 4000,
  });
}

/**
 * Loading toast - returns dismiss function
 * Use for async operations
 */
export function toastLoading(message: string) {
  return sonnerToast.loading(message);
}

/**
 * Promise toast - for async operations with automatic state
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
) {
  return sonnerToast.promise(promise, messages);
}

/**
 * Dismiss a specific toast or all toasts
 */
export function toastDismiss(toastId?: string | number) {
  if (toastId) {
    sonnerToast.dismiss(toastId);
  } else {
    sonnerToast.dismiss();
  }
}

// Pre-configured toasts for common actions
export const appToasts = {
  // Grading
  gradingStarted: () =>
    toastLoading('Grading submission...'),

  gradingComplete: (score: number, total: number) =>
    toastSuccess('Grading complete', `Score: ${score}/${total}`),

  gradingFailed: (error?: string) =>
    toastError('Grading failed', error || 'Please try again'),

  // Token operations
  tokensDeducted: (amount: number) =>
    toastInfo(`${amount} token${amount !== 1 ? 's' : ''} used`),

  lowTokens: (remaining: number) =>
    toastWarning('Low token balance', `${remaining} tokens remaining`),

  noTokens: () =>
    toastError('No tokens available', 'Please purchase more tokens to continue'),

  // Project operations
  projectCreated: (name: string) =>
    toastSuccess('Project created', name),

  projectDeleted: () =>
    toastSuccess('Project deleted'),

  // Upload
  uploadStarted: (count: number) =>
    toastLoading(`Uploading ${count} file${count !== 1 ? 's' : ''}...`),

  uploadComplete: (count: number) =>
    toastSuccess('Upload complete', `${count} file${count !== 1 ? 's' : ''} uploaded`),

  uploadFailed: (error?: string) =>
    toastError('Upload failed', error || 'Please try again'),

  // Auth
  loginSuccess: () =>
    toastSuccess('Welcome back!'),

  logoutSuccess: () =>
    toastInfo('Signed out'),

  sessionExpired: () =>
    toastWarning('Session expired', 'Please sign in again'),

  // Network
  offline: () =>
    toastWarning('You\'re offline', 'Some features may not work'),

  backOnline: () =>
    toastSuccess('Back online'),

  // Generic
  saved: () =>
    toastSuccess('Changes saved'),

  deleted: () =>
    toastSuccess('Deleted successfully'),

  copied: () =>
    toastSuccess('Copied to clipboard'),

  error: (message?: string) =>
    toastError('Something went wrong', message || 'Please try again'),
};

// Re-export for convenience
export { sonnerToast as toast };
