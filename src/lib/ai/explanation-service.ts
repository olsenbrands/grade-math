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

// Message content can be string or array (for vision)
type MessageContent = string | Array<{
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}>;

interface ChatMessage {
  role: 'system' | 'user';
  content: MessageContent;
}

async function generateText(
  messages: Array<ChatMessage>,
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
  imageUrl?: string; // Optional - original worksheet image for visual context
}

// ============================================
// PROMPTS
// ============================================

const EXPLANATION_SYSTEM_PROMPT = `You are a patient, encouraging teacher sitting alongside a student, helping them understand their math work.

YOUR TEACHING STYLE:
- Talk TO the student directly using "you" and "we" language
- Sound like a real teacher, not a textbook
- Respond to the SPECIFIC problem they worked on - reference the actual numbers and context
- Walk through the problem as if you're thinking through it together with the student
- Use conversational phrases like "Let's look at this together...", "Here's what I notice...", "The key thing to understand here is..."

CRITICAL RULES:
1. REFLECT the specific problem - mention the actual items (muffins, scones, donuts) not generic "parts"
2. Be warm and encouraging, like a teacher who genuinely wants the student to succeed
3. Use vocabulary appropriate for the student's age
4. For correct answers: celebrate and reinforce WHY their approach worked
5. For incorrect answers: be encouraging, acknowledge what they tried, then guide them to the right method
6. Keep it conversational - avoid robotic "Step 1, Step 2" language when possible
7. Use the teaching methodology's specific approach and techniques
8. Include visual diagrams that directly relate to the problem context`;

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

TASK: Help this student understand their work like a teacher sitting beside them. Use the ${methodologyName} teaching approach.

YOUR APPROACH:
- Talk directly to the student about THIS specific problem (use the actual context - muffins, pastries, etc.)
- Explain how to arrive at the correct answer: ${questions.length > 0 ? 'shown above' : 'provided'}
- Sound like a real teacher having a conversation, not a textbook
- Reference what you see in their problem - "I see you have 6 muffins and 1 scone..."
- Walk through the thinking process naturally, as if working alongside them

For each question, provide:
1. "steps" - Walk through the solution conversationally (array of strings). Talk like a teacher: "Let's look at what we know...", "So if we have 6 muffins...", "That means the donuts must be..."
2. "whatYouDidRight" - Acknowledge something specific they did well (null if nothing notable)
3. "whatToImprove" - Gentle, specific guidance on what to work on (null if answer was correct)
4. "encouragement" - Warm, personal encouragement that references their specific work
5. "diagram" - REQUIRED for word problems. Include a visual that uses the actual problem context (muffins, pastries, etc.)

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

RESPOND IN THIS EXACT JSON FORMAT (note: diagram is REQUIRED for word problems):
{
  "explanations": [
    {
      "questionNumber": 1,
      "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
      "whatYouDidRight": "string or null",
      "whatToImprove": "string or null",
      "encouragement": "string",
      "diagram": {
        "type": "bar-model",
        "data": {
          "layout": "part-whole",
          "total": 170,
          "parts": [
            {"value": 6, "label": "muffins"},
            {"value": 1, "label": "scones"},
            {"value": "?", "label": "donuts"}
          ],
          "unknownIndex": 2
        },
        "textFallback": "Bar model showing muffins (6), scones (1), and donuts (?) totaling 170"
      }
    }
  ]
}

DIAGRAM IS REQUIRED - The example above shows a bar-model. You MUST include a diagram object for word problems. DO NOT use null for diagram when the problem involves quantities or parts.

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
    const { questions, gradeLevel, methodology = 'standard', imageUrl } = request;
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
      console.log(`[EXPLANATION] Generating with methodology: ${methodology}, grade: ${gradeLevel}, hasImage: ${!!imageUrl}`);

      // Build user message - include image if available
      let userMessage: ChatMessage;
      if (imageUrl) {
        // Vision message with image + text
        userMessage = {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'high' },
            },
            {
              type: 'text',
              text: `STUDENT'S WORKSHEET IMAGE: Look at the attached image to see the student's work and any visual diagrams they used.

IMPORTANT: When you create your diagram, try to match the visual STYLE shown in the student's worksheet. If they drew stacked horizontal bars, use that layout. If they drew a pie chart, match that style.

${prompt}`,
            },
          ],
        };
      } else {
        userMessage = { role: 'user', content: prompt };
      }

      // Call GPT-4o with JSON mode for reliable structured output
      const response = await generateText(
        [
          { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
          userMessage,
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
