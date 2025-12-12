/**
 * Single Submission Grading API
 *
 * Grade a specific submission on-demand
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getGradingService,
  imageUrlToInput,
  createAnswerKeyData,
  saveGradingResult,
  getResultBySubmission,
} from '@/lib/ai';
import type { GradingRequest } from '@/lib/ai';

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get existing result for a submission
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    const result = await getResultBySubmission(id);

    if (!result) {
      return NextResponse.json({ error: 'No result found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Grade a submission now
export async function POST(request: Request, { params }: RouteParams) {
  const { id: submissionId } = await params;

  try {
    const supabase = await createClient();

    // Get submission details
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select('*, project:projects(*)')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const projectId = submission.project_id;

    // Get answer key
    const { data: answerKey, error: akError } = await supabase
      .from('project_answer_keys')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (akError || !answerKey) {
      return NextResponse.json(
        { error: 'No answer key found for this project' },
        { status: 400 }
      );
    }

    // Get signed URL for image
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('submissions')
      .createSignedUrl(submission.storage_path, 3600);

    if (urlError || !signedUrl) {
      return NextResponse.json({ error: 'Failed to get image URL' }, { status: 500 });
    }

    // Convert image
    const imageInput = await imageUrlToInput(signedUrl.signedUrl);

    // Parse answer key
    const answers = (answerKey.answers_json || []) as Array<{
      question_number: number;
      answer: string;
      points?: number;
    }>;

    const answerKeyData = createAnswerKeyData(answers, answerKey.total_questions);

    // Build request
    const gradingRequest: GradingRequest = {
      submissionId,
      image: imageInput,
      answerKey: answerKeyData,
      options: {
        generateFeedback: true,
        extractStudentName: true,
      },
    };

    // Grade
    const gradingService = getGradingService();
    const result = await gradingService.gradeSubmission(gradingRequest, {
      generateFeedback: true,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Grading failed', result },
        { status: 500 }
      );
    }

    // Save result
    const resultId = await saveGradingResult(result, projectId, submission.student_id);

    return NextResponse.json({
      success: true,
      resultId,
      result,
    });
  } catch (error) {
    console.error('Grading error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
