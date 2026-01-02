/**
 * Background Processing API Route
 *
 * Processes submissions from the queue
 * Called by Vercel Cron or manually triggered
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getEnhancedGradingService,
  imageUrlToInput,
  createAnswerKeyData,
  getNextPendingItem,
  markCompleted,
  markFailed,
  releaseStaleItems,
  saveGradingResult,
} from '@/lib/ai';
import type { GradingRequest } from '@/lib/ai';
import {
  checkUserCanGrade,
  incrementPapersGraded,
  getUserIdFromProject,
} from '@/lib/services/subscriptions-server';

// Generate unique worker ID
function getWorkerId(): string {
  return `worker-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export const maxDuration = 60; // Max 60 seconds for Vercel
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const workerId = getWorkerId();
  const results: Array<{ submissionId: string; success: boolean; error?: string }> = [];

  try {
    // First, release any stale items
    const released = await releaseStaleItems();
    if (released > 0) {
      console.log(`Released ${released} stale queue items`);
    }

    // Get max items to process from query params
    const url = new URL(request.url);
    const maxItems = parseInt(url.searchParams.get('max') || '5', 10);

    const gradingService = getEnhancedGradingService();
    const supabase = await createClient();

    // Process items until we hit the limit or run out
    for (let i = 0; i < maxItems; i++) {
      const item = await getNextPendingItem(workerId);
      if (!item) break; // No more items

      console.log(`Processing submission ${item.submissionId} (attempt ${item.attempts})`);

      try {
        // Get submission details
        const { data: submission, error: subError } = await supabase
          .from('submissions')
          .select('*, project:projects(*)')
          .eq('id', item.submissionId)
          .single();

        if (subError || !submission) {
          await markFailed(item.id, 'Submission not found');
          results.push({ submissionId: item.submissionId, success: false, error: 'Submission not found' });
          continue;
        }

        // Check if user has papers remaining
        const userId = await getUserIdFromProject(item.projectId);
        if (userId) {
          const usageCheck = await checkUserCanGrade(userId, 1);
          if (!usageCheck.canGrade) {
            // User is out of papers - don't fail, just skip for now
            // They can purchase more and the item will be processed later
            console.log(`User ${userId} out of papers, skipping submission ${item.submissionId}`);
            results.push({
              submissionId: item.submissionId,
              success: false,
              error: 'Paper limit reached - purchase more to continue',
            });
            continue;
          }
        }

        // Get answer key for the project (optional - AI can grade without it)
        const { data: answerKey } = await supabase
          .from('project_answer_keys')
          .select('*')
          .eq('project_id', item.projectId)
          .single();

        // Log if no answer key - but don't fail, AI can grade independently
        if (!answerKey) {
          console.log(`No answer key for project ${item.projectId} - AI will grade independently`);
        }

        // Get signed URL for the submission image
        const { data: signedUrl, error: urlError } = await supabase.storage
          .from('submissions')
          .createSignedUrl(submission.storage_path, 3600);

        if (urlError || !signedUrl) {
          await markFailed(item.id, 'Failed to get image URL');
          results.push({ submissionId: item.submissionId, success: false, error: 'Image URL failed' });
          continue;
        }

        // Convert image to input format
        const imageInput = await imageUrlToInput(signedUrl.signedUrl);

        // Parse answer key if available
        let answerKeyData = undefined;
        if (answerKey) {
          const answers = (answerKey.answers_json || []) as Array<{
            question_number: number;
            answer: string;
            points?: number;
          }>;
          answerKeyData = createAnswerKeyData(answers, answerKey.total_questions);
        }

        // Create grading request - answer key is optional
        const gradingRequest: GradingRequest = {
          submissionId: item.submissionId,
          image: imageInput,
          answerKey: answerKeyData, // May be undefined - AI grades independently
          options: {
            generateFeedback: true,
            extractStudentName: true,
          },
        };

        // Grade the submission using Enhanced service (Mathpix + GPT-4o + Wolfram)
        const result = await gradingService.gradeSubmissionEnhanced(gradingRequest, {
          requireMathpix: true,
          enableVerification: true,
          generateFeedback: true,
          trackCosts: true,
        });

        if (!result.success) {
          await markFailed(item.id, result.error || 'Grading failed');
          results.push({ submissionId: item.submissionId, success: false, error: result.error });
          continue;
        }

        // Save the result
        const resultId = await saveGradingResult(result, item.projectId, submission.student_id);

        if (!resultId) {
          await markFailed(item.id, 'Failed to save result');
          results.push({ submissionId: item.submissionId, success: false, error: 'Save failed' });
          continue;
        }

        // Mark as completed
        await markCompleted(item.id, resultId);

        // Increment papers graded count for the user
        if (userId) {
          await incrementPapersGraded(userId, 1);
        }

        results.push({ submissionId: item.submissionId, success: true });

        console.log(`Successfully graded submission ${item.submissionId}: ${result.percentage}%`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await markFailed(item.id, errorMessage);
        results.push({ submissionId: item.submissionId, success: false, error: errorMessage });
        console.error(`Error processing ${item.submissionId}:`, error);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      succeeded: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for queue status
export async function GET() {
  try {
    const { getQueueStats } = await import('@/lib/ai');
    const stats = await getQueueStats();

    const gradingService = getEnhancedGradingService();
    const health = await gradingService.healthCheck();

    return NextResponse.json({
      queue: stats,
      providers: health.providers,
      mathpix: health.mathpix,
      wolfram: health.wolfram,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
