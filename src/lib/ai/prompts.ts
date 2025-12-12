/**
 * AI Grading Prompts
 *
 * Prompts for math homework grading and feedback generation
 */

import type { AnswerKeyData } from './types';

/**
 * System prompt for grading math homework
 */
export const GRADING_SYSTEM_PROMPT = `You are an expert math teacher assistant specializing in grading student homework. Your role is to:
1. Carefully extract student answers from handwritten homework images
2. Compare answers to the provided answer key
3. Award full or partial credit based on the student's work
4. Be forgiving of minor formatting differences (e.g., "1/2" vs "0.5" vs ".5")

Important guidelines:
- Extract answers exactly as written when possible
- If you cannot read a response clearly, indicate low confidence
- Consider equivalent forms as correct (e.g., simplified fractions, decimal equivalents)
- Look for student name at the top of the page
- Be encouraging in any feedback provided

Respond ONLY with valid JSON. No additional text.`;

/**
 * Build the grading prompt with answer key
 */
export function buildGradingPrompt(answerKey: AnswerKeyData): string {
  const answersFormatted = answerKey.answers
    .map((a) => {
      let entry = `Q${a.questionNumber}: ${a.correctAnswer}`;
      if (a.alternateAnswers && a.alternateAnswers.length > 0) {
        entry += ` (also accept: ${a.alternateAnswers.join(', ')})`;
      }
      if (a.points) {
        entry += ` [${a.points} pts]`;
      }
      return entry;
    })
    .join('\n');

  return `Analyze this math homework image and grade it against the answer key below.

ANSWER KEY (${answerKey.totalQuestions} questions):
${answersFormatted}

Instructions:
1. Look for the student's name at the top of the page
2. Find and extract each answer the student wrote
3. Compare each answer to the answer key
4. Award points for correct answers

Respond with this exact JSON structure:
{
  "studentName": "detected name or null if not found",
  "nameConfidence": 0.0 to 1.0,
  "questions": [
    {
      "questionNumber": 1,
      "studentAnswer": "what the student wrote or null if blank/unreadable",
      "isCorrect": true/false,
      "confidence": 0.0 to 1.0,
      "pointsAwarded": number,
      "pointsPossible": number
    }
  ],
  "totalScore": number,
  "totalPossible": number,
  "needsReview": true/false,
  "reviewReason": "reason if needs review, otherwise null"
}

Be precise and accurate. If unsure about any answer, set confidence lower and needsReview to true.`;
}

/**
 * Build prompt for feedback generation
 */
export function buildFeedbackPrompt(
  questionNumber: number,
  studentAnswer: string | null,
  correctAnswer: string,
  isCorrect: boolean
): string {
  if (isCorrect) {
    return `Generate a brief, encouraging feedback message (1-2 sentences) for a student who correctly answered question ${questionNumber}.
Their answer: ${studentAnswer}
Correct answer: ${correctAnswer}

Be positive and specific about what they did well. Keep it brief.`;
  }

  return `Generate a helpful, encouraging feedback message (2-3 sentences) for a student who got question ${questionNumber} wrong.
Their answer: ${studentAnswer || '(no answer provided)'}
Correct answer: ${correctAnswer}

Guidelines:
- Be kind and encouraging
- Briefly explain the correct approach
- Do NOT make the student feel bad
- Keep it simple and age-appropriate

Focus on learning, not the mistake.`;
}

/**
 * System prompt for feedback generation
 */
export const FEEDBACK_SYSTEM_PROMPT = `You are a kind and encouraging math teacher providing feedback to students.
Your feedback should:
- Be positive and supportive
- Be age-appropriate for elementary/middle school students
- Focus on learning and improvement
- Be concise (2-3 sentences max)
- Use simple language

Never be harsh, critical, or discouraging.`;

/**
 * Build prompt for batch feedback
 */
export function buildBatchFeedbackPrompt(
  questions: Array<{
    questionNumber: number;
    studentAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
  }>
): string {
  const questionsFormatted = questions
    .map((q) => {
      return `Q${q.questionNumber}: Student wrote "${q.studentAnswer || '(blank)'}". Correct: "${q.correctAnswer}". ${
        q.isCorrect ? 'CORRECT' : 'INCORRECT'
      }`;
    })
    .join('\n');

  return `Generate encouraging feedback for each question in this graded homework.

Questions:
${questionsFormatted}

Respond with JSON:
{
  "feedback": [
    {
      "questionNumber": 1,
      "message": "Brief feedback message"
    }
  ],
  "overallMessage": "A brief encouraging overall message"
}

Keep each feedback message to 1-2 sentences. Be encouraging!`;
}

