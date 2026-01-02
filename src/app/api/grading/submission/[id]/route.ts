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

// Minimum confidence to auto-create a student from detected name
const AUTO_CREATE_STUDENT_CONFIDENCE = 0.6;

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

    // Get answer key (optional - AI can grade without it)
    const { data: answerKey } = await supabase
      .from('project_answer_keys')
      .select('*')
      .eq('project_id', projectId)
      .single();

    // Log if no answer key - but don't fail, AI can grade independently
    if (!answerKey) {
      console.log(`No answer key for project ${projectId} - AI will grade independently`);
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

    // Parse answer key - handle both image-based and manual entry formats
    // For image uploads, the AI extracts answers and stores them
    // For manual entry, answers are stored directly
    let answers: Array<{ question_number: number; answer: string; points?: number }> = [];
    let answerKeyData = undefined;

    if (answerKey && answerKey.answers) {
      // Check if it's an array of answer objects
      const rawAnswers = answerKey.answers as unknown;
      if (Array.isArray(rawAnswers)) {
        answers = rawAnswers.map((a: { question?: number; question_number?: number; answer: string; points?: number }, idx: number) => ({
          question_number: a.question_number ?? a.question ?? idx + 1,
          answer: String(a.answer),
          points: a.points ?? 1,
        }));
      }
      const totalQuestions = answers.length || 5; // Default to 5 if no answers
      answerKeyData = createAnswerKeyData(answers, totalQuestions);
      console.log('Answer key data:', JSON.stringify(answerKeyData, null, 2));
    } else {
      console.log('No answer key - AI will grade independently');
    }

    // Build request - answer key is optional
    const gradingRequest: GradingRequest = {
      submissionId,
      image: imageInput,
      answerKey: answerKeyData, // May be undefined - AI grades independently
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

    // Auto-create student from detected name if confidence is high enough
    let studentId = submission.student_id;
    let autoCreatedStudent = null;

    if (!studentId && result.detectedStudentName &&
        result.nameConfidence && result.nameConfidence >= AUTO_CREATE_STUDENT_CONFIDENCE) {

      const detectedName = result.detectedStudentName.trim();

      if (detectedName.length > 0) {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Check if student already exists (case-insensitive)
          const { data: existingStudent } = await supabase
            .from('student_roster')
            .select('*')
            .eq('user_id', user.id)
            .ilike('name', detectedName)
            .single();

          if (existingStudent) {
            // Use existing student
            studentId = existingStudent.id;
            autoCreatedStudent = existingStudent;
          } else {
            // Create new student
            const { data: newStudent, error: createError } = await supabase
              .from('student_roster')
              .insert({
                user_id: user.id,
                name: detectedName,
                notes: 'Auto-created from AI name detection',
              })
              .select()
              .single();

            if (!createError && newStudent) {
              studentId = newStudent.id;
              autoCreatedStudent = newStudent;
              console.log(`Auto-created student: ${detectedName}`);
            }
          }

          // Update submission with student_id
          if (studentId) {
            await supabase
              .from('submissions')
              .update({ student_id: studentId })
              .eq('id', submissionId);
          }
        }
      }
    }

    // Save result
    const resultId = await saveGradingResult(result, projectId, studentId || undefined);

    return NextResponse.json({
      success: true,
      resultId,
      result,
      autoCreatedStudent: autoCreatedStudent ? {
        id: autoCreatedStudent.id,
        name: autoCreatedStudent.name,
      } : null,
    });
  } catch (error) {
    console.error('Grading error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
