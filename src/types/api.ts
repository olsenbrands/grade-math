/**
 * API Request and Response Types
 *
 * Comprehensive type definitions for all API endpoints
 */

import type { TokenLedgerEntry, GradedProblem } from './database';

// =============================================================================
// Common Types
// =============================================================================

export interface ApiError {
  error: string;
}

export interface ApiSuccess {
  success: true;
}

// =============================================================================
// Token API Types
// =============================================================================

export type TokenStatus = 'healthy' | 'low' | 'critical' | 'zero';

// GET /api/tokens
export interface TokenBalanceResponse {
  balance: number;
  status: TokenStatus;
  canGrade: boolean;
}

// POST /api/tokens - action: history
export interface TokenHistoryRequest {
  action: 'history';
  limit?: number;
}

export interface TokenHistoryResponse {
  transactions: TokenLedgerEntry[];
}

// POST /api/tokens - action: check-cost
export interface TokenCheckCostRequest {
  action: 'check-cost';
  submissionCount: number;
  includeFeedback?: boolean;
}

export interface TokenCheckCostResponse {
  cost: number;
  currentBalance: number;
  canAfford: boolean;
  remaining: number;
  hasDiscount: boolean;
  savings: number;
}

// POST /api/tokens - action: admin-grant
export interface TokenAdminGrantRequest {
  action: 'admin-grant';
  targetUserId: string;
  amount: number;
  reason?: string;
}

export interface TokenAdminGrantResponse {
  success: true;
  transactionId: string;
  newBalance: number;
}

// Union type for all token POST requests
export type TokenPostRequest =
  | TokenHistoryRequest
  | TokenCheckCostRequest
  | TokenAdminGrantRequest;

// Union type for all token POST responses
export type TokenPostResponse =
  | TokenHistoryResponse
  | TokenCheckCostResponse
  | TokenAdminGrantResponse;

// =============================================================================
// Grouping API Types
// =============================================================================

export type MatchType = 'exact' | 'fuzzy' | 'partial' | 'first_name' | 'last_name';

export interface StudentMatch {
  studentId: string;
  studentName: string;
  confidence: number;
  matchType: MatchType;
}

// GET /api/grouping
export interface GroupingStatsResponse {
  total: number;
  assigned: number;
  unassigned: number;
  withDetectedName: number;
  withoutDetectedName: number;
  avgConfidence?: number;
}

// POST /api/grouping - action: auto-group
export interface AutoGroupRequest {
  action: 'auto-group';
  submissionId: string;
  detectedName?: string;
  nameConfidence?: number;
}

export interface AutoGroupResponse {
  submissionId: string;
  detectedName: string | null;
  nameConfidence: number;
  matches: StudentMatch[];
  assigned: boolean;
  assignedTo?: {
    studentId: string;
    studentName: string;
  };
  needsReview: boolean;
}

// POST /api/grouping - action: batch-auto-group
export interface BatchAutoGroupRequest {
  action: 'batch-auto-group';
  projectId: string;
}

export interface BatchAutoGroupResponse {
  processed: number;
  assigned: number;
  needsReview: number;
  results: AutoGroupResponse[];
}

// POST /api/grouping - action: manual-assign
export interface ManualAssignRequest {
  action: 'manual-assign';
  submissionId: string;
  studentId: string;
}

export interface ManualAssignResponse {
  success: true;
}

// POST /api/grouping - action: create-and-assign
export interface CreateAndAssignRequest {
  action: 'create-and-assign';
  submissionId: string;
  studentName: string;
}

export interface CreateAndAssignResponse {
  success: true;
  studentId: string;
}

// POST /api/grouping - action: save-correction
export interface SaveCorrectionRequest {
  action: 'save-correction';
  detectedName: string;
  correctStudentId: string;
}

export interface SaveCorrectionResponse {
  success: true;
}

// POST /api/grouping - action: match-preview
export interface MatchPreviewRequest {
  action: 'match-preview';
  detectedName: string;
}

export interface MatchPreviewResponse {
  matches: StudentMatch[];
}

// Union types for grouping
export type GroupingPostRequest =
  | AutoGroupRequest
  | BatchAutoGroupRequest
  | ManualAssignRequest
  | CreateAndAssignRequest
  | SaveCorrectionRequest
  | MatchPreviewRequest;

export type GroupingPostResponse =
  | AutoGroupResponse
  | BatchAutoGroupResponse
  | ManualAssignResponse
  | CreateAndAssignResponse
  | SaveCorrectionResponse
  | MatchPreviewResponse;

// =============================================================================
// Grading API Types
// =============================================================================

// POST /api/grading/process
export interface GradingProcessRequest {
  projectId: string;
  submissionIds: string[];
  includeFeedback?: boolean;
}

export interface GradingProcessResponse {
  success: true;
  processed: number;
  succeeded: number;
  failed: number;
  results: GradingProcessResult[];
}

export interface GradingProcessResult {
  submissionId: string;
  success: boolean;
  error?: string;
}

// GET /api/grading/process
export interface GradingQueueStatusResponse {
  queue: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  };
  providers: string[];
}

// GET /api/grading/submission/[id]
export interface GradingResultResponse {
  id: string;
  submissionId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  questions: GradingQuestionResult[];
  feedback: string | null;
  needsReview: boolean;
  gradedAt: string;
}

export interface GradingQuestionResult {
  number: number;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  maxPoints: number;
  confidence: number;
}

// =============================================================================
// Projects API Types (for future use)
// =============================================================================

export interface ProjectCreateRequest {
  name: string;
  description?: string;
  date?: string;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  date?: string;
  is_archived?: boolean;
}

export interface ProjectWithStats {
  id: string;
  name: string;
  description: string | null;
  date: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  submission_count: number;
  graded_count: number;
  average_score: number | null;
  has_answer_key: boolean;
}

// =============================================================================
// Submissions API Types (for future use)
// =============================================================================

export interface SubmissionUploadResponse {
  id: string;
  storage_path: string;
  original_filename: string;
  status: 'pending';
  created_at: string;
}

export interface BatchUploadResponse {
  successful: SubmissionUploadResponse[];
  failed: {
    filename: string;
    error: string;
  }[];
}

// =============================================================================
// Authentication Types
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  school_name?: string;
  grade_level?: string;
  avatar_url?: string;
}

export interface ProfileUpdateRequest {
  full_name?: string;
  school_name?: string;
  grade_level?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as ApiError).error === 'string'
  );
}

export function isTokenHistoryRequest(req: TokenPostRequest): req is TokenHistoryRequest {
  return req.action === 'history';
}

export function isTokenCheckCostRequest(req: TokenPostRequest): req is TokenCheckCostRequest {
  return req.action === 'check-cost';
}

export function isTokenAdminGrantRequest(req: TokenPostRequest): req is TokenAdminGrantRequest {
  return req.action === 'admin-grant';
}

export function isAutoGroupRequest(req: GroupingPostRequest): req is AutoGroupRequest {
  return req.action === 'auto-group';
}

export function isBatchAutoGroupRequest(req: GroupingPostRequest): req is BatchAutoGroupRequest {
  return req.action === 'batch-auto-group';
}

export function isManualAssignRequest(req: GroupingPostRequest): req is ManualAssignRequest {
  return req.action === 'manual-assign';
}
