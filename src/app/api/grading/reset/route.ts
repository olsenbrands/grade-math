/**
 * Reset Failed Submissions API
 *
 * Allows resetting failed submissions so they can be retried
 */

import { NextResponse } from 'next/server';
import { resetFailedSubmission, resetAllFailedForProject } from '@/lib/ai';

export const dynamic = 'force-dynamic';

/**
 * POST /api/grading/reset
 *
 * Reset a failed submission or all failed submissions for a project
 *
 * Body:
 * - submissionId: string (optional) - Reset a specific submission
 * - projectId: string (optional) - Reset all failed submissions for a project
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { submissionId, projectId } = body;

    if (!submissionId && !projectId) {
      return NextResponse.json(
        { error: 'Either submissionId or projectId is required' },
        { status: 400 }
      );
    }

    // Reset specific submission
    if (submissionId) {
      const result = await resetFailedSubmission(submissionId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Submission ${submissionId} has been reset and will be retried`,
      });
    }

    // Reset all failed for project
    if (projectId) {
      const result = await resetAllFailedForProject(projectId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Reset ${result.resetCount} failed submission(s) for project ${projectId}`,
        resetCount: result.resetCount,
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
