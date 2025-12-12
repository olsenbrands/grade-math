/**
 * Results Storage Service
 *
 * Manages storage and retrieval of grading results
 */

import { createClient } from '@/lib/supabase/server';
import type { GradingResult, QuestionResult, AIProviderName } from './types';

export interface StoredResult {
  id: string;
  submissionId: string;
  projectId: string;
  studentId?: string;
  totalScore: number;
  totalPossible: number;
  percentage: number;
  questionsJson: QuestionResult[];
  detectedName?: string;
  nameConfidence?: number;
  provider: AIProviderName;
  model: string;
  processingTimeMs: number;
  tokensUsed?: number;
  needsReview: boolean;
  reviewReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
}

/**
 * Save a grading result to the database
 */
export async function saveGradingResult(
  result: GradingResult,
  projectId: string,
  studentId?: string
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('graded_results')
    .insert({
      submission_id: result.submissionId,
      project_id: projectId,
      student_id: studentId || null,
      score: result.totalScore,
      max_score: result.totalPossible,
      // percentage is a generated column, don't insert it
      questions_json: result.questions,
      detected_name: result.detectedStudentName || null,
      name_confidence: result.nameConfidence || null,
      provider: result.provider,
      model: result.model,
      processing_time_ms: result.processingTimeMs,
      tokens_used: result.tokensUsed || null,
      needs_review: result.needsReview || false,
      review_reason: result.reviewReason || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save grading result:', error);
    return null;
  }

  // Update submission status
  await supabase
    .from('submissions')
    .update({
      status: result.needsReview ? 'needs_review' : 'completed',
      detected_name: result.detectedStudentName || null,
      name_confidence: result.nameConfidence || null,
    })
    .eq('id', result.submissionId);

  return data?.id || null;
}

/**
 * Get grading result by submission ID
 */
export async function getResultBySubmission(
  submissionId: string
): Promise<StoredResult | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('graded_results')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return mapDatabaseResult(data);
}

/**
 * Get all results for a project
 */
export async function getProjectResults(
  projectId: string,
  options: {
    limit?: number;
    offset?: number;
    needsReviewOnly?: boolean;
    studentId?: string;
  } = {}
): Promise<StoredResult[]> {
  const supabase = await createClient();

  let query = supabase
    .from('graded_results')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (options.needsReviewOnly) {
    query = query.eq('needs_review', true);
  }

  if (options.studentId) {
    query = query.eq('student_id', options.studentId);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map(mapDatabaseResult);
}

/**
 * Get project statistics
 */
export async function getProjectStats(projectId: string): Promise<{
  totalGraded: number;
  averageScore: number;
  needsReview: number;
  highestScore: number;
  lowestScore: number;
  scoreDistribution: Record<string, number>;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('graded_results')
    .select('percentage, needs_review')
    .eq('project_id', projectId);

  if (error || !data || data.length === 0) {
    return {
      totalGraded: 0,
      averageScore: 0,
      needsReview: 0,
      highestScore: 0,
      lowestScore: 0,
      scoreDistribution: {},
    };
  }

  const percentages = data.map((r) => r.percentage);
  const needsReviewCount = data.filter((r) => r.needs_review).length;

  // Calculate score distribution (0-10, 10-20, ..., 90-100)
  const distribution: Record<string, number> = {};
  for (let i = 0; i <= 90; i += 10) {
    const key = `${i}-${i + 10}`;
    distribution[key] = percentages.filter((p) => p >= i && p < i + 10).length;
  }
  // 100% exactly
  distribution['100'] = percentages.filter((p) => p === 100).length;

  return {
    totalGraded: data.length,
    averageScore: Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length),
    needsReview: needsReviewCount,
    highestScore: Math.max(...percentages),
    lowestScore: Math.min(...percentages),
    scoreDistribution: distribution,
  };
}

/**
 * Mark result as reviewed
 */
