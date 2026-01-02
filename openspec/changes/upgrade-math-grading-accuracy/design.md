# Upgrade Math Grading Accuracy - Design Document

**Change:** upgrade-math-grading-accuracy
**PRD:** [./prd.md](./prd.md)
**Created:** 2026-01-02

---

## Architecture Overview

The enhanced grading pipeline introduces a multi-stage approach:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENHANCED GRADING PIPELINE                        │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │ Image Input  │
                         └──────┬───────┘
                                │
              ┌─────────────────┴─────────────────┐
              │         PREPROCESSING              │
              │                                    │
              │  ┌────────────┐    ┌───────────┐  │
              │  │  Mathpix   │───→│  LaTeX/   │  │
              │  │    OCR     │    │   Text    │  │
              │  └────────────┘    └───────────┘  │
              │         │                │        │
              │         ↓                ↓        │
              │  ┌────────────────────────────┐   │
              │  │   Math Difficulty          │   │
              │  │   Classifier               │   │
              │  └────────────────────────────┘   │
              └─────────────────┬─────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ↓                     ↓                     ↓
    ┌──────────┐         ┌──────────┐         ┌──────────┐
    │  SIMPLE  │         │ MODERATE │         │ COMPLEX  │
    │ Pipeline │         │ Pipeline │         │ Pipeline │
    └────┬─────┘         └────┬─────┘         └────┬─────┘
         │                    │                    │
         ↓                    ↓                    ↓
    ┌─────────┐          ┌─────────┐          ┌─────────┐
    │ GPT-4o  │          │ GPT-4o  │          │ GPT-4o  │
    │  Solve  │          │  Solve  │          │  Solve  │
    └────┬────┘          └────┬────┘          └────┬────┘
         │                    │                    │
         │                    ↓                    ↓
         │              ┌──────────┐         ┌──────────┐
         │              │  Chain   │         │ Wolfram  │
         │              │   of     │         │  Alpha   │
         │              │ Thought  │         │ Verify   │
         │              └────┬─────┘         └────┬─────┘
         │                    │                    │
         │                    ↓                    ↓
         │              ┌──────────┐         ┌──────────┐
         │              │ Compare  │         │ Compare  │
         │              │ Answers  │         │ Answers  │
         │              └────┬─────┘         └────┬─────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │  Final Result   │
                    │  + Confidence   │
                    └─────────────────┘
```

---

## Technical Approach

### 1. Mathpix Integration

**API Endpoint:** `https://api.mathpix.com/v3/text`

**Request Format:**
```typescript
interface MathpixRequest {
  src: string; // base64 image data URL
  formats: ['latex_styled', 'text'];
  data_options: {
    include_detected_alphabets: true;
    include_word_data: true;
  };
}
```

**Response Format:**
```typescript
interface MathpixResult {
  latex_styled: string;     // "\\frac{3}{4} + \\frac{1}{2} = "
  text: string;             // "3/4 + 1/2 = "
  confidence: number;       // 0.0 - 1.0
  word_data: Array<{
    text: string;
    confidence: number;
    rect: { x: number; y: number; width: number; height: number };
  }>;
  detected_alphabets: string[];
}
```

**Implementation:**
```typescript
// src/lib/ai/providers/mathpix.ts
export class MathpixProvider {
  async extractMath(imageBase64: string): Promise<MathpixResult> {
    const response = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'app_id': process.env.MATHPIX_APP_ID!,
        'app_key': process.env.MATHPIX_APP_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        src: `data:image/jpeg;base64,${imageBase64}`,
        formats: ['latex_styled', 'text'],
        data_options: {
          include_detected_alphabets: true,
          include_word_data: true,
        },
      }),
    });

    return response.json();
  }
}
```

---

### 2. Wolfram Alpha Integration

**API Endpoint:** `https://api.wolframalpha.com/v2/query`

**Request Format:**
```typescript
interface WolframRequest {
  appid: string;
  input: string;           // Math expression
  format: 'plaintext';
  output: 'json';
  podindex: '1,2';         // Get input interpretation + result
}
```

