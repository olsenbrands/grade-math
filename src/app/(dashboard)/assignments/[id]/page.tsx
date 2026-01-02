'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  type ProjectWithStats,
} from '@/lib/services/projects';
import { getAnswerKey, getAnswerKeyUrl } from '@/lib/services/answer-keys';
import { uploadMultipleSubmissions } from '@/lib/services/submissions';
import { CameraCapture, FileUpload, SubmissionList, BatchScan } from '@/components/submissions';
import type { BatchGradingStatus } from '@/components/submissions/SubmissionList';
import { AnswerKeyUpload } from '@/components/answer-keys/AnswerKeyUpload';
import { ManualAnswerEntry } from '@/components/answer-keys/ManualAnswerEntry';
import {
  BatchGradingProgress,
  createInitialBatchState,
  type BatchGradingState,
} from '@/components/ui/BatchGradingProgress';
import type { AnswerKey } from '@/types/database';
import { FreePapersBlockingModal } from '@/components/billing/FreePapersBlockingModal';
import { PapersRemainingInline } from '@/components/billing/PapersRemaining';
import { getCurrentUsage, type UsageInfo } from '@/lib/services/subscriptions';
import { createClient } from '@/lib/supabase/client';
import type { TeachingMethodology } from '@/types/database';

const GRADE_OPTIONS = [
  { value: 'K', label: 'Kindergarten' },
  { value: '1', label: '1st Grade' },
  { value: '2', label: '2nd Grade' },
  { value: '3', label: '3rd Grade' },
  { value: '4', label: '4th Grade' },
  { value: '5', label: '5th Grade' },
  { value: '6', label: '6th Grade' },
  { value: '7', label: '7th Grade' },
  { value: '8', label: '8th Grade' },
  { value: '9', label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' },
  { value: 'college', label: 'College' },
];

const METHODOLOGY_OPTIONS: { value: TeachingMethodology; label: string; shortLabel: string }[] = [
  { value: 'standard', label: 'Standard (Balanced)', shortLabel: 'Standard' },
  { value: 'singapore', label: 'Singapore Math / Bar Model', shortLabel: 'Singapore' },
  { value: 'traditional', label: 'Traditional / Direct Instruction', shortLabel: 'Traditional' },
  { value: 'common-core', label: 'Common Core', shortLabel: 'Common Core' },
  { value: 'montessori', label: 'Montessori', shortLabel: 'Montessori' },
  { value: 'saxon', label: 'Saxon Math', shortLabel: 'Saxon' },
  { value: 'classical', label: 'Classical Education', shortLabel: 'Classical' },
  { value: 'waldorf', label: 'Waldorf / Steiner', shortLabel: 'Waldorf' },
];

export default function AssignmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [answerKey, setAnswerKey] = useState<AnswerKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', date: '' });
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showBatchScan, setShowBatchScan] = useState(false);
  const [showAnswerKeyUpload, setShowAnswerKeyUpload] = useState(false);
  const [showManualAnswerEntry, setShowManualAnswerEntry] = useState(false);
  const [showAnswerKeyPreview, setShowAnswerKeyPreview] = useState(false);
  const [answerKeyImageUrl, setAnswerKeyImageUrl] = useState<string | null>(null);
  const [extractingAnswers, setExtractingAnswers] = useState(false);
  const [submissionKey, setSubmissionKey] = useState(0); // For refreshing SubmissionList

  // Batch grading state
  const [batchGradingState, setBatchGradingState] = useState<BatchGradingState>(createInitialBatchState());
  const [isBatchMinimized, setIsBatchMinimized] = useState(false);
  const batchCancelledRef = useRef(false);

  // Paper usage state
  const [paperUsage, setPaperUsage] = useState<UsageInfo | null>(null);
  const [showNoPapersModal, setShowNoPapersModal] = useState(false);

  // Grade level state for Smart Explanations
  const [gradeLevelSaving, setGradeLevelSaving] = useState(false);
  const [teacherDefaultGradeLevel, setTeacherDefaultGradeLevel] = useState<string | null>(null);

  // Teaching methodology state
  const [methodologySaving, setMethodologySaving] = useState(false);
  const [teacherDefaultMethodology, setTeacherDefaultMethodology] = useState<TeachingMethodology | null>(null);

  // Batch grade a single submission with retry-once logic
  async function gradeSubmission(submissionId: string): Promise<{ success: boolean; needsReview: boolean }> {
    let attempts = 0;
    const maxAttempts = 2; // Initial + 1 retry

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch(`/api/grading/submission/${submissionId}`, {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            needsReview: data.result?.needsReview || false,
          };
        }

        // If not ok and we have retries left, continue to retry
        if (attempts < maxAttempts) {
          console.log(`Grading failed for ${submissionId}, retrying...`);
          continue;
        }

        return { success: false, needsReview: false };
      } catch (error) {
        console.error(`Grading error for ${submissionId}:`, error);
        if (attempts >= maxAttempts) {
          return { success: false, needsReview: false };
        }
      }
    }

    return { success: false, needsReview: false };
  }

  // Start batch grading
  async function handleBatchGrade() {
    if (!project) return;

    // Check paper usage before starting - MUST block if no papers remaining
    try {
      const usage = await getCurrentUsage();
      setPaperUsage(usage);

      if (usage && usage.papers_remaining === 0) {
        // BLOCK grading - show modal explaining what happened
        setShowNoPapersModal(true);
        return; // Do NOT attempt grading
      }
    } catch (err) {
      console.error('Failed to check paper usage:', err);
      // If we can't check usage, allow grading to proceed
      // (backend will enforce limits anyway)
    }

    // Get all pending submissions by querying the current list
    const response = await fetch(`/api/submissions?projectId=${projectId}&status=pending`);
    let pendingSubmissions: { id: string }[] = [];

    if (response.ok) {
      pendingSubmissions = await response.json();
    } else {
      // Fallback: use the project's pending count
      alert('Failed to fetch pending submissions');
      return;
    }

    if (pendingSubmissions.length === 0) {
      alert('No pending submissions to grade');
      return;
    }

    const submissionIds = pendingSubmissions.map((s) => s.id);

    // Initialize batch state
    batchCancelledRef.current = false;
    setBatchGradingState({
      isActive: true,
      queue: submissionIds.slice(1),
      currentId: submissionIds[0] || null,
      completed: [],
      failed: [],
      needsReview: [],
      totalCount: submissionIds.length,
      startTime: Date.now(),
    });
    setIsBatchMinimized(false);

    // Process each submission
    for (let i = 0; i < submissionIds.length; i++) {
      if (batchCancelledRef.current) break;

      const submissionId = submissionIds[i];
      if (!submissionId) continue;

      // Update current state
      setBatchGradingState((prev) => ({
        ...prev,
        currentId: submissionId,
        queue: submissionIds.slice(i + 1),
      }));

      // Grade the submission
      const result = await gradeSubmission(submissionId);

      // Update state based on result
      setBatchGradingState((prev) => ({
        ...prev,
        currentId: null,
        completed: result.success
          ? [...prev.completed, submissionId]
          : prev.completed,
        failed: !result.success
          ? [...prev.failed, submissionId]
          : prev.failed,
        needsReview: result.needsReview
          ? [...prev.needsReview, submissionId]
          : prev.needsReview,
      }));
    }

    // Mark as complete
    setBatchGradingState((prev) => ({
      ...prev,
      isActive: false,
      currentId: null,
      queue: [],
    }));

    // Refresh data
    setSubmissionKey((k) => k + 1);
    loadProject();
  }

  // Cancel batch grading
  function handleCancelBatch() {
    batchCancelledRef.current = true;
    setBatchGradingState((prev) => ({
      ...prev,
      isActive: false,
      currentId: null,
      queue: [],
    }));
  }

  // Close/reset batch grading popup
  function handleCloseBatch() {
    setBatchGradingState(createInitialBatchState());
    setIsBatchMinimized(false);
  }

  // Extract answers from image answer key
  async function handleExtractAnswers() {
    if (!answerKey || answerKey.type !== 'image') return;

    try {
      setExtractingAnswers(true);
      const response = await fetch('/api/answer-keys/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (response.ok) {
        await loadProject(); // Reload to show extracted answers
      } else {
        const data = await response.json();
        alert(`Extraction failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to extract answers');
    } finally {
      setExtractingAnswers(false);
    }
  }

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProject(projectId);
      if (!data) {
        setError('Assignment not found');
        return;
      }
      setProject(data);
      setEditForm({
        name: data.name,
        description: data.description || '',
        date: data.date,
      });

      // Load answer key
      const key = await getAnswerKey(projectId);
      setAnswerKey(key);

      // Load answer key image URL if it has a storage path
      if (key?.storage_path) {
        try {
          const url = await getAnswerKeyUrl(key.storage_path);
          setAnswerKeyImageUrl(url);
        } catch (err) {
          console.error('Failed to get answer key URL:', err);
          setAnswerKeyImageUrl(null);
        }
      } else {
        setAnswerKeyImageUrl(null);
      }
    } catch (err) {
      setError('Failed to load assignment');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Load paper usage on mount and after grading completes
  useEffect(() => {
    async function loadUsage() {
      try {
        const usage = await getCurrentUsage();
        setPaperUsage(usage);
      } catch (err) {
        console.error('Failed to load paper usage:', err);
      }
    }
    loadUsage();
  }, [submissionKey]); // Refresh when submissions change

  async function handleSave() {
    if (!editForm.name.trim()) {
      return;
    }

    try {
      setSaving(true);
      await updateProject(projectId, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        date: editForm.date,
      });
      await loadProject();
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!project) return;

    try {
      setSaving(true);
      if (project.is_archived) {
        await restoreProject(projectId);
      } else {
        await archiveProject(projectId);
      }
      await loadProject();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      setSaving(true);
      await deleteProject(projectId);
      router.push('/assignments');
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  // Load teacher's default grade level and methodology
  useEffect(() => {
    async function loadTeacherDefaults() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('profiles')
          .select('grade_level, teaching_methodology')
          .eq('id', user.id)
          .single();

        setTeacherDefaultGradeLevel(data?.grade_level || '6');
        setTeacherDefaultMethodology((data?.teaching_methodology as TeachingMethodology) || 'standard');
      } catch (err) {
        console.error('Failed to load teacher defaults:', err);
      }
    }
    loadTeacherDefaults();
  }, []);

  // Handle assignment grade level change
  async function handleAssignmentGradeLevelChange(newGradeLevel: string) {
    if (!project) return;

    setGradeLevelSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('projects')
        .update({
          grade_level: newGradeLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) throw error;

      setProject((prev) => prev ? { ...prev, grade_level: newGradeLevel } : null);
    } catch (err) {
      console.error('Failed to save grade level:', err);
      alert('Failed to save grade level');
    } finally {
      setGradeLevelSaving(false);
    }
  }

  // Handle assignment teaching methodology change
  async function handleAssignmentMethodologyChange(newMethodology: string) {
    if (!project) return;

    setMethodologySaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('projects')
        .update({
          teaching_methodology: newMethodology,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) throw error;

      setProject((prev) => prev ? { ...prev, teaching_methodology: newMethodology as TeachingMethodology } : null);
    } catch (err) {
      console.error('Failed to save teaching methodology:', err);
      alert('Failed to save teaching methodology');
    } finally {
      setMethodologySaving(false);
    }
  }

  // Corny math jokes for loading screen
  const mathJokes = [
    "Why was the equal sign so humble? Because it knew it wasn't less than or greater than anyone else.",
    "Why do plants hate math? Because it gives them square roots.",
    "Why was the math book sad? It had too many problems.",
    "What do you call friends who love math? Algebros.",
    "Why did the student wear glasses in math class? To improve di-vision.",
    "Parallel lines have so much in common... it's a shame they'll never meet.",
    "Why is 6 afraid of 7? Because 7, 8, 9!",
    "What's a math teacher's favorite season? Sum-mer!",
    "Why did the two 4's skip lunch? They already 8!",
    "What do you call a number that can't sit still? A roamin' numeral.",
  ];

  // Pick a random joke on each load
  const [loadingJoke] = useState(() => mathJokes[Math.floor(Math.random() * mathJokes.length)]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        {/* Spinner */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-muted rounded-full animate-spin border-t-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">+</span>
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">Loading assignment...</p>

          {/* Math joke */}
          <div className="max-w-md mx-auto px-4">
            <p className="text-sm text-muted-foreground/70 italic">
              &ldquo;{loadingJoke}&rdquo;
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <Link
          href="/assignments"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="mr-2 h-4 w-4"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Back to Assignments
        </Link>
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error || 'Assignment not found'}</p>
            <Link href="/assignments">
              <Button variant="outline" className="mt-4">
                View All Assignments
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ZONE 1: Assignment Status Header */}
      <div>
        <Link
          href="/assignments"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="mr-2 h-4 w-4"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Back to Assignments
        </Link>

        {editing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Assignment Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                {project.is_archived && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs">
                    Archived
                  </span>
                )}
              </div>
              {/* Status summary line */}
              <div className="flex items-center gap-2 mt-1">
                {(project.graded_count || 0) > 0 && (project.pending_count || 0) === 0 && (project.needs_review_count || 0) === 0 ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Assignment complete
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {project.graded_count || 0} graded
                    {(project.needs_review_count || 0) > 0 && (
                      <span className="text-yellow-600 font-medium"> &bull; {project.needs_review_count} need review</span>
                    )}
                    {(project.pending_count || 0) > 0 && (
                      <span> &bull; {project.pending_count} pending</span>
                    )}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {project.description ? `${project.description} · ` : ''}{new Date(project.date).toLocaleDateString()}
              </p>
              {/* Grade Level & Methodology Selectors for Smart Explanations */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="grade-level-select" className="text-sm text-violet-600 dark:text-violet-400">
                    Grade:
                  </label>
                  <select
                    id="grade-level-select"
                    className="text-sm border border-violet-300 dark:border-violet-700 rounded-md px-2 py-1 bg-background text-violet-700 dark:text-violet-400 focus:ring-violet-500 focus:border-violet-500"
                    value={project.grade_level || ''}
                    onChange={(e) => handleAssignmentGradeLevelChange(e.target.value)}
                    disabled={gradeLevelSaving}
                  >
                    <option value="">
                      Default ({GRADE_OPTIONS.find(o => o.value === (teacherDefaultGradeLevel || '6'))?.label || '6th Grade'})
                    </option>
                    {GRADE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {gradeLevelSaving && (
                    <span className="text-xs text-violet-500">Saving...</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="methodology-select" className="text-sm text-violet-600 dark:text-violet-400">
                    Method:
                  </label>
                  <select
                    id="methodology-select"
                    className="text-sm border border-violet-300 dark:border-violet-700 rounded-md px-2 py-1 bg-background text-violet-700 dark:text-violet-400 focus:ring-violet-500 focus:border-violet-500"
                    value={(project as { teaching_methodology?: string }).teaching_methodology || ''}
                    onChange={(e) => handleAssignmentMethodologyChange(e.target.value)}
                    disabled={methodologySaving}
                  >
                    <option value="">
                      Default ({METHODOLOGY_OPTIONS.find(o => o.value === (teacherDefaultMethodology || 'standard'))?.shortLabel || 'Standard'})
                    </option>
                    {METHODOLOGY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.shortLabel}
                      </option>
                    ))}
                  </select>
                  {methodologySaving && (
                    <span className="text-xs text-violet-500">Saving...</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </svg>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Complete Banner */}
      {(project.graded_count || 0) > 0 && (project.pending_count || 0) === 0 && (project.needs_review_count || 0) === 0 && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-green-600">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-200">Assignment Complete</h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {project.graded_count} papers graded
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-green-300 hover:bg-green-100 dark:border-green-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  Export Grades
                </Button>
                <Button variant="outline" size="sm" className="border-green-300 hover:bg-green-100 dark:border-green-700">
                  View Summary
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Answer Key Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
              1
            </div>
            <div>
              <CardTitle className="text-xl">Answer Key</CardTitle>
              <CardDescription>
                Upload or enter the correct answers for accurate grading
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {answerKey ? (
            <div className="flex items-center justify-between">
              <div
                className={`flex items-center gap-3 flex-1 ${answerKeyImageUrl ? 'cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors' : ''}`}
                onClick={() => {
                  if (answerKeyImageUrl) {
                    setShowAnswerKeyPreview(true);
                  }
                }}
              >
                {answerKeyImageUrl ? (
                  <div className="h-16 w-16 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                    <img
                      src={answerKeyImageUrl}
                      alt="Answer Key"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      className="h-5 w-5 text-green-600 dark:text-green-400"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-medium">Answer key uploaded</p>
                  <p className="text-sm text-muted-foreground">
                    Type: {answerKey.type} · Added{' '}
                    {new Date(answerKey.created_at).toLocaleDateString()}
                    {answerKeyImageUrl && <span className="text-primary"> · Click to preview</span>}
                  </p>
                  {/* Show extracted answers count or warning */}
                  {answerKey.type === 'image' && (
                    <p className={`text-xs mt-1 ${
                      answerKey.answers && Array.isArray(answerKey.answers) && answerKey.answers.length > 0
                        ? 'text-green-600'
                        : 'text-yellow-600'
                    }`}>
                      {answerKey.answers && Array.isArray(answerKey.answers) && answerKey.answers.length > 0
                        ? `${answerKey.answers.length} answers extracted`
                        : 'No answers extracted yet'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {/* Extract Answers button - only show for image type without answers */}
                {answerKey.type === 'image' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExtractAnswers}
                    disabled={extractingAnswers}
                  >
                    {extractingAnswers ? 'Extracting...' : 'Extract Answers'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnswerKeyUpload(true)}
                >
                  Replace
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
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
                  <path d="m15 5 4 4" />
                  <path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13" />
                  <path d="m8 6 2-2" />
                  <path d="m2 22 5.5-1.5L21.17 6.83a2.82 2.82 0 0 0-4-4L3.5 16.5Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-4">No answer key yet</h3>
              <div className="flex justify-center gap-2">
                <Button onClick={() => setShowAnswerKeyUpload(true)}>Upload Image/PDF</Button>
                <Button variant="outline" onClick={() => setShowManualAnswerEntry(true)}>Enter Manually</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZONE 2 & 3: Student Work Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
              2
            </div>
            <div>
              <CardTitle className="text-xl">Student Work</CardTitle>
              <CardDescription>
                {(project.submission_count || 0) === 0
                  ? 'Upload student papers to start grading'
                  : `${project.submission_count} papers uploaded`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Papers remaining indicator - shows when papers are low */}
            {paperUsage && (
              <PapersRemainingInline
                papersRemaining={paperUsage.papers_remaining}
                isFreeTrial={paperUsage.papers_limit <= 10}
              />
            )}
            {/* Grade All Button - shows when there are ungraded submissions */}
            {(project.pending_count || 0) > 0 && (
              <Button
                onClick={handleBatchGrade}
                disabled={batchGradingState.isActive}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold"
              >
                {batchGradingState.isActive ? (
                  <>
                    <svg
                      className="animate-spin mr-2 h-4 w-4"
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
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      className="mr-2 h-4 w-4"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Grade All ({project.pending_count})
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowCamera(true)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="mr-2 h-4 w-4"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              Camera
            </Button>
            <Button variant="outline" onClick={() => setShowBatchScan(true)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="mr-2 h-4 w-4"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 7h.01" />
                <path d="M17 7h.01" />
                <path d="M7 17h.01" />
                <path d="M17 17h.01" />
              </svg>
              Batch Scan
            </Button>
            <Button onClick={() => setShowUpload(true)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="mr-2 h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              Upload Files
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SubmissionList
            key={submissionKey}
            projectId={projectId}
            onRefresh={() => {
              setSubmissionKey((k) => k + 1);
              loadProject();
            }}
            batchGradingStatus={
              batchGradingState.isActive
                ? {
                    currentId: batchGradingState.currentId,
                    queueIds: batchGradingState.queue,
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <FileUpload
              projectId={projectId}
              onUpload={async (files) => {
                await uploadMultipleSubmissions(projectId, files);
                setSubmissionKey((k) => k + 1);
                loadProject();
              }}
              onClose={() => setShowUpload(false)}
            />
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={async (files) => {
            await uploadMultipleSubmissions(projectId, files);
            setSubmissionKey((k) => k + 1);
            loadProject();
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Batch Scan Modal */}
      {showBatchScan && (
        <BatchScan
          onCapture={async (files) => {
            await uploadMultipleSubmissions(projectId, files);
            // Don't refresh list or reload project while batch scanning
            // This prevents unmounting BatchScan and losing thumbnail state
          }}
          onClose={() => {
            setShowBatchScan(false);
            // Refresh list and reload project only when batch scan closes
            setSubmissionKey((k) => k + 1);
            loadProject();
          }}
        />
      )}

      {/* Answer Key Upload Modal */}
      {showAnswerKeyUpload && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <AnswerKeyUpload
              projectId={projectId}
              onUpload={() => {
                setShowAnswerKeyUpload(false);
                loadProject();
              }}
              onCancel={() => setShowAnswerKeyUpload(false)}
            />
          </div>
        </div>
      )}

      {/* Manual Answer Entry Modal */}
      {showManualAnswerEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <ManualAnswerEntry
              projectId={projectId}
              onSave={() => {
                setShowManualAnswerEntry(false);
                loadProject();
              }}
              onCancel={() => setShowManualAnswerEntry(false)}
            />
          </div>
        </div>
      )}

      {/* Answer Key Preview Modal */}
      {showAnswerKeyPreview && answerKeyImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowAnswerKeyPreview(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-12 right-0 text-white hover:bg-white/20"
              onClick={() => setShowAnswerKeyPreview(false)}
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
              <span className="ml-2">Close</span>
            </Button>
            <img
              src={answerKeyImageUrl}
              alt="Answer Key"
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Batch Grading Progress Popup */}
      {(batchGradingState.isActive || batchGradingState.completed.length > 0 || batchGradingState.failed.length > 0) && (
        <BatchGradingProgress
          state={batchGradingState}
          onCancel={batchGradingState.isActive ? handleCancelBatch : handleCloseBatch}
          onMinimize={() => setIsBatchMinimized(true)}
          isMinimized={isBatchMinimized}
          onMaximize={() => setIsBatchMinimized(false)}
        />
      )}

      {/* No Papers Remaining Modal - Blocks grading when papers = 0 */}
      <FreePapersBlockingModal
        open={showNoPapersModal}
        onOpenChange={setShowNoPapersModal}
        isFreeTrial={(paperUsage?.papers_limit ?? 10) <= 10}
      />

      {/* Settings Section - Collapsed by default */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground py-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform group-open:rotate-90">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Assignment Settings
        </summary>
        <Card className="mt-2">
          <CardContent className="pt-6 space-y-4">
            {/* Smart Explanations Grade Level */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-violet-500">
                    <path d="M12 2v4" />
                    <path d="m6.343 6.343 2.829 2.829" />
                    <path d="M2 12h4" />
                    <path d="m6.343 17.657 2.829-2.829" />
                    <path d="M12 18v4" />
                    <path d="m17.657 17.657-2.829-2.829" />
                    <path d="M18 12h4" />
                    <path d="m17.657 6.343-2.829 2.829" />
                  </svg>
                  Smart Explanations Grade Level
                </p>
                <p className="text-sm text-muted-foreground">
                  Set the grade level for AI-generated student explanations
                  {project.grade_level === null && teacherDefaultGradeLevel && (
                    <span className="text-violet-600"> (using your default: {GRADE_OPTIONS.find(o => o.value === teacherDefaultGradeLevel)?.label || teacherDefaultGradeLevel})</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={project.grade_level || teacherDefaultGradeLevel || '6'}
                  onChange={(e) => handleAssignmentGradeLevelChange(e.target.value)}
                  disabled={gradeLevelSaving}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {GRADE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {gradeLevelSaving && (
                  <svg className="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Archive Assignment</p>
                  <p className="text-sm text-muted-foreground">
                    Hide this assignment from your main list
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchiveToggle}
                  disabled={saving}
                >
                  {project.is_archived ? 'Restore' : 'Archive'}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              {showDeleteConfirm ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete this assignment? This action cannot be undone.
                    All student work and grades will be permanently deleted.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={saving}
                    >
                      {saving ? 'Deleting...' : 'Yes, Delete Assignment'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-destructive">Delete Assignment</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently remove this assignment and all grades
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </details>
    </div>
  );
}
