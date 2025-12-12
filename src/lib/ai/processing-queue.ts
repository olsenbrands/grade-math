/**
 * Processing Queue
 *
 * Manages the background processing of submissions for AI grading
 */

import { createClient } from '@/lib/supabase/server';
import type { ProcessingQueueItem, AIProviderName } from './types';

const MAX_ATTEMPTS = 3;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface QueuedSubmission {
  id: string;
  submissionId: string;
  projectId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lockedAt?: string;
  lockedBy?: string;
  errorMessage?: string;
  resultId?: string;
}

/**
 * Add a submission to the processing queue
 */
export async function enqueueSubmission(
  submissionId: string,
  projectId: string,
  priority: number = 0
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('processing_queue')
    .insert({
      submission_id: submissionId,
      project_id: projectId,
      priority,
      status: 'pending',
      attempts: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to enqueue submission:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Batch enqueue multiple submissions
 */
export async function enqueueSubmissions(
  submissions: Array<{ submissionId: string; projectId: string; priority?: number }>
): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('processing_queue').insert(
    submissions.map((s) => ({
      submission_id: s.submissionId,
      project_id: s.projectId,
      priority: s.priority || 0,
      status: 'pending',
      attempts: 0,
    }))
  );

  if (error) {
    console.error('Failed to batch enqueue:', error);
    return 0;
  }

  return submissions.length;
}

/**
 * Get next pending item and lock it for processing
 */
export async function getNextPendingItem(
  workerId: string
): Promise<QueuedSubmission | null> {
  const supabase = await createClient();

  // Get the oldest pending item with priority ordering
  const { data: pending, error: fetchError } = await supabase
    .from('processing_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !pending) {
    return null;
  }

  // Try to lock it
  const { data: locked, error: lockError } = await supabase
    .from('processing_queue')
    .update({
      status: 'processing',
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      attempts: pending.attempts + 1,
    })
    .eq('id', pending.id)
    .eq('status', 'pending') // Ensure still pending (optimistic lock)
    .select()
    .single();

  if (lockError || !locked) {
    // Someone else grabbed it, try again
    return getNextPendingItem(workerId);
  }

  return {
    id: locked.id,
    submissionId: locked.submission_id,
    projectId: locked.project_id,
    priority: locked.priority,
    status: locked.status,
    attempts: locked.attempts,
    lockedAt: locked.locked_at,
    lockedBy: locked.locked_by,
    errorMessage: locked.error_message,
  };
}

/**
 * Mark item as completed
 */
export async function markCompleted(
  queueId: string,
  resultId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('processing_queue')
    .update({
      status: 'completed',
      result_id: resultId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', queueId);

  return !error;
}

/**
 * Mark item as failed
 */
export async function markFailed(
  queueId: string,
  errorMessage: string
): Promise<boolean> {
  const supabase = await createClient();

  // Get current attempts
  const { data: item } = await supabase
    .from('processing_queue')
    .select('attempts')
    .eq('id', queueId)
    .single();

  const attempts = item?.attempts || 0;
  const shouldRetry = attempts < MAX_ATTEMPTS;

  const { error } = await supabase
    .from('processing_queue')
    .update({
      status: shouldRetry ? 'pending' : 'failed',
      error_message: errorMessage,
      locked_at: null,
      locked_by: null,
    })
    .eq('id', queueId);

  return !error;
}

/**
 * Release stale locks (for items that were processing but worker died)
 */
export async function releaseStaleItems(): Promise<number> {
  const supabase = await createClient();

  const staleThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS).toISOString();

  const { data, error } = await supabase
    .from('processing_queue')
    .update({
      status: 'pending',
      locked_at: null,
      locked_by: null,
    })
    .eq('status', 'processing')
    .lt('locked_at', staleThreshold)
    .select('id');

  if (error) {
    console.error('Failed to release stale items:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('processing_queue')
    .select('status');

  if (error || !data) {
    return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
  }

  const counts = data.reduce(
    (acc, item) => {
      acc[item.status as keyof typeof acc]++;
      acc.total++;
      return acc;
    },
    { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 }
  );

  return counts;
}

/**
 * Get items for a specific project
 */
export async function getProjectQueueItems(
  projectId: string
): Promise<QueuedSubmission[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('processing_queue')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    submissionId: item.submission_id,
    projectId: item.project_id,
    priority: item.priority,
    status: item.status,
    attempts: item.attempts,
    lockedAt: item.locked_at,
    lockedBy: item.locked_by,
    errorMessage: item.error_message,
    resultId: item.result_id,
  }));
}

/**
 * Delete completed items older than specified days
 */
export async function cleanupOldItems(daysOld: number = 30): Promise<number> {
  const supabase = await createClient();

  const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('processing_queue')
    .delete()
    .eq('status', 'completed')
    .lt('completed_at', threshold)
    .select('id');

  if (error) {
    console.error('Failed to cleanup old items:', error);
    return 0;
  }

  return data?.length || 0;
}
