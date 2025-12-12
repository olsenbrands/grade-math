/**
 * Component Prop Types
 *
 * Centralized type definitions for component props
 * Enables type safety and IDE autocompletion across the app
 */

import type { ReactNode } from 'react';
import type { SubmissionStatus, Student, Submission, GradedResult, AnswerKeyAnswer } from './database';

// =============================================================================
// Common/Shared Types
// =============================================================================

export type Size = 'sm' | 'md' | 'lg';
export type Variant = 'default' | 'outline' | 'ghost' | 'link' | 'destructive';

export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

// =============================================================================
// Layout Components
// =============================================================================

export interface AppShellProps extends BaseComponentProps {
  /** Whether to show the sidebar/navigation */
  showNav?: boolean;
  /** Page title for document/browser tab */
  pageTitle?: string;
}

export interface MobileNavProps {
  /** Whether navigation is open on mobile */
  isOpen: boolean;
  /** Callback when navigation should close */
  onClose: () => void;
  /** Current active route */
  currentPath: string;
}

export interface DesktopSidebarProps {
  /** Current active route */
  currentPath: string;
  /** Whether sidebar is collapsed */
  isCollapsed?: boolean;
  /** Callback to toggle collapsed state */
  onToggleCollapsed?: () => void;
}

// =============================================================================
// Token Components
// =============================================================================

// TokenStatus is defined in api.ts, import from there if needed
// import type { TokenStatus } from './api';

export interface TokenBalanceProps extends BaseComponentProps {
  /** Whether to show "tokens" label */
  showLabel?: boolean;
  /** Size variant */
  size?: Size;
  /** Callback when balance changes */
  onBalanceChange?: (balance: number) => void;
}

export interface LowBalanceWarningProps extends BaseComponentProps {
  /** Current token balance */
  balance: number;
  /** Callback to dismiss warning */
  onDismiss?: () => void;
}

export interface CostPreviewProps extends BaseComponentProps {
  /** Number of submissions to grade */
  submissionCount: number;
  /** Whether to include AI feedback */
  includeFeedback?: boolean;
  /** User's current token balance */
  currentBalance: number;
}

export interface CostBadgeProps extends BaseComponentProps {
  /** Token cost to display */
  cost: number;
}

// =============================================================================
// Submission Components
// =============================================================================

export interface SubmissionListProps {
  /** Project ID to show submissions for */
  projectId: string;
  /** Callback when submissions are modified */
  onRefresh?: () => void;
}

export interface CameraCaptureProps {
  /** Project ID to upload submissions to */
  projectId: string;
  /** Callback when capture is complete */
  onCapture?: (file: File) => void;
  /** Callback when capture is cancelled */
  onCancel?: () => void;
  /** Whether to show alignment guide */
  showGuide?: boolean;
}

export interface BatchScanProps {
  /** Project ID to upload submissions to */
  projectId: string;
  /** Callback when batch upload completes */
  onComplete?: (submissions: Submission[]) => void;
  /** Callback to cancel batch mode */
  onCancel?: () => void;
}

export interface FileUploadProps extends BaseComponentProps {
  /** Project ID to upload submissions to */
  projectId: string;
  /** Accepted file types */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Callback when files are uploaded */
  onUpload?: (files: File[]) => void;
  /** Callback when upload fails */
  onError?: (error: string) => void;
  /** Whether drag-and-drop is disabled */
  disabled?: boolean;
}

export interface StudentAssignmentProps {
  /** Submission ID to assign student to */
  submissionId: string;
  /** Currently assigned student ID */
  currentStudentId?: string | null;
  /** Detected name from AI */
  detectedName?: string | null;
  /** AI confidence score for detected name */
  nameConfidence?: number | null;
  /** Callback when student is assigned */
  onAssign?: (studentId: string | null) => void;
  /** Callback when new student is created */
  onCreate?: (studentName: string) => void;
}

// =============================================================================
// Results Components
// =============================================================================

export interface QuestionResultData {
  questionNumber: number;
  studentAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  pointsAwarded: number;
  pointsPossible: number;
  confidence: number;
  feedback?: string;
  partialCredit?: boolean;
}

export interface StudentResultCardProps extends BaseComponentProps {
  /** Result ID */
  id: string;
  /** Student name (from roster) */
  studentName?: string;
  /** Detected name from AI */
  detectedName?: string;
  /** Points scored */
  totalScore: number;
  /** Total possible points */
  totalPossible: number;
  /** Score as percentage */
  percentage: number;
  /** Individual question results */
  questions: QuestionResultData[];
  /** Whether result needs teacher review */
  needsReview: boolean;
  /** Reason for review flag */
  reviewReason?: string;
  /** AI provider used */
  provider: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Result creation timestamp */
  createdAt: string;
  /** Callback to edit result */
  onEdit?: () => void;
  /** Callback to view original submission */
  onViewSubmission?: () => void;
  /** Callback to share result */
  onShare?: () => void;
  /** Callback to print result */
  onPrint?: () => void;
}

