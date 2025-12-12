/**
 * AI Grading Prompts
 *
 * Prompts for math homework grading and feedback generation
 */

import type { AnswerKeyData } from './types';

/**
 * System prompt for grading math homework
 * Uses chain-of-thought verification: AI solves independently, then compares to answer key
 */
export const GRADING_SYSTEM_PROMPT = `You are an expert math teacher assistant specializing in grading student homework. You have exceptional math skills and can solve any K-12 math problem.

YOUR GRADING PROCESS (follow this exactly):
1. IDENTIFY: Read each math problem on the homework - note if handwriting is unclear
2. SOLVE: Calculate the correct answer yourself (show your reasoning)
3. READ: Extract the student's written answer - note if hard to read
4. COMPARE: Check if the student's answer matches your calculation
5. VERIFY: If an answer key is provided, compare your answer to the key
6. RECONCILE: If your answer differs from the key, double-check your work
7. GRADE: Mark correct based on mathematical truth (your calculation takes priority if key is wrong)
8. FLAG: If ANY text is hard to read, set needsReview=true and explain what's unclear

CRITICAL RULES:
- YOU must solve the math yourself - don't just compare to the answer key blindly
- If the answer key is missing an answer, use YOUR calculation to grade
- If the answer key appears wrong, flag it for review but grade based on correct math
- Consider equivalent forms as correct (1/2 = 0.5 = 50%, 3/6 = 1/2, etc.)
- Partial credit for work shown even if final answer is wrong

HANDWRITING QUALITY ASSESSMENT:
- For EACH question, rate how clearly you can read the problem AND the answer
- "readabilityConfidence": 1.0 = crystal clear, 0.7 = readable but messy, 0.5 = guessing, 0.3 = very unclear
- If readabilityConfidence < 0.7 for ANY question, set needsReview=true
- Describe what's unclear in "readabilityIssue" (e.g., "number could be 5 or 2", "smudged", "crossed out")

HANDLING CHAOTIC HOMEWORK:
- Text written UPSIDE DOWN or SIDEWAYS: Still read and grade it, note in readabilityIssue
- SCRIBBLED OUT answers: Set studentAnswer to null, readabilityIssue to "answer crossed out/scribbled"
- OBSCURED by stains/drawings: If you can partially read it, try your best and note uncertainty
- INCOMPLETE problems (no answer written): Set studentAnswer to null
- OVERLAPPING text: Try to separate distinct problems, note confusion in readabilityIssue
- TORN/MISSING portions: Only grade what you can see, note in reviewReason
- MIXED writing tools (crayon, pen, pencil): Read all of them
- If problem number is unclear, use your best judgment on order

Look for student name at the top of the page (may be in crayon, marker, or messy writing).

Respond ONLY with valid JSON. No additional text.`;

/**
 * Build the grading prompt with answer key
 */
/**
 * Build the BLIND grading prompt - NO answer key shown
 * This forces the AI to calculate independently
 */
export function buildBlindGradingPrompt(): string {
  return `Analyze this math homework image and grade it using YOUR OWN CALCULATIONS.

You will NOT be given an answer key. You must solve every problem yourself.

GRADING INSTRUCTIONS:
1. Find the student's name at the top of the page
2. For EACH math problem on the homework:
   a. READ the problem exactly as written (e.g., "6 x 7 = ?")
   b. SOLVE it yourself - show your step-by-step calculation
   c. RECORD your calculated answer - this is the correct answer
   d. READ what the student wrote as their answer
   e. COMPARE: Does the student's answer match YOUR calculated answer?
   f. GRADE: Mark correct if student matches YOUR calculation

IMPORTANT:
- You are the authority on what's correct - solve each problem yourself
- Show your work in "aiCalculation" (e.g., "6 x 7 = 42 because 6 groups of 7")
- Grade based on mathematical correctness
- No answer key will be provided - you must calculate everything

Respond with this exact JSON structure:
{
  "studentName": "detected name or null if not found",
  "nameConfidence": 0.0 to 1.0,
  "questions": [
    {
      "questionNumber": 1,
      "problemText": "the math problem as written (e.g., '6 x 7 =')",
      "aiCalculation": "your step-by-step calculation showing work (e.g., '6 x 7 = 42 because 6 groups of 7 is 42')",
      "aiAnswer": "your calculated correct answer (e.g., '42')",
      "studentAnswer": "what the student wrote or null if blank/unreadable",
      "isCorrect": true/false (does student answer match YOUR aiAnswer?),
      "confidence": 0.0 to 1.0,
      "readabilityConfidence": 0.0 to 1.0,
      "readabilityIssue": "describe any reading difficulties or null",
      "pointsAwarded": number,
      "pointsPossible": number
    }
  ],
  "totalScore": number,
  "totalPossible": number,
  "needsReview": true/false,
  "reviewReason": "reason or null"
}`;
}

/**
 * Build the grading prompt - now uses blind grading (no answer key shown to AI)
 * Answer key comparison happens AFTER the AI returns its independent calculations
 */
export function buildGradingPrompt(_answerKey: AnswerKeyData): string {
  return buildBlindGradingPrompt();
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
 * Prompt for extracting answers from an answer key image
 */
export const ANSWER_KEY_EXTRACTION_PROMPT = `Analyze this answer key image and extract all the answers.

For EACH question/problem you see:
1. Identify the question number
2. Extract the correct answer

Respond with this exact JSON structure:
{
  "answers": [
    {
      "question_number": 1,
      "problem_text": "the problem as written (e.g., '4 x 9 =')",
      "answer": "36",
      "points": 1
    }
  ],
  "total_questions": number,
  "notes": "any observations about the answer key (optional)"
}

Important:
- Include ALL questions you can see
- If an answer is hard to read, include your best guess
- Keep answers in their simplest form (e.g., "36" not "= 36")
- Question numbers should be integers starting from 1`;

export const ANSWER_KEY_EXTRACTION_SYSTEM_PROMPT = `You are an expert at reading and extracting information from math answer keys and worksheets. You can read both printed and handwritten text with high accuracy.`;

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
    problemText?: string;
    aiCalculation?: string;
    aiAnswer?: string;
    studentAnswer: string | null;
    answerKeyValue?: string | null;
    isCorrect: boolean;
    confidence: number;
    readabilityConfidence?: number;
    readabilityIssue?: string | null;
    pointsAwarded: number;
    pointsPossible: number;
    discrepancy?: string | null;
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
        problemText?: string;
        aiCalculation?: string;
        aiAnswer?: string;
        studentAnswer?: string | null;
        answerKeyValue?: string | null;
        isCorrect?: boolean;
        confidence?: number;
        readabilityConfidence?: number;
        readabilityIssue?: string | null;
        pointsAwarded?: number;
        pointsPossible?: number;
        discrepancy?: string | null;
      }, i: number) => ({
        questionNumber: q.questionNumber ?? i + 1,
        problemText: q.problemText,
        aiCalculation: q.aiCalculation,
        aiAnswer: q.aiAnswer,
        studentAnswer: q.studentAnswer ?? null,
        answerKeyValue: q.answerKeyValue,
        isCorrect: q.isCorrect ?? false,
        confidence: q.confidence ?? 0.5,
        readabilityConfidence: q.readabilityConfidence ?? 1.0,
        readabilityIssue: q.readabilityIssue ?? null,
        pointsAwarded: q.pointsAwarded ?? 0,
        pointsPossible: q.pointsPossible ?? 1,
        discrepancy: q.discrepancy,
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