export async function markAsReviewed(
  resultId: string,
  reviewerId: string,
  updatedQuestions?: QuestionResult[]
): Promise<boolean> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    needs_review: false,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerId,
  };

  if (updatedQuestions) {
    const totalScore = updatedQuestions.reduce((sum, q) => sum + q.pointsAwarded, 0);
    const totalPossible = updatedQuestions.reduce((sum, q) => sum + q.pointsPossible, 0);

    updateData.questions_json = updatedQuestions;
    updateData.total_score = totalScore;
    updateData.total_possible = totalPossible;
    updateData.percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
  }

  const { error } = await supabase
    .from('graded_results')
    .update(updateData)
    .eq('id', resultId);

  return !error;
}

/**
 * Update a specific question in a result
 */
export async function updateQuestionResult(
  resultId: string,
  questionNumber: number,
  updates: Partial<QuestionResult>
): Promise<boolean> {
  const supabase = await createClient();

  // Get current result
  const { data: current, error: fetchError } = await supabase
    .from('graded_results')
    .select('questions_json')
    .eq('id', resultId)
    .single();

  if (fetchError || !current) return false;

  // Update the specific question
  const questions = current.questions_json as QuestionResult[];
  const questionIndex = questions.findIndex((q) => q.questionNumber === questionNumber);

  if (questionIndex === -1) return false;

  const existingQuestion = questions[questionIndex];
  if (!existingQuestion) return false;

  // Merge updates while preserving required fields
  questions[questionIndex] = {
    questionNumber: existingQuestion.questionNumber,
    studentAnswer: updates.studentAnswer !== undefined ? updates.studentAnswer : existingQuestion.studentAnswer,
    correctAnswer: updates.correctAnswer ?? existingQuestion.correctAnswer,
    isCorrect: updates.isCorrect ?? existingQuestion.isCorrect,
    pointsAwarded: updates.pointsAwarded ?? existingQuestion.pointsAwarded,
    pointsPossible: updates.pointsPossible ?? existingQuestion.pointsPossible,
    confidence: updates.confidence ?? existingQuestion.confidence,
    feedback: updates.feedback ?? existingQuestion.feedback,
    partialCredit: updates.partialCredit ?? existingQuestion.partialCredit,
  };

  // Recalculate totals
  const totalScore = questions.reduce((sum, q) => sum + q.pointsAwarded, 0);
  const totalPossible = questions.reduce((sum, q) => sum + q.pointsPossible, 0);

  const { error } = await supabase
    .from('graded_results')
    .update({
      questions_json: questions,
      total_score: totalScore,
      total_possible: totalPossible,
      percentage: totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0,
    })
    .eq('id', resultId);

  return !error;
}

/**
 * Delete a grading result
 */
export async function deleteResult(resultId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase.from('graded_results').delete().eq('id', resultId);

  return !error;
}

/**
 * Link result to a student
 */
export async function linkResultToStudent(
  resultId: string,
  studentId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('graded_results')
    .update({ student_id: studentId })
    .eq('id', resultId);

  return !error;
}

// Helper to map database row to StoredResult
function mapDatabaseResult(data: {
  id: string;
  submission_id: string;
  project_id: string;
  student_id?: string;
  total_score: number;
  total_possible: number;
  percentage: number;
  questions_json: unknown;
  detected_name?: string;
  name_confidence?: number;
  provider: string;
  model: string;
  processing_time_ms: number;
  tokens_used?: number;
  needs_review: boolean;
  review_reason?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
}): StoredResult {
  return {
    id: data.id,
    submissionId: data.submission_id,
    projectId: data.project_id,
    studentId: data.student_id,
    totalScore: data.total_score,
    totalPossible: data.total_possible,
    percentage: data.percentage,
    questionsJson: data.questions_json as QuestionResult[],
    detectedName: data.detected_name,
    nameConfidence: data.name_confidence,
    provider: data.provider as AIProviderName,
    model: data.model,
    processingTimeMs: data.processing_time_ms,
    tokensUsed: data.tokens_used,
    needsReview: data.needs_review,
    reviewReason: data.review_reason,
    reviewedAt: data.reviewed_at,
    reviewedBy: data.reviewed_by,
    createdAt: data.created_at,
  };
}