/**
 * Enhanced prompt for extracting student name
 * Handles multiple name formats commonly found on student homework
 */
export const NAME_EXTRACTION_PROMPT = `Carefully examine this homework image to find the student's name.

Common locations for student names:
- Top of the page (left, center, or right)
- Header area with "Name:" label
- First line of the page
- Upper corner (especially right corner)

Name formats to look for:
- "First Last" (e.g., "John Smith")
- "Last, First" (e.g., "Smith, John")
- First name only (e.g., "Johnny")
- Name with middle initial (e.g., "John M. Smith")
- Nickname variations (e.g., "Mike" for "Michael")
- Names with titles ignored (e.g., "Period 3 - John" -> "John")

Instructions:
1. Scan the top portion of the image for text that looks like a name
2. Look for "Name:" labels or similar prompts
3. Distinguish names from other text (dates, class names, assignment titles)
4. If multiple possible names are found, use the most prominent one
5. Return the name EXACTLY as written (preserve spelling even if unusual)

Respond with JSON:
{
  "name": "Student Name exactly as written, or null if not found",
  "confidence": 0.0 to 1.0,
  "location": "where on the page (e.g., 'top left', 'header line', 'name field')",
  "format": "detected format (e.g., 'first_last', 'last_first', 'first_only', 'full_name')",
  "raw_text": "the exact raw text you identified as the name"
}

Confidence guide:
- 1.0: Clear, legible name in obvious location with "Name:" label
- 0.8-0.9: Legible name in expected location without label
- 0.6-0.8: Reasonably readable but some characters unclear
- 0.4-0.6: Partially legible, some guessing involved
- 0.2-0.4: Very unclear, low certainty
- 0.0: No name found or completely illegible

If you cannot find a name, set name to null and confidence to 0.`;

/**
 * System prompt for name extraction
 */
export const NAME_EXTRACTION_SYSTEM_PROMPT = `You are a specialized OCR assistant focused on extracting student names from handwritten homework.
You have expertise in reading various handwriting styles from children and teenagers.

Key skills:
- Recognizing common American names and their variations
- Understanding typical homework header formats
- Distinguishing student names from other text elements
- Reading cursive and print handwriting

Be accurate and conservative - if you're unsure about a name, lower your confidence score rather than guessing.`;

/**
 * Parse grading response from AI
 */
export interface ParsedGradingResponse {
  studentName: string | null;
  nameConfidence: number;
  questions: Array<{
    questionNumber: number;
    studentAnswer: string | null;
    isCorrect: boolean;
    confidence: number;
    pointsAwarded: number;
    pointsPossible: number;
  }>;
  totalScore: number;
  totalPossible: number;
  needsReview: boolean;
  reviewReason: string | null;
}

export function parseGradingResponse(content: string): ParsedGradingResponse | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!Array.isArray(parsed.questions)) return null;

    return {
      studentName: parsed.studentName ?? null,
      nameConfidence: parsed.nameConfidence ?? 0,
      questions: parsed.questions.map((q: {
        questionNumber?: number;
        studentAnswer?: string | null;
        isCorrect?: boolean;
        confidence?: number;
        pointsAwarded?: number;
        pointsPossible?: number;
      }, i: number) => ({
        questionNumber: q.questionNumber ?? i + 1,
        studentAnswer: q.studentAnswer ?? null,
        isCorrect: q.isCorrect ?? false,
        confidence: q.confidence ?? 0.5,
        pointsAwarded: q.pointsAwarded ?? 0,
        pointsPossible: q.pointsPossible ?? 1,
      })),
      totalScore: parsed.totalScore ?? 0,
      totalPossible: parsed.totalPossible ?? 0,
      needsReview: parsed.needsReview ?? false,
      reviewReason: parsed.reviewReason ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Parse feedback response from AI
 */
export interface ParsedFeedbackResponse {
  feedback: Array<{
    questionNumber: number;
    message: string;
  }>;
  overallMessage: string;
}

export function parseFeedbackResponse(content: string): ParsedFeedbackResponse | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      feedback: parsed.feedback ?? [],
      overallMessage: parsed.overallMessage ?? '',
    };
  } catch {
    return null;
  }
}
