/**
 * Generate Smart Explanations API
 *
 * POST /api/explanations/generate
 *
 * Generates age-appropriate math explanations for graded results.
 * Requires Smart Explanations add-on subscription.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getExplanationService,
  hasSmartExplanations,
  getUserGradeLevel,
  type QuestionForExplanation,
} from '@/lib/ai/explanation-service';
import { type GradeLevel, type TeachingMethodology } from '@/lib/ai/rag';

export const maxDuration = 60;

interface RequestBody {
  resultId: string;
  gradeLevel?: GradeLevel;
  methodology?: TeachingMethodology;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has Smart Explanations add-on
    const hasAddon = await hasSmartExplanations(user.id);
    if (!hasAddon) {
      return NextResponse.json(
        {
          error: 'Smart Explanations add-on required',
          code: 'ADDON_REQUIRED',
          message:
            'Upgrade to Smart Explanations to get personalized, grade-appropriate feedback for your students.',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body: RequestBody = await request.json();
    const { resultId } = body;

    if (!resultId) {
      return NextResponse.json(
        { error: 'resultId is required' },
        { status: 400 }
      );
    }

    // Fetch the graded result with project grade level, methodology, and image URL
    const { data: result, error: resultError } = await supabase
      .from('graded_results')
      .select(
        `
        id,
        questions_json,
        submission:submissions!inner(
          image_url,
          project:projects!inner(user_id, grade_level, teaching_methodology)
        )
      `
      )
      .eq('id', resultId)
      .single();

    if (resultError || !result) {
      return NextResponse.json(
        { error: 'Graded result not found' },
        { status: 404 }
      );
    }

    // Verify ownership - submission is a single object due to !inner join
    const submission = result.submission as unknown as {
      image_url: string | null;
      project: {
        user_id: string;
        grade_level: string | null;
        teaching_methodology: string | null;
      }
    } | null;
    const projectUserId = submission?.project?.user_id;
    const imageUrl = submission?.image_url;
    if (projectUserId !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get teacher's profile defaults
    const { data: profile } = await supabase
      .from('profiles')
      .select('grade_level, teaching_methodology')
      .eq('id', user.id)
      .single();

    // Get grade level priority:
    // 1. Request body (explicit override)
    // 2. Assignment/project grade level (per-assignment setting)
    // 3. Teacher's profile default
    // 4. Fallback to grade 6
    const projectGradeLevel = submission?.project?.grade_level;
    const gradeLevel: GradeLevel =
      body.gradeLevel ||
      (projectGradeLevel as GradeLevel) ||
      (profile?.grade_level as GradeLevel) ||
      '6';

    // Get methodology priority:
    // 1. Request body (explicit override)
    // 2. Assignment/project methodology (per-assignment setting)
    // 3. Teacher's profile default
    // 4. Fallback to 'standard'
    const projectMethodology = submission?.project?.teaching_methodology;
    const methodology: TeachingMethodology =
      body.methodology ||
      (projectMethodology as TeachingMethodology) ||
      (profile?.teaching_methodology as TeachingMethodology) ||
      'standard';

    // Parse questions from the result
    const questionsJson = result.questions_json as Array<{
      questionNumber: number;
      problemText?: string;
      studentAnswer?: string;
      correctAnswer?: string;
      aiAnswer?: string;
      isCorrect: boolean;
      aiCalculation?: string;
      pointsAwarded: number;
      pointsPossible: number;
    }>;

    if (!questionsJson || questionsJson.length === 0) {
      return NextResponse.json(
        { error: 'No questions found in result' },
        { status: 400 }
      );
    }

    // Transform to explanation format
    const questions: QuestionForExplanation[] = questionsJson.map((q) => ({
      questionNumber: q.questionNumber,
      problemText: q.problemText || 'Problem not available',
      studentAnswer: q.studentAnswer || q.aiAnswer || 'No answer',
      correctAnswer: q.correctAnswer || q.aiAnswer || 'Unknown',
      isCorrect: q.isCorrect,
      aiCalculation: q.aiCalculation,
      pointsAwarded: q.pointsAwarded,
      pointsPossible: q.pointsPossible,
    }));

    // Generate explanations with methodology and image for visual context
    console.log(`[EXPLANATION] Generating with grade=${gradeLevel}, methodology=${methodology}, hasImage=${!!imageUrl}`);
    const explanationService = getExplanationService();
    const explanationResult = await explanationService.generateExplanations({
      resultId,
      questions,
      gradeLevel,
      methodology,
      imageUrl: imageUrl || undefined, // Pass image URL for visual diagram matching
    });

    if (!explanationResult.success) {
      return NextResponse.json(
        { error: explanationResult.error || 'Failed to generate explanations' },
        { status: 500 }
      );
    }

    // Save explanations back to the graded result
    const updatedQuestions = questionsJson.map((q, idx) => {
      const explanation = explanationResult.explanations.find(
        (e) => e.questionNumber === q.questionNumber
      ) || explanationResult.explanations[idx];

      return {
        ...q,
        explanation: explanation
          ? {
              gradeLevel,
              methodology,
              steps: explanation.steps,
              whatYouDidRight: explanation.whatYouDidRight,
              whatToImprove: explanation.whatToImprove,
              encouragement: explanation.encouragement,
              generatedAt: explanation.generatedAt,
              diagram: explanation.diagram || null, // Include visual diagram!
            }
          : null,
      };
    });

    // Update the result in database
    const { error: updateError } = await supabase
      .from('graded_results')
      .update({ questions_json: updatedQuestions })
      .eq('id', resultId);

    if (updateError) {
      console.error('[EXPLANATION] Failed to save explanations:', updateError);
      // Still return the explanations even if save failed
    }

    return NextResponse.json({
      success: true,
      resultId,
      gradeLevel,
      methodology,
      gradeBand: explanationResult.gradeBand,
      totalQuestions: explanationResult.totalQuestions,
      explanations: explanationResult.explanations,
      processingTimeMs: explanationResult.processingTimeMs,
      saved: !updateError,
    });
  } catch (error) {
    console.error('[EXPLANATION] API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
