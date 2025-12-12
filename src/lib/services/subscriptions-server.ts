/**
 * Server-side Subscription Service
 *
 * For use in API routes and server components.
 * Handles paper limit checking and usage tracking.
 */

import { createClient } from '@/lib/supabase/server';

export interface UsageCheckResult {
  canGrade: boolean;
  papersRemaining: number;
  needsOverage: boolean;
  currentPlanId: string | null;
}

/**
 * Check if a user can grade papers
 * Call this BEFORE starting the grading process
 */
export async function checkUserCanGrade(
  userId: string,
  paperCount: number = 1
): Promise<UsageCheckResult> {
  const supabase = await createClient();

  // Get user's subscription
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_id, status')
    .eq('user_id', userId)
    .single();

  if (!subscription || subscription.status !== 'active' && subscription.status !== 'trialing') {
    return {
      canGrade: false,
      papersRemaining: 0,
      needsOverage: true,
      currentPlanId: null,
    };
  }

  // Get current usage
  const { data: usage } = await supabase.rpc('get_current_usage', {
    p_user_id: userId,
  });

  if (!usage || usage.length === 0) {
    // No usage period - might be new user, allow grading
    return {
      canGrade: true,
      papersRemaining: 0,
      needsOverage: false,
      currentPlanId: subscription.plan_id,
    };
  }

  const usageData = usage[0];
  const papersRemaining = Math.max(
    0,
    usageData.papers_limit + usageData.overage_papers - usageData.papers_graded
  );

  return {
    canGrade: papersRemaining >= paperCount,
    papersRemaining,
    needsOverage: papersRemaining < paperCount,
    currentPlanId: subscription.plan_id,
  };
}

/**
 * Increment papers graded count
 * Call this AFTER successful grading
 */
export async function incrementPapersGraded(
  userId: string,
  count: number = 1
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('increment_papers_graded', {
    p_user_id: userId,
    p_count: count,
  });

  if (error) {
    console.error('Failed to increment papers graded:', error);
    return false;
  }

  return data ?? false;
}

/**
 * Get user ID from a project ID
 * Useful when processing queue items that only have project ID
 */
export async function getUserIdFromProject(projectId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.user_id;
}

/**
 * Get user ID from a submission ID
 */
export async function getUserIdFromSubmission(submissionId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('submissions')
    .select('project:projects(user_id)')
    .eq('id', submissionId)
    .single();

  if (error || !data?.project) {
    return null;
  }

  // Handle both single object and array response
  const project = Array.isArray(data.project) ? data.project[0] : data.project;
  return project?.user_id || null;
}

/**
 * Check usage and return detailed info for API response
 */
export async function getUsageForResponse(userId: string) {
  const supabase = await createClient();

  const { data: usage } = await supabase.rpc('get_current_usage', {
    p_user_id: userId,
  });

  if (!usage || usage.length === 0) {
    return null;
  }

  const u = usage[0];
  return {
    papersGraded: u.papers_graded,
    papersLimit: u.papers_limit,
    papersRemaining: Math.max(0, u.papers_limit + u.overage_papers - u.papers_graded),
    overagePapers: u.overage_papers,
    periodEnd: u.period_end,
  };
}
