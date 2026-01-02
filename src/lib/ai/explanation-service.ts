/**
 * Smart Explanations Service
 *
 * Generates age-appropriate math explanations using GPT-4o
 * with research-backed RAG context for each grade level.
 */

import {
  type GradeLevel,
  type GradeBand,
  type TeachingMethodology,
  getGradeBand,
  getGradeLevelPrompt,
  GRADE_LEVEL_LABELS,
  METHODOLOGY_LABELS,
} from './rag';
import { type DiagramData, validateDiagramData } from './diagram-types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface TextGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

interface TextGenerationResponse {
  success: boolean;
  content: string;
  error?: string;
}

async function generateText(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  options: TextGenerationOptions = {}
): Promise<TextGenerationResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      content: '',
      error: 'OpenAI API key not configured',
    };
  }

  try {
    const requestBody: Record<string, unknown> = {
      model: 'gpt-4o',
      messages,
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature ?? 0.7,
    };

    // Enable JSON mode for structured output
    if (options.jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        content: '',
        error: `OpenAI API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      success: true,
      content,
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// TYPES
// ============================================

export interface QuestionForExplanation {
  questionNumber: number;
  problemText: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  aiCalculation?: string;
  pointsAwarded: number;
  pointsPossible: number;
}

export interface GeneratedExplanation {
  questionNumber: number;
  isCorrect: boolean;
  steps: string[];
  whatYouDidRight: string | null;
  whatToImprove: string | null;
  encouragement: string | null;
  generatedAt: string;
  /** Optional visual diagram for this explanation */
  diagram?: DiagramData | null;
}

export interface ExplanationResult {
  success: boolean;
  gradeLevel: GradeLevel;
  gradeBand: GradeBand;
  explanations: GeneratedExplanation[];
  totalQuestions: number;
  processingTimeMs: number;
  error?: string;
}

export interface ExplanationRequest {
  resultId: string;
  questions: QuestionForExplanation[];
  gradeLevel: GradeLevel;
  methodology?: TeachingMethodology; // Optional - defaults to 'standard'
}

// ============================================
// PROMPTS
// ============================================

const EXPLANATION_SYSTEM_PROMPT = `You are an expert math tutor generating personalized feedback for students.
Your explanations must be age-appropriate based on the grade level specified.
Follow the guidelines provided for vocabulary, tone, sentence structure, and encouragement style.
You MUST also follow the specific teaching methodology guidelines provided - this determines HOW you explain the math.

CRITICAL RULES:
1. Always follow the grade-level guidelines exactly
2. Use vocabulary appropriate for the student's age
3. Match the tone to the grade level (warm for young, professional for older)
4. For correct answers: celebrate appropriately, reinforce the method
5. For incorrect answers: be encouraging, show the correct approach, identify the specific error
6. Keep explanations focused and not overly long
7. Use step-by-step format for solution explanations
8. IMPORTANT: Use the teaching methodology's specific techniques, language, and approach
9. When appropriate, include a visual diagram to help illustrate the solution`;

function buildExplanationPrompt(
  questions: QuestionForExplanation[],
  gradeLevel: GradeLevel,
  methodology: TeachingMethodology = 'standard'
): string {
  const gradeLevelInstructions = getGradeLevelPrompt(gradeLevel, methodology);
  const gradeBand = getGradeBand(gradeLevel);

  const questionsText = questions
    .map(
      (q, i) => `
QUESTION ${i + 1} (Q${q.questionNumber}):
Problem: ${q.problemText || 'Not available'}
Student's Answer: ${q.studentAnswer || 'No answer provided'}
Correct Answer: ${q.correctAnswer}
Result: ${q.isCorrect ? 'CORRECT' : 'INCORRECT'}
${q.aiCalculation ? `Solution Method: ${q.aiCalculation}` : ''}
Points: ${q.pointsAwarded}/${q.pointsPossible}
`
    )
    .join('\n---\n');

  const methodologyName = METHODOLOGY_LABELS[methodology] || 'Standard';

  // Build methodology-specific diagram guidance
  const diagramGuidance = getDiagramGuidanceForMethodology(methodology);

  return `
${gradeLevelInstructions}

TARGET GRADE: ${GRADE_LEVEL_LABELS[gradeLevel]} (${gradeBand} band)
TEACHING METHODOLOGY: ${methodologyName}

STUDENT'S WORK:
${questionsText}

TASK: Generate age-appropriate explanations for each question above using the ${methodologyName} teaching approach.

For each question, provide:
1. "steps" - Step-by-step solution (array of strings, each step on its own line) - USE THE METHODOLOGY'S APPROACH
2. "whatYouDidRight" - What the student did correctly (null if nothing notable)
3. "whatToImprove" - Specific feedback on what to improve (null if answer was correct)
4. "encouragement" - Age-appropriate encouragement phrase
5. "diagram" - REQUIRED for word problems. Include a structured diagram object to visualize the problem.

VISUAL DIAGRAMS - CRITICAL REQUIREMENT:
For ANY word problem involving quantities, parts, totals, or comparisons, YOU MUST include a diagram.
DO NOT just describe drawing a bar in text - actually include the diagram JSON object.
${diagramGuidance}

AVAILABLE DIAGRAM TYPES:

1. "bar-model" - For part-whole relationships, word problems, comparison
   Data schema: {
     "layout": "part-whole" | "comparison",
     "total": number | null,
     "parts": [{ "value": number | "?", "label": "string" }],
     "unknownIndex": number (0-indexed, which part is unknown)
   }

2. "number-line" - For addition, subtraction, number placement, counting
   Data schema: {
     "min": number,
     "max": number,
     "points": [{ "value": number, "label": "string", "highlight": boolean }],
     "jumps": [{ "from": number, "to": number, "label": "+5" }]
   }

3. "fraction-visual" - For fraction concepts, equivalence, comparison
   Data schema: {
     "type": "circle" | "strip",
     "fractions": [{ "numerator": number, "denominator": number, "shaded": number, "label": "string" }],
     "showComparison": boolean
   }

4. "array-grid" - For multiplication, grouping, area concepts
   Data schema: {
     "rows": number,
     "columns": number,
     "objectStyle": "dot" | "square",
     "showTotal": boolean,
     "label": "3 x 4 = 12"
   }

RESPOND IN THIS EXACT JSON FORMAT:
{
  "explanations": [
    {
      "questionNumber": 1,
      "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
      "whatYouDidRight": "string or null",
      "whatToImprove": "string or null",
      "encouragement": "string",
      "diagram": null or {
        "type": "bar-model" | "number-line" | "fraction-visual" | "array-grid",
        "data": { ... type-specific data ... },
        "textFallback": "Human-readable description of the visual"
      }
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- Include an explanation for EVERY question in the same order
- Match the tone and vocabulary to ${gradeBand} grade level
- USE THE ${methodologyName.toUpperCase()} METHODOLOGY'S techniques and language style
- Keep each step concise but clear
- INCLUDE A DIAGRAM for word problems, fractions, multiplication, and visual math concepts
- If you mention "draw a bar" or "picture" in your steps, you MUST include the actual diagram JSON
- ALWAYS include "textFallback" in every diagram - this is REQUIRED
`;
}

/**
 * Get methodology-specific diagram selection guidance
 */
function getDiagramGuidanceForMethodology(methodology: TeachingMethodology): string {
  switch (methodology) {
    case 'singapore':
      return `METHODOLOGY DIAGRAM PRIORITY (Singapore Math):
- YOU MUST INCLUDE a bar-model diagram for ANY word problem with part-whole relationships
- YOU MUST INCLUDE a bar-model for comparison problems (who has more/less)
- Use number-line for addition/subtraction with jumps
- Bar models are ESSENTIAL to Singapore Math - always include them for word problems
- The diagram is NOT optional for Singapore Math word problems`;

    case 'common-core':
      return `METHODOLOGY DIAGRAM PRIORITY (Common Core):
- Use bar-model (tape diagrams) for word problems and part-whole
- Use array-grid for multiplication facts and area concepts
- Use number-line for number sense and operations
- Use fraction-visual (strip) for fraction understanding`;

    case 'traditional':
      return `METHODOLOGY DIAGRAM PRIORITY (Traditional):
- Use array-grid for multiplication tables and grouping
- Use number-line for integer operations and number placement
- Use fraction-visual (circle) for basic fraction concepts
- Focus on clear, simple visuals that reinforce procedures`;

    case 'montessori':
      return `METHODOLOGY DIAGRAM PRIORITY (Montessori):
- Use fraction-visual for fraction work (concrete to abstract)
- Include rich descriptions in textFallback referencing manipulatives
- Mention bead bars, golden beads, fraction circles in fallback text
- Visual should connect to hands-on materials`;

    case 'saxon':
      return `METHODOLOGY DIAGRAM PRIORITY (Saxon Math):
- Use number-line for incremental problem-solving steps
- Use array-grid for multiplication facts
- Focus on building fluency - diagrams should reinforce patterns
- Keep visuals simple and focused on the specific skill`;

    case 'waldorf':
      return `METHODOLOGY DIAGRAM PRIORITY (Waldorf):
- Include rich imagery in textFallback descriptions
- Use fraction-visual with emphasis on wholeness and parts
- Descriptions should be artistic and story-connected
- Focus on beauty and meaning in visual representations`;

    case 'classical':
      return `METHODOLOGY DIAGRAM PRIORITY (Classical):
- Use number-line for logical progression of concepts
- Use array-grid for demonstrating mathematical relationships
- Focus on clear, logical visual reasoning
- Diagrams should support deductive understanding`;

    default: // 'standard'
      return `DIAGRAM SELECTION GUIDANCE (INCLUDE DIAGRAMS WHEN HELPFUL):
- INCLUDE bar-model for word problems with parts, totals, or comparisons
- INCLUDE number-line for addition, subtraction, or number placement
- INCLUDE fraction-visual for fraction problems
- INCLUDE array-grid for multiplication
- If the problem involves quantities, parts, or visual relationships, INCLUDE a diagram
- The pastry/muffin/donut type problem REQUIRES a bar-model diagram`;
  }
}

// ============================================
// SERVICE
// ============================================

export class ExplanationService {
  /**
   * Generate explanations for a batch of questions
   */
  async generateExplanations(
    request: ExplanationRequest
  ): Promise<ExplanationResult> {
    const startTime = Date.now();
    const { questions, gradeLevel, methodology = 'standard' } = request;
    const gradeBand = getGradeBand(gradeLevel);

    if (questions.length === 0) {
      return {
        success: false,
        gradeLevel,
        gradeBand,
        explanations: [],
        totalQuestions: 0,
        processingTimeMs: Date.now() - startTime,
        error: 'No questions provided',
      };
    }

    try {
      // Build the prompt with methodology
      const prompt = buildExplanationPrompt(questions, gradeLevel, methodology);
      console.log(`[EXPLANATION] Generating with methodology: ${methodology}, grade: ${gradeLevel}`);

      // Call GPT-4o with JSON mode for reliable structured output
      const response = await generateText(
        [
          { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        {
          maxTokens: 4000, // Enough for ~10-15 questions with detailed explanations
          temperature: 0.7, // Slightly creative for natural language
          jsonMode: true, // Ensures valid JSON response
        }
      );

      if (!response.success || !response.content) {
        return {
          success: false,
          gradeLevel,
          gradeBand,
          explanations: [],
          totalQuestions: questions.length,
          processingTimeMs: Date.now() - startTime,
          error: response.error || 'Failed to generate explanations',
        };
      }

      // Parse the JSON response
      const parsed = this.parseExplanationResponse(response.content, questions);

      if (!parsed.success) {
        return {
          success: false,
          gradeLevel,
          gradeBand,
          explanations: [],
          totalQuestions: questions.length,
          processingTimeMs: Date.now() - startTime,
          error: parsed.error,
        };
      }

      // Add metadata to each explanation
      const explanationsWithMeta: GeneratedExplanation[] =
        parsed.explanations.map((exp, idx) => ({
          ...exp,
          questionNumber: questions[idx]?.questionNumber || idx + 1,
          isCorrect: questions[idx]?.isCorrect || false,
          generatedAt: new Date().toISOString(),
        }));

      return {
        success: true,
        gradeLevel,
        gradeBand,
        explanations: explanationsWithMeta,
        totalQuestions: questions.length,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[EXPLANATION] Error generating explanations:', error);
      return {
        success: false,
        gradeLevel,
        gradeBand,
        explanations: [],
        totalQuestions: questions.length,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse the AI response into structured explanations
   */
  private parseExplanationResponse(
    content: string,
    questions: QuestionForExplanation[]
  ): {
    success: boolean;
    explanations: Omit<GeneratedExplanation, 'generatedAt'>[];
    error?: string;
  } {
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();

      // Remove markdown code blocks
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      // Try to extract JSON object if there's text before/after it
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }

      // Log for debugging
      console.log('[EXPLANATION] Attempting to parse response, length:', cleanContent.length);

      let parsed;
      try {
        parsed = JSON.parse(cleanContent);
      } catch (firstParseError) {
        // Try to fix common JSON issues
        console.log('[EXPLANATION] First parse failed, attempting fixes...');

        // Sometimes the AI adds trailing commas
        const fixedContent = cleanContent
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');

        parsed = JSON.parse(fixedContent);
      }

      if (!parsed.explanations || !Array.isArray(parsed.explanations)) {
        return {
          success: false,
          explanations: [],
          error: 'Invalid response structure - missing explanations array',
        };
      }

      // Validate and normalize each explanation
      const explanations = parsed.explanations.map(
        (exp: Record<string, unknown>, idx: number) => {
          // Parse and validate diagram if present
          let diagram: DiagramData | null = null;

          // Log what the AI returned for diagram
          console.log(`[EXPLANATION] Q${idx + 1} raw diagram:`, JSON.stringify(exp.diagram));

          if (exp.diagram && typeof exp.diagram === 'object') {
            const rawDiagram = exp.diagram as Record<string, unknown>;
            const candidateDiagram: DiagramData = {
              type: rawDiagram.type as DiagramData['type'],
              data: rawDiagram.data as DiagramData['data'],
              textFallback:
                typeof rawDiagram.textFallback === 'string'
                  ? rawDiagram.textFallback
                  : 'Visual representation of the math concept',
            };

            // Only include if validation passes
            if (validateDiagramData(candidateDiagram)) {
              diagram = candidateDiagram;
              console.log(
                `[EXPLANATION] Valid diagram for Q${idx + 1}: ${candidateDiagram.type}`
              );
            } else {
              console.log(
                `[EXPLANATION] Invalid diagram for Q${idx + 1}, using fallback`
              );
              // Keep textFallback even if diagram data is invalid
              if (rawDiagram.textFallback) {
                diagram = {
                  type: 'bar-model', // Placeholder type
                  data: { layout: 'part-whole', parts: [] },
                  textFallback: String(rawDiagram.textFallback),
                };
              }
            }
          }

          return {
            questionNumber: questions[idx]?.questionNumber || idx + 1,
            isCorrect: questions[idx]?.isCorrect || false,
            steps: Array.isArray(exp.steps) ? exp.steps : [],
            whatYouDidRight:
              typeof exp.whatYouDidRight === 'string'
                ? exp.whatYouDidRight
                : null,
            whatToImprove:
              typeof exp.whatToImprove === 'string' ? exp.whatToImprove : null,
            encouragement:
              typeof exp.encouragement === 'string' ? exp.encouragement : null,
            diagram,
          };
        }
      );

      return { success: true, explanations };
    } catch (parseError) {
      console.error('[EXPLANATION] Parse error:', parseError);
      console.error('[EXPLANATION] Raw content preview:', content.substring(0, 500));
      return {
        success: false,
        explanations: [],
        error: 'Failed to parse AI response as JSON',
      };
    }
  }
}

// Singleton instance
let explanationServiceInstance: ExplanationService | null = null;

export function getExplanationService(): ExplanationService {
  if (!explanationServiceInstance) {
    explanationServiceInstance = new ExplanationService();
  }
  return explanationServiceInstance;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user has Smart Explanations add-on
 */
export async function hasSmartExplanations(userId: string): Promise<boolean> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('has_smart_explanations')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.has_smart_explanations === true;
}

/**
 * Get user's grade level setting from profile
 */
export async function getUserGradeLevel(
  userId: string
): Promise<GradeLevel | null> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('grade_level')
    .eq('id', userId)
    .single();

  if (error || !data || !data.grade_level) {
    return null;
  }

  // Validate it's a valid grade level
  const validGrades: GradeLevel[] = [
    'K',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    'college',
  ];
  if (validGrades.includes(data.grade_level as GradeLevel)) {
    return data.grade_level as GradeLevel;
  }

  return null;
}

/**
 * Update user's grade level setting
 */
export async function updateUserGradeLevel(
  userId: string,
  gradeLevel: GradeLevel
): Promise<boolean> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ grade_level: gradeLevel, updated_at: new Date().toISOString() })
    .eq('id', userId);

  return !error;
}
