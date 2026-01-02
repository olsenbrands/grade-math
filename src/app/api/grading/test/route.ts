/**
 * Test Grading API - Direct grading without database
 *
 * POST with { image: { type: 'base64', data: '...', mimeType: 'image/jpeg' } }
 */

import { NextResponse } from 'next/server';
import { getEnhancedGradingService } from '@/lib/ai';
import type { GradingRequest, ImageInput } from '@/lib/ai';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const imageInput: ImageInput = body.image;

    const gradingRequest: GradingRequest = {
      submissionId: `test-${Date.now()}`,
      image: imageInput,
      // No answer key - AI grades independently
      options: {
        generateFeedback: true,
        extractStudentName: true,
      },
    };

    console.log('Starting test grading...');
    const startTime = Date.now();

    const gradingService = getEnhancedGradingService();
    const result = await gradingService.gradeSubmissionEnhanced(gradingRequest, {
      generateFeedback: true,
      requireMathpix: false, // Use whatever is available for testing
    });

    const elapsed = Date.now() - startTime;
    console.log(`Grading completed in ${elapsed}ms`);

    return NextResponse.json({
      success: result.success,
      totalScore: result.totalScore,
      totalPossible: result.totalPossible,
      percentage: result.percentage,
      provider: result.provider,
      model: result.model,
      processingTimeMs: result.processingTimeMs,
      detectedStudentName: result.detectedStudentName,
      questions: result.questions,
      error: result.error,
      needsReview: result.needsReview,
      reviewReason: result.reviewReason,
    });
  } catch (error) {
    console.error('Test grading error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
