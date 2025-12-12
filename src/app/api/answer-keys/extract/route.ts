/**
 * Answer Key Extraction API
 *
 * Extracts answers from an image-based answer key using AI
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAIProviderManager, imageUrlToInput } from '@/lib/ai';
import {
  ANSWER_KEY_EXTRACTION_PROMPT,
  ANSWER_KEY_EXTRACTION_SYSTEM_PROMPT,
} from '@/lib/ai/prompts';

export const maxDuration = 60;

export async function POST(request: Request) {
  console.log('=== ANSWER KEY EXTRACTION API CALLED ===');

  try {
    const { projectId } = await request.json();
    console.log('Extracting answers for project:', projectId);

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get the answer key
    const { data: answerKey, error: akError } = await supabase
      .from('project_answer_keys')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (akError || !answerKey) {
      return NextResponse.json({ error: 'Answer key not found' }, { status: 404 });
    }

    if (answerKey.type !== 'image' || !answerKey.storage_path) {
      return NextResponse.json({ error: 'Answer key is not an image' }, { status: 400 });
    }

    // Get signed URL for the answer key image
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('answer-keys')
      .createSignedUrl(answerKey.storage_path, 3600);

    if (urlError || !signedUrl) {
      return NextResponse.json({ error: 'Failed to get image URL' }, { status: 500 });
    }

    // Convert image
    const imageInput = await imageUrlToInput(signedUrl.signedUrl);

    // Use AI to extract answers
    const manager = getAIProviderManager();
    const response = await manager.analyzeImage(
      imageInput,
      ANSWER_KEY_EXTRACTION_PROMPT,
      ANSWER_KEY_EXTRACTION_SYSTEM_PROMPT
    );

    if (!response.success) {
      return NextResponse.json({ error: response.error || 'AI extraction failed' }, { status: 500 });
    }

    // Parse the AI response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Transform to our format
    const answers = (extracted.answers || []).map((a: { question_number?: number; answer: string; points?: number }, idx: number) => ({
      question_number: a.question_number ?? idx + 1,
      answer: String(a.answer),
      points: a.points ?? 1,
    }));

    // Update the answer key with extracted answers
    console.log('Saving extracted answers:', JSON.stringify(answers, null, 2));

    const { error: updateError } = await supabase
      .from('project_answer_keys')
      .update({
        answers: answers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', answerKey.id);

    if (updateError) {
      console.error('Failed to update answer key:', updateError);
      return NextResponse.json({ error: 'Failed to save extracted answers' }, { status: 500 });
    }

    console.log('=== EXTRACTION COMPLETE - Saved', answers.length, 'answers ===');

    return NextResponse.json({
      success: true,
      answers,
      totalQuestions: extracted.total_questions || answers.length,
      notes: extracted.notes,
    });
  } catch (error) {
    console.error('Answer key extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