export interface ResultBadgeProps extends BaseComponentProps {
  /** Score as percentage */
  percentage: number;
  /** Whether result needs review */
  needsReview?: boolean;
}

export interface ProjectSummaryProps {
  /** Project ID */
  projectId: string;
  /** Callback when data refreshes */
  onRefresh?: () => void;
}

export interface FeedbackViewProps {
  /** Graded result data */
  result: GradedResult;
  /** Student name */
  studentName?: string;
  /** Project name */
  projectName?: string;
  /** Whether to optimize for printing */
  printMode?: boolean;
}

// =============================================================================
// Answer Key Components
// =============================================================================

// AnswerKeyAnswer is imported from database.ts at the top of this file

export interface AnswerKeyUploadProps {
  /** Project ID */
  projectId: string;
  /** Callback when upload completes */
  onUpload?: () => void;
  /** Callback when upload fails */
  onError?: (error: string) => void;
}

export interface ManualAnswerEntryProps {
  /** Project ID */
  projectId: string;
  /** Existing answers to edit */
  existingAnswers?: AnswerKeyAnswer[];
  /** Number of questions */
  questionCount?: number;
  /** Callback when answers are saved */
  onSave?: (answers: AnswerKeyAnswer[]) => void;
  /** Callback to cancel entry */
  onCancel?: () => void;
}

// =============================================================================
// UI Components
// =============================================================================

export interface ImageLoaderProps extends BaseComponentProps {
  /** Image source URL or storage path */
  src: string;
  /** Image alt text */
  alt: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** Whether to show loading placeholder */
  showPlaceholder?: boolean;
  /** Object fit behavior */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: () => void;
}

export interface PaginationProps extends BaseComponentProps {
  /** Current page (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Whether to show page size selector */
  showPageSize?: boolean;
  /** Current page size */
  pageSize?: number;
  /** Callback when page size changes */
  onPageSizeChange?: (size: number) => void;
  /** Available page size options */
  pageSizeOptions?: number[];
}

export interface SkeletonCardProps extends BaseComponentProps {
  /** Number of skeleton lines */
  lines?: number;
  /** Whether to show an image placeholder */
  hasImage?: boolean;
  /** Whether to show action buttons */
  hasActions?: boolean;
}

export interface SkeletonListProps extends BaseComponentProps {
  /** Number of items to show */
  count?: number;
  /** Whether items have images */
  hasImages?: boolean;
}

export interface LoadingSpinnerProps extends BaseComponentProps {
  /** Spinner size */
  size?: Size;
  /** Loading text */
  text?: string;
  /** Whether to center in container */
  centered?: boolean;
}

export interface ErrorStateProps extends BaseComponentProps {
  /** Error title */
  title?: string;
  /** Error message */
  message: string;
  /** Callback to retry action */
  onRetry?: () => void;
  /** Whether to show retry button */
  showRetry?: boolean;
}

// =============================================================================
// Error Boundary
// =============================================================================

export interface ErrorBoundaryProps {
  /** Child components */
  children: ReactNode;
  /** Fallback UI to show on error */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// =============================================================================
// Offline Indicator
// =============================================================================

export interface OfflineIndicatorProps extends BaseComponentProps {
  /** Position of indicator */
  position?: 'top' | 'bottom';
  /** Whether to show as banner or toast */
  variant?: 'banner' | 'toast';
}

// =============================================================================
// Form Components
// =============================================================================

export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface FormFieldProps extends BaseComponentProps {
  /** Field label */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
}

// =============================================================================
// Modal/Dialog Components
// =============================================================================

export interface ConfirmDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Dialog title */
  title: string;
  /** Dialog description */
  description: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button variant */
  confirmVariant?: 'default' | 'destructive';
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled/closed */
  onCancel: () => void;
  /** Whether action is loading */
  isLoading?: boolean;
}

// =============================================================================
// Status Indicator Types
// =============================================================================

export const STATUS_LABELS: Record<SubmissionStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
};

// =============================================================================
// Utility Type Helpers
// =============================================================================

/** Make specific keys required */
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific keys optional */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Extract props that match a pattern */
export type PropsWithCallbacks<T> = {
  [K in keyof T as K extends `on${string}` ? K : never]: T[K];
};
