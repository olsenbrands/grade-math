/**
 * Student Grouping API
 *
 * Handles student-submission assignment operations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  autoGroupSubmission,
  batchAutoGroup,
  manualAssignStudent,
  createAndAssignStudent,
  matchNameToRoster,
  saveTeacherCorrection,
} from '@/lib/services/student-grouping';

/**
 * POST - Perform grouping operations
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'auto-group': {
        // Auto-group a single submission
        const { submissionId, detectedName, nameConfidence } = body;

        if (!submissionId) {
          return NextResponse.json(
            { error: 'submissionId required' },
            { status: 400 }
          );
        }

        const result = await autoGroupSubmission(
          submissionId,
          detectedName || null,
          nameConfidence || 0
        );

        return NextResponse.json(result);
      }

      case 'batch-auto-group': {
        // Auto-group all unassigned submissions in a project
        const { projectId } = body;

        if (!projectId) {
          return NextResponse.json(
            { error: 'projectId required' },
            { status: 400 }
          );
        }

        // Verify project belongs to user
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .single();

        if (!project) {
          return NextResponse.json(
            { error: 'Project not found' },
            { status: 404 }
          );
        }

        const result = await batchAutoGroup(projectId);
        return NextResponse.json(result);
      }

      case 'manual-assign': {
        // Manually assign a student to a submission
        const { submissionId, studentId } = body;

        if (!submissionId || !studentId) {
          return NextResponse.json(
            { error: 'submissionId and studentId required' },
            { status: 400 }
          );
        }

        const success = await manualAssignStudent(submissionId, studentId);

        if (!success) {
          return NextResponse.json(
            { error: 'Failed to assign student' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      case 'create-and-assign': {
        // Create a new student and assign to submission
        const { submissionId, studentName } = body;

        if (!submissionId || !studentName) {
          return NextResponse.json(
            { error: 'submissionId and studentName required' },
            { status: 400 }
          );
        }

        const result = await createAndAssignStudent(submissionId, studentName);

        if (!result.success) {
          return NextResponse.json(
            { error: 'Failed to create and assign student' },
            { status: 500 }
          );
        }

        return NextResponse.json(result);
      }

      case 'save-correction': {
        // Save a teacher's correction for future matching
        const { detectedName, correctStudentId } = body;

        if (!detectedName || !correctStudentId) {
          return NextResponse.json(
            { error: 'detectedName and correctStudentId required' },
            { status: 400 }
          );
        }

        await saveTeacherCorrection(detectedName, correctStudentId);
        return NextResponse.json({ success: true });
      }

      case 'match-preview': {
        // Preview matches without making changes
        const { detectedName } = body;

        if (!detectedName) {
          return NextResponse.json(
            { error: 'detectedName required' },
            { status: 400 }
          );
        }

        // Get user's roster
        const { data: roster } = await supabase
          .from('student_roster')
          .select('*')
          .eq('user_id', user.id);

        if (!roster || roster.length === 0) {
          return NextResponse.json({ matches: [] });
        }

        const matches = matchNameToRoster(detectedName, roster);
        return NextResponse.json({ matches });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Grouping API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get grouping status for a project
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId required' },
        { status: 400 }
      );
    }

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get submission stats
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, student_id, detected_name, name_confidence')
      .eq('project_id', projectId);

    if (!submissions) {
      return NextResponse.json({
        total: 0,
        assigned: 0,
        unassigned: 0,
        withDetectedName: 0,
        withoutDetectedName: 0,
      });
    }

    const stats = {
      total: submissions.length,
      assigned: submissions.filter((s) => s.student_id).length,
      unassigned: submissions.filter((s) => !s.student_id).length,
      withDetectedName: submissions.filter((s) => s.detected_name).length,
      withoutDetectedName: submissions.filter((s) => !s.detected_name).length,
      avgConfidence: submissions
        .filter((s) => s.name_confidence !== null)
        .reduce((sum, s) => sum + (s.name_confidence || 0), 0) /
        Math.max(
          1,
          submissions.filter((s) => s.name_confidence !== null).length
        ),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Grouping API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