**Response Handling:**
```typescript
// src/lib/ai/providers/wolfram.ts
export class WolframProvider {
  async solve(expression: string): Promise<WolframResult> {
    // Clean expression for Wolfram
    const cleaned = this.normalizeExpression(expression);

    const params = new URLSearchParams({
      appid: process.env.WOLFRAM_APP_ID!,
      input: cleaned,
      format: 'plaintext',
      output: 'json',
    });

    const response = await fetch(
      `https://api.wolframalpha.com/v2/query?${params}`
    );

    const data = await response.json();

    // Extract result from pods
    const resultPod = data.queryresult?.pods?.find(
      (p: any) => p.title === 'Result' || p.title === 'Decimal approximation'
    );

    return {
      success: data.queryresult?.success,
      input: expression,
      result: resultPod?.subpods?.[0]?.plaintext,
      confidence: this.calculateConfidence(data),
    };
  }

  private normalizeExpression(expr: string): string {
    // Convert LaTeX to Wolfram-compatible format
    return expr
      .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '$1/$2')  // \frac{1}{2} → 1/2
      .replace(/\\times/g, '*')
      .replace(/\\div/g, '/')
      .replace(/\\cdot/g, '*')
      .replace(/=/g, '==');  // For equation solving
  }
}
```

---

### 3. Math Difficulty Classifier

**Classification Logic:**
```typescript
// src/lib/ai/math-classifier.ts

export type MathDifficulty = 'simple' | 'moderate' | 'complex';

export function classifyDifficulty(problemText: string): MathDifficulty {
  const normalized = problemText.toLowerCase();

  // Complex indicators
  const complexPatterns = [
    /[a-z]\s*[=+\-*/]/,           // Variables (x, y, n)
    /solve|find|equation/i,        // Word problems
    /\^[2-9]|\^{/,                 // Exponents > 1
    /sqrt|√/,                      // Square roots
    /\([^)]+\)\s*[*/+\-]/,         // Parenthetical expressions
  ];

  // Moderate indicators
  const moderatePatterns = [
    /\\frac|\/\d+/,                // Fractions
    /\.\d+/,                       // Decimals
    /%/,                           // Percentages
    /\^1/,                         // Simple exponents
  ];

  if (complexPatterns.some(p => p.test(normalized))) {
    return 'complex';
  }

  if (moderatePatterns.some(p => p.test(normalized))) {
    return 'moderate';
  }

  return 'simple';
}
```

---

### 4. Answer Comparison Logic

**Handling Equivalent Forms:**
```typescript
// src/lib/ai/answer-comparator.ts

export function compareAnswers(
  aiAnswer: string,
  verificationAnswer: string,
  tolerance: number = 0.0001
): ComparisonResult {
  // Normalize both answers
  const normalizedAI = normalizeAnswer(aiAnswer);
  const normalizedVerify = normalizeAnswer(verificationAnswer);

  // Direct string match
  if (normalizedAI === normalizedVerify) {
    return { matched: true, method: 'exact' };
  }

  // Numeric comparison with tolerance
  const numAI = parseFloat(normalizedAI);
  const numVerify = parseFloat(normalizedVerify);

  if (!isNaN(numAI) && !isNaN(numVerify)) {
    if (Math.abs(numAI - numVerify) < tolerance) {
      return { matched: true, method: 'numeric' };
    }
  }

  // Fraction equivalence
  const fracAI = parseFraction(aiAnswer);
  const fracVerify = parseFraction(verificationAnswer);

  if (fracAI && fracVerify) {
    if (fracAI.numerator * fracVerify.denominator ===
        fracVerify.numerator * fracAI.denominator) {
      return { matched: true, method: 'fraction' };
    }
  }

  return { matched: false, aiNormalized: normalizedAI, verifyNormalized: normalizedVerify };
}

function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '')          // Remove thousands separators
    .replace(/^[=:]\s*/, '')    // Remove leading = or :
    .replace(/\.0+$/, '');      // Remove trailing .0
}

function parseFraction(str: string): { numerator: number; denominator: number } | null {
  const match = str.match(/(-?\d+)\s*\/\s*(\d+)/);
  if (match) {
    return { numerator: parseInt(match[1]), denominator: parseInt(match[2]) };
  }
  return null;
}
```

---

### 5. Enhanced Grading Service

**Updated Pipeline:**
```typescript
// src/lib/ai/grading-service.ts (updated)

