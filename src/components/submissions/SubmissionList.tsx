'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getSubmissions,
  getSubmissionUrl,
  deleteSubmission,
  assignStudent,
  type SubmissionWithDetails,
  type SubmissionFilters,
} from '@/lib/services/submissions';
import { createClient } from '@/lib/supabase/client';
import { getStudents } from '@/lib/services/students';
import type { Student, SubmissionStatus } from '@/types/database';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DiagramRenderer } from '@/components/diagrams';

export interface BatchGradingStatus {
  currentId: string | null;
  queueIds: string[];
}

interface SubmissionListProps {
  projectId: string;
  onRefresh?: () => void;
  batchGradingStatus?: BatchGradingStatus;
}

const STATUS_LABELS: Record<SubmissionStatus, { label: string; color: string }> = {
  pending: { label: 'Not Graded', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  processing: { label: 'Grading...', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  completed: { label: 'Graded', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  needs_review: { label: 'Needs Review', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  failed: { label: 'Try Again', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

interface QuestionDetail {
  questionNumber: number;
  problemText?: string;
  aiCalculation?: string;
  aiAnswer?: string;
  studentAnswer: string | null;
  correctAnswer: string;
  answerKeyValue?: string | null;
  isCorrect: boolean;
  pointsAwarded: number;
  pointsPossible: number;
  confidence: number;
  readabilityConfidence?: number;
  readabilityIssue?: string | null;
  discrepancy?: string | null;
  // Multi-AI confidence fields
  ocrConfidence?: number;
  verificationMethod?: 'wolfram' | 'chain_of_thought' | 'none';
  wolframVerified?: boolean;
  verificationConflict?: boolean;
  hasReadingConflict?: boolean;
  // Service usage tracking
  mathpixUsed?: boolean;
  mathpixLatex?: string;
  mathpixText?: string;
  // Smart Explanations
  explanation?: {
    gradeLevel: string;
    methodology?: string;
    steps: string[];
    whatYouDidRight: string | null;
    whatToImprove: string | null;
    encouragement: string | null;
    generatedAt: string;
    // Visual diagram data
    diagram?: {
      type: 'bar-model' | 'number-line' | 'fraction-visual' | 'array-grid';
      data: Record<string, unknown>;
      textFallback: string;
    } | null;
  } | null;
}

interface GradingResultDetail {
  resultId: string;
  questionsJson: QuestionDetail[];
  needsReview: boolean;
  reviewReason?: string;
  provider: string;
  model: string;
  processingTimeMs: number;
}

/**
 * Determine which AI services were used for this question
 */
function getServicesUsed(question: QuestionDetail): {
  mathpix: boolean;
  vision: boolean;
  wolfram: boolean;
} {
  // Mathpix: used if we have ocrConfidence, mathpixLatex/mathpixText, or explicit flag
  const mathpix = !!(question.ocrConfidence || question.mathpixUsed || question.mathpixLatex || question.mathpixText);

  // Vision (GPT-4o): always used for grading currently
  const vision = true;

  // Wolfram: used if verification method is wolfram or wolframVerified is set
  const wolfram = question.verificationMethod === 'wolfram' || question.wolframVerified === true;

  return { mathpix, vision, wolfram };
}

/**
 * AI Services indicator - shows which services were used with colored dots
 *
 * All dots are solid green when answer is correct
 * A ring/stroke around the dot indicates that specific AI service was used
 *
 * Dot 1 (OCR):     Ring = Mathpix used
 * Dot 2 (Solving): Ring = Always (GPT-4o always used)
 * Dot 3 (Verify):  Ring = Wolfram used
 */
function AIServicesIndicator({ question }: { question: QuestionDetail }) {
  const services = getServicesUsed(question);
  const hasConflict = question.hasReadingConflict || question.verificationConflict;
  const hasIssue = question.readabilityIssue || (question.confidence < 0.7);

  // Base color - green for correct, red for incorrect, yellow for issues
  const baseColor = hasConflict
    ? 'bg-orange-500'
    : hasIssue
      ? 'bg-yellow-500'
      : question.isCorrect
        ? 'bg-green-500'
        : 'bg-red-500';

  // Ring color when service is used
  const ringClass = 'ring-2 ring-offset-1';
  const mathpixRing = services.mathpix ? `${ringClass} ring-emerald-600` : '';
  const visionRing = `${ringClass} ring-green-600`; // Always used
  const wolframRing = services.wolfram ? `${ringClass} ring-blue-500` : '';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            {/* Dot 1: Reading/OCR */}
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${baseColor} ${mathpixRing}`} />
            {/* Dot 2: Solving */}
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${baseColor} ${visionRing}`} />
            {/* Dot 3: Verification */}
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${baseColor} ${wolframRing}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="w-56">
          <div className="space-y-2">
            <p className="font-medium text-xs border-b pb-1">AI Services Used</p>
            <p className="text-xs text-muted-foreground">Ring around dot = service was used</p>

            {/* OCR Service */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full bg-green-500 ${mathpixRing}`} />
                <span>Reading</span>
              </div>
              <span className={services.mathpix ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                {services.mathpix ? 'Mathpix OCR' : 'Vision Only'}
              </span>
            </div>

            {/* Solving Service */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full bg-green-500 ${visionRing}`} />
                <span>Solving</span>
              </div>
              <span className="text-green-600 font-medium">Active</span>
            </div>

            {/* Verification Service */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full bg-green-500 ${wolframRing}`} />
                <span>Verified</span>
              </div>
              <span className={services.wolfram ? 'text-blue-600 font-medium' : 'text-muted-foreground'}>
                {services.wolfram ? 'Wolfram' : 'Not used'}
              </span>
            </div>

            {/* Warnings */}
            {hasConflict && (
              <p className="text-xs text-orange-600 pt-1 border-t">
                AI disagreement detected - review recommended
              </p>
            )}
            {hasIssue && !hasConflict && (
              <p className="text-xs text-yellow-600 pt-1 border-t">
                Low confidence - may need review
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SubmissionList({ projectId, onRefresh, batchGradingStatus }: SubmissionListProps) {
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [grading, setGrading] = useState<string | null>(null);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingResults, setGradingResults] = useState<Record<string, GradingResultDetail | null>>({});
  const [loadingResult, setLoadingResult] = useState<string | null>(null);
  const [generatingExplanations, setGeneratingExplanations] = useState<string | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [expandedExplanations, setExpandedExplanations] = useState<Set<number>>(new Set());
  const [hasSmartExplanations, setHasSmartExplanations] = useState<boolean | null>(null);

  // Fetch grading result details for a submission
  const fetchGradingResult = useCallback(async (submissionId: string, force = false) => {
    if (!force && gradingResults[submissionId] !== undefined) return; // Already fetched or loading

    try {
      setLoadingResult(submissionId);
      const response = await fetch(`/api/grading/submission/${submissionId}`);
      if (response.ok) {
        const data = await response.json();
        setGradingResults(prev => ({ ...prev, [submissionId]: data }));
      } else {
        setGradingResults(prev => ({ ...prev, [submissionId]: null }));
      }
    } catch {
      setGradingResults(prev => ({ ...prev, [submissionId]: null }));
    } finally {
      setLoadingResult(null);
    }
  }, [gradingResults]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: SubmissionFilters = { projectId };
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      const [subs, studentList] = await Promise.all([
        getSubmissions(filters),
        getStudents(),
      ]);

      // Sort: oldest first by created_at
      const sortedSubs = [...subs].sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      setSubmissions(sortedSubs);
      setStudents(studentList);

      // Load image URLs for thumbnails
      const urls: Record<string, string> = {};
      for (const sub of subs.slice(0, 20)) {
        try {
          urls[sub.id] = await getSubmissionUrl(sub.storage_path);
        } catch {
          // Ignore errors for individual URLs
        }
      }
      setImageUrls(urls);
    } catch (err) {
      setError('Failed to load submissions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if user has Smart Explanations add-on
  useEffect(() => {
    async function checkSmartExplanations() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setHasSmartExplanations(false);
          return;
        }

        const { data } = await supabase
          .from('user_subscriptions')
          .select('has_smart_explanations')
          .eq('user_id', user.id)
          .single();

        setHasSmartExplanations(data?.has_smart_explanations === true);
      } catch {
        setHasSmartExplanations(false);
      }
    }
    checkSmartExplanations();
  }, []);

  // Generate explanations for a graded result
  const handleGenerateExplanations = useCallback(async (resultId: string, submissionId: string) => {
    try {
      setGeneratingExplanations(resultId);
      setExplanationError(null);

      const response = await fetch('/api/explanations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'ADDON_REQUIRED') {
          setExplanationError('Smart Explanations add-on required. Upgrade in Settings.');
          return;
        }
        throw new Error(data.error || 'Failed to generate explanations');
      }

      // Force refetch to get the updated result with explanations
      await fetchGradingResult(submissionId, true);

    } catch (err) {
      console.error('Failed to generate explanations:', err);
      setExplanationError(err instanceof Error ? err.message : 'Failed to generate explanations');
    } finally {
      setGeneratingExplanations(null);
    }
  }, [fetchGradingResult]);

  const toggleExplanation = (questionNumber: number) => {
    setExpandedExplanations(prev => {
      const next = new Set(prev);
      if (next.has(questionNumber)) {
        next.delete(questionNumber);
      } else {
        next.add(questionNumber);
      }
      return next;
    });
  };

  const toggleSelectForDelete = (id: string) => {
    setSelectedForDelete(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchDeleteConfirm = async () => {
    if (selectedForDelete.size === 0) return;

    try {
      setDeleting(true);
      setShowDeleteConfirm(false);

      // Delete all selected submissions
      const deletePromises = Array.from(selectedForDelete).map(id =>
        deleteSubmission(id).catch(err => {
          console.error(`Failed to delete ${id}:`, err);
          return null;
        })
      );

      await Promise.all(deletePromises);
      setSelectedForDelete(new Set());
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error(err);
      alert('Failed to delete some submissions');
    } finally {
      setDeleting(false);
    }
  };

  const handleAssign = async (submissionId: string, studentId: string | null) => {
    try {
      setAssigning(submissionId);
      await assignStudent(submissionId, studentId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to assign student');
    } finally {
      setAssigning(null);
    }
  };

  const handleGrade = async (submissionId: string) => {
    try {
      setGrading(submissionId);
      setGradingError(null);

      const response = await fetch(`/api/grading/submission/${submissionId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Grading failed');
      }

      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error(err);
      setGradingError(err instanceof Error ? err.message : 'Grading failed');
    } finally {
      setGrading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={loadData} className="mt-2">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Delete action bar - appears when items selected */}
      {selectedForDelete.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <span className="text-sm font-medium text-red-800 dark:text-red-200">
            {selectedForDelete.size} {selectedForDelete.size === 1 ? 'item' : 'items'} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedForDelete(new Set())}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                  Delete
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Filter - using teacher-friendly labels */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'needs_review', 'completed'] as const).map(
          (status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All Papers' : STATUS_LABELS[status].label}
            </Button>
          )
        )}
      </div>

      {/* List */}
      {submissions.length === 0 ? (
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
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">No student work yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === 'all'
                ? 'Upload student papers to get started'
                : `No papers with status "${STATUS_LABELS[statusFilter].label}"`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {submissions.map((submission) => (
            <div key={submission.id}>
              {/* Submission Card */}
              <div
                className={`relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedId === submission.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                } ${batchGradingStatus?.currentId === submission.id ? 'ring-2 ring-primary' : ''} ${
                  selectedForDelete.has(submission.id) ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : ''
                }`}
                onClick={() => {
                  const newSelected = selectedId === submission.id ? null : submission.id;
                  setSelectedId(newSelected);
                  if (newSelected && submission.has_result) {
                    fetchGradingResult(newSelected);
                  }
                }}
              >
                {/* Checkbox for batch delete */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectForDelete(submission.id);
                  }}
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedForDelete.has(submission.id)
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'border-gray-300 dark:border-gray-600 hover:border-red-400'
                  }`}
                >
                  {selectedForDelete.has(submission.id) && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Thumbnail */}
                <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                  {imageUrls[submission.id] ? (
                    <img
                      src={imageUrls[submission.id]}
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
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Batch Grading Status Overlay */}
                {batchGradingStatus?.currentId === submission.id && (
                  <div className="absolute inset-0 bg-primary/10 rounded-lg flex items-center justify-center z-10">
                    <div className="bg-white dark:bg-gray-900 rounded-full p-2 shadow-lg">
                      <svg
                        className="animate-spin h-6 w-6 text-primary"
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
                    </div>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {submission.student_name ||
                        submission.detected_name ||
                        submission.original_filename ||
                        'Unknown'}
                    </p>
                    {/* Queue indicator */}
                    {batchGradingStatus?.queueIds.includes(submission.id) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        In Queue
                      </span>
                    )}
                    {/* Currently grading indicator */}
                    {batchGradingStatus?.currentId === submission.id && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                        <svg
                          className="animate-spin h-3 w-3"
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
                        Grading
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(submission.created_at).toLocaleString()}
                    {submission.page_number > 1 && ` - Page ${submission.page_number}`}
                  </p>
                </div>

                {/* Status Badge & Score */}
                <div className="flex-shrink-0 flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                      STATUS_LABELS[submission.status].color
                    }`}
                  >
                    {STATUS_LABELS[submission.status].label}
                  </span>
                  {submission.has_result && submission.percentage !== undefined && (
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        submission.percentage >= 90 ? 'text-green-600' :
                        submission.percentage >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {Math.round(submission.percentage)}%
                      </div>
                      {submission.score !== undefined && submission.max_score !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          {submission.score}/{submission.max_score}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Detail panel - appears directly below selected submission */}
              {selectedId === submission.id && (
                <Card className="mt-2 ml-4 border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      {/* Image preview */}
                      {imageUrls[submission.id] && (
                        <div className="aspect-video bg-muted rounded-lg overflow-hidden max-w-2xl">
                          <img
                            src={imageUrls[submission.id]}
                            alt="Submission"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}

                      {/* Question Breakdown - Teacher-first language */}
                      {submission.has_result && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm border-b pb-2">
                            Question by Question
                            {loadingResult === submission.id && (
                              <span className="ml-2 text-muted-foreground font-normal">Loading...</span>
                            )}
                          </h4>

                          {gradingResults[submission.id]?.questionsJson ? (
                            <div className="space-y-3">
                              {gradingResults[submission.id]!.questionsJson.map((q) => (
                                <div
                                  key={q.questionNumber}
                                  className={`p-3 rounded-lg border ${
                                    q.isCorrect
                                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                      : q.studentAnswer === null
                                        ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                                        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 space-y-2">
                                      {/* Problem */}
                                      <div className="font-medium">
                                        Q{q.questionNumber}: {q.problemText || 'Problem not detected'}
                                      </div>

                                      {/* Student's Answer */}
                                      <div className="text-sm">
                                        <span className="text-muted-foreground">Student&apos;s answer: </span>
                                        <span className={`font-semibold ${
                                          q.studentAnswer === null
                                            ? 'text-yellow-700 dark:text-yellow-400'
                                            : q.isCorrect
                                              ? 'text-green-700 dark:text-green-400'
                                              : 'text-red-700 dark:text-red-400'
                                        }`}>
                                          {q.studentAnswer ?? '(blank)'}
                                        </span>
                                        {q.isCorrect && ' \u2713'}
                                      </div>

                                      {/* Correct Answer - only show if wrong */}
                                      {!q.isCorrect && (
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Correct answer: </span>
                                          <span className="font-semibold">
                                            {q.answerKeyValue || q.aiAnswer || q.correctAnswer}
                                          </span>
                                        </div>
                                      )}

                                      {/* Note for teacher - only if flagged */}
                                      {(q.readabilityIssue || q.discrepancy || (q.readabilityConfidence !== undefined && q.readabilityConfidence < 0.7)) && (
                                        <div className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                                          {q.readabilityIssue
                                            ? `Handwriting unclear - ${q.readabilityIssue}`
                                            : q.discrepancy
                                              ? `Note: ${q.discrepancy}`
                                              : 'AI wasn\'t sure about this answer - please verify'}
                                        </div>
                                      )}

                                      {/* Smart Explanation - Expandable */}
                                      {q.explanation && (
                                        <div className="mt-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleExplanation(q.questionNumber);
                                            }}
                                            className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
                                          >
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              className={`h-3 w-3 transition-transform ${expandedExplanations.has(q.questionNumber) ? 'rotate-90' : ''}`}
                                            >
                                              <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                            {expandedExplanations.has(q.questionNumber) ? 'Hide' : 'Show'} Student Explanation
                                          </button>

                                          {expandedExplanations.has(q.questionNumber) && (
                                            <div className="mt-2 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg text-sm space-y-2">
                                              {/* Steps */}
                                              {q.explanation.steps && q.explanation.steps.length > 0 && (
                                                <div>
                                                  <p className="font-medium text-violet-800 dark:text-violet-200 mb-1">How to solve this:</p>
                                                  <ol className="list-decimal list-inside space-y-1 text-violet-700 dark:text-violet-300">
                                                    {q.explanation.steps.map((step, idx) => (
                                                      <li key={idx}>{step}</li>
                                                    ))}
                                                  </ol>
                                                </div>
                                              )}

                                              {/* Visual Diagram */}
                                              {q.explanation.diagram && (
                                                <DiagramRenderer
                                                  diagram={q.explanation.diagram as unknown as Parameters<typeof DiagramRenderer>[0]['diagram']}
                                                  className="my-3"
                                                />
                                              )}

                                              {/* What they did right */}
                                              {q.explanation.whatYouDidRight && (
                                                <div className="flex items-start gap-2">
                                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5">
                                                    <path d="M20 6 9 17l-5-5" />
                                                  </svg>
                                                  <p className="text-green-700 dark:text-green-400">{q.explanation.whatYouDidRight}</p>
                                                </div>
                                              )}

                                              {/* What to improve */}
                                              {q.explanation.whatToImprove && (
                                                <div className="flex items-start gap-2">
                                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                  </svg>
                                                  <p className="text-orange-700 dark:text-orange-400">{q.explanation.whatToImprove}</p>
                                                </div>
                                              )}

                                              {/* Encouragement */}
                                              {q.explanation.encouragement && (
                                                <p className="text-violet-600 dark:text-violet-400 italic border-t border-violet-200 dark:border-violet-700 pt-2 mt-2">
                                                  {q.explanation.encouragement}
                                                </p>
                                              )}

                                              <p className="text-xs text-muted-foreground">
                                                Grade level: {q.explanation.gradeLevel}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* AI Services & Points */}
                                    <div className="flex items-center gap-3">
                                      <AIServicesIndicator question={q} />
                                      <div className="text-right">
                                        <div className={`text-lg font-bold ${
                                          q.isCorrect ? 'text-green-600' : q.studentAnswer === null ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                          {q.pointsAwarded}/{q.pointsPossible}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Review Reason - Teacher-friendly */}
                              {gradingResults[submission.id]!.reviewReason && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5">
                                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                      <line x1="12" y1="9" x2="12" y2="13"/>
                                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                                    </svg>
                                    <div>
                                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Please review this paper</p>
                                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                        {gradingResults[submission.id]!.reviewReason}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Smart Explanations Section */}
                              {gradingResults[submission.id]?.resultId && (
                                <div className="border-t pt-3 mt-3">
                                  {/* Check if any explanations exist */}
                                  {gradingResults[submission.id]!.questionsJson.some(q => q.explanation) ? (
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                          <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                        <span>Smart Explanations available - click &quot;Show Student Explanation&quot; on any question</span>
                                      </div>
                                      {/* Regenerate button */}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs text-muted-foreground hover:text-violet-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleGenerateExplanations(gradingResults[submission.id]!.resultId, submission.id);
                                        }}
                                        disabled={generatingExplanations === gradingResults[submission.id]!.resultId}
                                      >
                                        {generatingExplanations === gradingResults[submission.id]!.resultId ? (
                                          <>
                                            <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Regenerating...
                                          </>
                                        ) : (
                                          <>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 mr-1">
                                              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                              <path d="M3 3v5h5" />
                                              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                              <path d="M16 16h5v5" />
                                            </svg>
                                            Regenerate
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  ) : hasSmartExplanations ? (
                                    <div className="flex items-center gap-3">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-900/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleGenerateExplanations(gradingResults[submission.id]!.resultId, submission.id);
                                        }}
                                        disabled={generatingExplanations === gradingResults[submission.id]!.resultId}
                                      >
                                        {generatingExplanations === gradingResults[submission.id]!.resultId ? (
                                          <>
                                            <svg
                                              className="animate-spin -ml-1 mr-2 h-4 w-4"
                                              xmlns="http://www.w3.org/2000/svg"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                            >
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Generating...
                                          </>
                                        ) : (
                                          <>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 mr-1">
                                              <path d="M12 2v4" />
                                              <path d="m6.343 6.343 2.829 2.829" />
                                              <path d="M2 12h4" />
                                              <path d="m6.343 17.657 2.829-2.829" />
                                              <path d="M12 18v4" />
                                              <path d="m17.657 17.657-2.829-2.829" />
                                              <path d="M18 12h4" />
                                              <path d="m17.657 6.343-2.829 2.829" />
                                            </svg>
                                            Generate Explanations
                                          </>
                                        )}
                                      </Button>
                                      <span className="text-xs text-muted-foreground">
                                        Create age-appropriate feedback for students
                                      </span>
                                    </div>
                                  ) : hasSmartExplanations === false ? (
                                    <div className="flex items-center gap-2 p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-violet-600 flex-shrink-0">
                                        <path d="M12 2v4" />
                                        <path d="m6.343 6.343 2.829 2.829" />
                                        <path d="M2 12h4" />
                                        <path d="m6.343 17.657 2.829-2.829" />
                                        <path d="M12 18v4" />
                                        <path d="m17.657 17.657-2.829-2.829" />
                                        <path d="M18 12h4" />
                                        <path d="m17.657 6.343-2.829 2.829" />
                                      </svg>
                                      <div className="flex-1">
                                        <p className="text-sm text-violet-800 dark:text-violet-200 font-medium">
                                          Want Smart Explanations?
                                        </p>
                                        <p className="text-xs text-violet-600 dark:text-violet-400">
                                          Add the $5/mo add-on to generate grade-appropriate student feedback
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-400"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.location.href = '/settings';
                                        }}
                                      >
                                        Upgrade
                                      </Button>
                                    </div>
                                  ) : null}

                                  {/* Explanation Error */}
                                  {explanationError && (
                                    <div className="mt-2 p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                                      {explanationError}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : loadingResult !== submission.id && (
                            <p className="text-sm text-muted-foreground">
                              Click to see grading details...
                            </p>
                          )}
                        </div>
                      )}

                      {/* Student assignment */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Assign to Student</label>
                        <select
                          className="w-full max-w-xs p-2 border rounded-md"
                          value={submission.student_id || ''}
                          onChange={(e) =>
                            handleAssign(submission.id, e.target.value || null)
                          }
                          disabled={assigning === submission.id}
                        >
                          <option value="">-- Select Student --</option>
                          {students.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name}
                            </option>
                          ))}
                        </select>
                        {submission.detected_name && (
                          <p className="text-xs text-muted-foreground">
                            Detected name: {submission.detected_name}
                            {submission.name_confidence && (
                              <> ({Math.round(submission.name_confidence * 100)}% confident)</>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Grading Error */}
                      {gradingError && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
                          {gradingError}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {(submission.status === 'pending' || submission.status === 'failed') && (
                          <Button
                            size="sm"
                            onClick={() => handleGrade(submission.id)}
                            disabled={grading === submission.id}
                          >
                            {grading === submission.id ? (
                              <>
                                <svg
                                  className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                                Grading...
                              </>
                            ) : (
                              'Grade Now'
                            )}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedForDelete(new Set([submission.id]));
                            setShowDeleteConfirm(true);
                          }}
                          disabled={deleting}
                        >
                          Delete
                        </Button>
                        {imageUrls[submission.id] && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(imageUrls[submission.id], '_blank')}
                          >
                            View Full Size
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(false)}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedForDelete.size === 1 ? 'Submission' : 'Submissions'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedForDelete.size === 1 ? 'this submission' : `${selectedForDelete.size} submissions`}? This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              No
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDeleteConfirm}
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