async gradeSubmission(
  request: GradingRequest,
  options: GradingServiceOptions = {}
): Promise<GradingResult> {
  const startTime = Date.now();

  // Step 1: Mathpix OCR (parallel with prompt prep)
  let mathpixResult: MathpixResult | null = null;
  if (this.isMathpixEnabled()) {
    try {
      mathpixResult = await this.mathpixProvider.extractMath(request.image.data);
    } catch (error) {
      console.warn('Mathpix failed, falling back to vision OCR:', error);
    }
  }

  // Step 2: Build enhanced prompt with extracted math
  const prompt = mathpixResult
    ? buildEnhancedGradingPrompt(mathpixResult)
    : buildGradingPrompt(request.answerKey);

  // Step 3: GPT-4o grading (primary)
  const response = await this.manager.analyzeImage(
    request.image,
    prompt,
    GRADING_SYSTEM_PROMPT,
    'openai' // Force GPT-4o
  );

  // Step 4: Parse response
  const parsed = parseGradingResponse(response.content);
  if (!parsed) {
    return this.createFailedResult(...);
  }

  // Step 5: Classify and verify each question
  const verifiedQuestions = await Promise.all(
    parsed.questions.map(async (q) => {
      const difficulty = classifyDifficulty(q.problemText || '');
      let verificationResult: VerificationResult | null = null;

      if (difficulty === 'complex' && this.isWolframEnabled()) {
        // Wolfram verification for complex math
        verificationResult = await this.verifyWithWolfram(q);
      } else if (difficulty === 'moderate') {
        // Chain-of-thought for moderate
        verificationResult = await this.verifyWithChainOfThought(q);
      }

      return {
        ...q,
        difficultyLevel: difficulty,
        verificationMethod: verificationResult?.method,
        verificationResult: verificationResult,
        needsReview: verificationResult?.conflict || q.readabilityConfidence < 0.7,
      };
    })
  );

  // Step 6: Build final result
  return {
    ...buildResult(verifiedQuestions),
    ocrProvider: mathpixResult ? 'mathpix' : 'vision',
    ocrConfidence: mathpixResult?.confidence,
    processingTimeMs: Date.now() - startTime,
  };
}
```

---

## Data Model

### Updated `graded_results` Table

```sql
ALTER TABLE graded_results
ADD COLUMN ocr_provider TEXT DEFAULT 'vision'
  CHECK (ocr_provider IN ('mathpix', 'vision')),
ADD COLUMN ocr_confidence DECIMAL(3,2),
ADD COLUMN verification_method TEXT
  CHECK (verification_method IN ('wolfram', 'chain_of_thought', 'none')),
ADD COLUMN verification_result JSONB,
ADD COLUMN math_difficulty TEXT
  CHECK (math_difficulty IN ('simple', 'moderate', 'complex'));
```

### Updated `questions_json` Structure

```typescript
interface QuestionResultEnhanced {
  questionNumber: number;
  problemText: string;

  // OCR data
  mathpixLatex?: string;
  ocrConfidence?: number;

  // AI calculation
  aiCalculation: string;
  aiAnswer: string;

  // Student data
  studentAnswer: string | null;
  isCorrect: boolean;

  // Verification
  difficultyLevel: 'simple' | 'moderate' | 'complex';
  wolframVerified?: boolean;
  wolframAnswer?: string;
  verificationConflict?: boolean;

  // Scoring
  pointsAwarded: number;
  pointsPossible: number;
  confidence: number;
}
```

---

## Security Considerations

### API Key Management
- All API keys stored in environment variables
- Never logged or exposed in responses
- Vercel encrypted environment variables

### Input Validation
- Sanitize math expressions before sending to Wolfram
- Validate image format and size before Mathpix
- Rate limit API calls per user

### Data Privacy
- Student images processed but not stored in third-party APIs
- Mathpix/Wolfram receive only the math content, not student names
- Results stored only in Supabase (RLS protected)

---

## Performance Considerations

### Parallelization
```typescript
// Run Mathpix OCR while preparing other resources
const [mathpixResult, signedUrl] = await Promise.all([
  mathpixProvider.extractMath(image),
  getSignedUrl(storagePath),
]);
```

### Caching
```typescript
// Cache Wolfram results for identical expressions
const cacheKey = `wolfram:${hashExpression(expression)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await wolframProvider.solve(expression);
await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400); // 24h
```

### Timeout Management
```typescript
// Total pipeline timeout: 30 seconds
const PIPELINE_TIMEOUT = 30000;

const result = await Promise.race([
  runGradingPipeline(request),
  timeout(PIPELINE_TIMEOUT).then(() => {
    throw new Error('Pipeline timeout');
  }),
]);
```

---

## Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **SymPy (self-hosted)** | Free, full control | Requires server, complex setup | Rejected - operational overhead |
| **GPT-4 Code Interpreter** | Integrated, accurate | Higher latency, more expensive | Consider for Phase 2 |
| **Google Cloud Vision** | Good OCR | Not specialized for math | Rejected - Mathpix better for math |
| **Claude as primary** | Good reasoning | Vision less mature than GPT-4o | Rejected - GPT-4o better for vision |
| **Fine-tuned model** | Best accuracy | Requires data, training time | Future Phase 3 |

---

## Open Technical Questions

- [ ] Should we cache Mathpix results for re-grading same image?
- [ ] How to handle Wolfram rate limits at scale (batch vs queue)?
- [ ] Should verification failures auto-retry with different method?
- [ ] How to expose difficulty classification to teachers?
