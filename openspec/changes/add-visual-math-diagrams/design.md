# Visual Math Diagrams - Design Document

**Change:** add-visual-math-diagrams
**PRD:** [./prd.md](./prd.md)
**Created:** 2026-01-02

---

## Architecture Overview

The visual math diagrams feature extends the existing Smart Explanations system by:
1. Updating GPT-4o prompts to generate structured diagram JSON alongside text explanations
2. Adding React/SVG components to render 4 diagram types
3. Integrating diagram rendering into the existing SubmissionList explanation display

```
┌──────────────────────────────────────────────────────────────┐
│                    User Clicks "Generate Explanations"        │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│              API: /api/explanations/generate                  │
│                                                               │
│  1. Fetch graded result + methodology setting                 │
│  2. Build prompt with diagram instructions + methodology RAG  │
│  3. Call GPT-4o with JSON mode                                │
│  4. Parse response (steps + diagram data)                     │
│  5. Save to questions_json in graded_results                  │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│              SubmissionList Component                         │
│                                                               │
│  1. User expands "Show Student Explanation"                   │
│  2. Render text steps (existing)                              │
│  3. If diagram exists: render <DiagramRenderer diagram={...}/>│
│  4. DiagramRenderer routes to BarModel/NumberLine/etc.        │
│  5. Component renders SVG                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Diagram Type Definitions

```typescript
// src/lib/ai/diagram-types.ts

export type DiagramType =
  | 'bar-model'
  | 'number-line'
  | 'fraction-visual'
  | 'array-grid';

// Wrapper for all diagram types
export interface DiagramData {
  type: DiagramType;
  data: BarModelData | NumberLineData | FractionVisualData | ArrayGridData;
  textFallback: string; // REQUIRED - always have human-readable description
}

// Bar Model (Singapore Math, Common Core tape diagrams)
export interface BarModelData {
  layout: 'part-whole' | 'comparison';
  total?: number | null;          // Total value (null if unknown)
  parts: BarModelPart[];          // The parts that make up the whole
  unknownIndex?: number;          // Which part is the unknown (0-indexed)
  labels?: {
    total?: string;               // e.g., "Total apples"
    parts?: string[];             // Labels for each part
  };
}

export interface BarModelPart {
  value: number | '?';            // Numeric value or unknown
  label?: string;                 // Optional label
  color?: string;                 // CSS color (default provided)
}

// Number Line
export interface NumberLineData {
  min: number;                    // Left end of line
  max: number;                    // Right end of line
  tickInterval?: number;          // Interval between tick marks (auto-calculated if omitted)
  points: NumberLinePoint[];      // Points to plot on the line
  jumps?: NumberLineJump[];       // Arrows showing operations
}

export interface NumberLinePoint {
  value: number;
  label?: string;                 // Label above/below point
  highlight?: boolean;            // Emphasize this point
  position?: 'above' | 'below';   // Label position
}

export interface NumberLineJump {
  from: number;
  to: number;
  label?: string;                 // e.g., "+5"
  color?: string;
}

// Fraction Visual
export interface FractionVisualData {
  type: 'circle' | 'strip';       // Circle (pie) or strip (bar)
  fractions: FractionItem[];      // One or more fractions to display
  showComparison?: boolean;       // Side-by-side comparison mode
}

export interface FractionItem {
  numerator: number;
  denominator: number;
  shaded?: number;                // Parts to shade (defaults to numerator)
  label?: string;                 // e.g., "Pizza eaten"
  color?: string;
}

// Array Grid (Multiplication)
export interface ArrayGridData {
  rows: number;
  columns: number;
  objectStyle?: 'dot' | 'square'; // Visual style (default: dot)
  highlightRow?: number;          // Highlight specific row (1-indexed)
  highlightColumn?: number;       // Highlight specific column (1-indexed)
  showTotal?: boolean;            // Show "= total" label
  label?: string;                 // e.g., "3 × 4 = 12"
}
```

### Extended Explanation Type

```typescript
// Extension to QuestionDetail.explanation interface

interface ExplanationData {
  gradeLevel: string;
  methodology?: string;           // NEW: methodology used
  steps: string[];
  whatYouDidRight: string | null;
  whatToImprove: string | null;
  encouragement: string | null;
  generatedAt: string;
  diagram?: DiagramData | null;   // NEW: optional diagram
}
```

---

## Component Design

### DiagramRenderer (Router Component)

```tsx
// src/components/diagrams/DiagramRenderer.tsx

interface DiagramRendererProps {
  diagram: DiagramData | null | undefined;
  className?: string;
}

export function DiagramRenderer({ diagram, className }: DiagramRendererProps) {
  // Handle null/undefined - no diagram to show
  if (!diagram) return null;

  // Validate type
  const supportedTypes = ['bar-model', 'number-line', 'fraction-visual', 'array-grid'];

  if (!supportedTypes.includes(diagram.type)) {
    // Unsupported type - show text fallback
    return <DiagramFallback text={diagram.textFallback} />;
  }

  try {
    switch (diagram.type) {
      case 'bar-model':
        return <BarModel data={diagram.data as BarModelData} className={className} />;
      case 'number-line':
        return <NumberLine data={diagram.data as NumberLineData} className={className} />;
      case 'fraction-visual':
        return <FractionVisual data={diagram.data as FractionVisualData} className={className} />;
      case 'array-grid':
        return <ArrayGrid data={diagram.data as ArrayGridData} className={className} />;
      default:
        return <DiagramFallback text={diagram.textFallback} />;
    }
  } catch (error) {
    // Render error - show fallback
    console.error('[DIAGRAM] Render error:', error);
    return <DiagramFallback text={diagram.textFallback} />;
  }
}

function DiagramFallback({ text }: { text: string }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-3">
      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
        Visual Representation:
      </p>
      <p className="text-sm text-blue-700 dark:text-blue-300">{text}</p>
    </div>
  );
}
```

### BarModel Component

```tsx
// src/components/diagrams/BarModel.tsx

const DEFAULT_COLORS = [
  '#60A5FA', // blue-400
  '#34D399', // emerald-400
  '#FBBF24', // amber-400
  '#F87171', // red-400
  '#A78BFA', // violet-400
];

export function BarModel({ data, className }: { data: BarModelData; className?: string }) {
  const { layout, parts, total, unknownIndex, labels } = data;

  // Calculate widths - proportional to values
  const knownParts = parts.filter(p => typeof p.value === 'number');
  const knownTotal = knownParts.reduce((sum, p) => sum + (p.value as number), 0);
  const displayTotal = total ?? knownTotal;

  return (
    <div className={cn("my-4", className)}>
      <svg viewBox="0 0 400 100" className="w-full max-w-md">
        {layout === 'part-whole' ? (
          <PartWholeBar parts={parts} total={displayTotal} unknownIndex={unknownIndex} />
        ) : (
          <ComparisonBars parts={parts} />
        )}
      </svg>
      {labels?.total && (
        <p className="text-center text-sm text-muted-foreground mt-1">
          {labels.total}: {displayTotal}
        </p>
      )}
    </div>
  );
}
```

### SVG Styling Guidelines

All diagram SVGs should:
1. Use `viewBox` for responsiveness (no fixed width/height)
2. Use CSS custom properties for colors (dark mode support)
3. Include `role="img"` and `aria-label` for accessibility
4. Use Tailwind-compatible color values
5. Have consistent stroke widths (2px for lines, 1px for grids)

```tsx
<svg
  viewBox="0 0 400 100"
  className="w-full max-w-md"
  role="img"
  aria-label={ariaDescription}
>
  {/* ... */}
</svg>
```

---

## Prompt Engineering

### Diagram Generation Instructions

Add to `buildExplanationPrompt()`:

```
VISUAL DIAGRAMS:
For questions where a visual would help understanding, include a "diagram" object.

AVAILABLE DIAGRAM TYPES:
1. "bar-model" - For part-whole relationships, word problems, comparison
   Data: { layout, parts: [{value, label?, color?}], total?, unknownIndex? }

2. "number-line" - For addition, subtraction, number placement, jumps
   Data: { min, max, points: [{value, label?, highlight?}], jumps?: [{from, to, label?}] }

3. "fraction-visual" - For fraction problems, equivalence, comparison
   Data: { type: 'circle'|'strip', fractions: [{numerator, denominator, shaded?}] }

4. "array-grid" - For multiplication, grouping, area
   Data: { rows, columns, objectStyle?: 'dot'|'square', showTotal?: boolean }

ALWAYS include "textFallback" - a text description of the visual.

METHODOLOGY-SPECIFIC GUIDANCE:
- Singapore Math: ALWAYS use bar-model for word problems
- Common Core: Use bar-model (tape diagrams) or arrays
- Traditional: Use arrays for multiplication, number-line for integers
- Montessori: Describe manipulatives in textFallback, use fraction-visual
- Saxon: Use number-line for incremental steps
- Waldorf: Use textFallback with rich imagery, fraction-visual for fractions
- Classical: Use number-line for logical progression

ONLY include a diagram when it genuinely helps. Some questions don't need visuals.
```

### Example GPT-4o Response

```json
{
  "explanations": [
    {
      "questionNumber": 1,
      "steps": [
        "Step 1: Let's draw a bar model to represent the problem.",
        "Step 2: Draw one long bar for the total (12 apples).",
        "Step 3: Split the bar: Maria has 5 apples, Juan has the rest.",
        "Step 4: The unknown part is 12 - 5 = 7 apples."
      ],
      "whatYouDidRight": null,
      "whatToImprove": "Remember to identify what's known and unknown before solving.",
      "encouragement": "Keep practicing! You'll get it with more practice.",
      "diagram": {
        "type": "bar-model",
        "data": {
          "layout": "part-whole",
          "total": 12,
          "parts": [
            { "value": 5, "label": "Maria" },
            { "value": "?", "label": "Juan" }
          ],
          "unknownIndex": 1
        },
        "textFallback": "Bar model showing total of 12 apples. One part is 5 (Maria), the other part is unknown (Juan)."
      }
    }
  ]
}
```

---

## Security Considerations

- **Input validation:** All diagram data from GPT-4o must be validated before rendering
- **XSS prevention:** No raw HTML injection - SVG is rendered via React components
- **No user input in diagrams:** Diagram data comes from AI, not user input

---

## Performance Considerations

- **SVG is lightweight:** No performance concerns with SVG rendering
- **Lazy rendering:** Diagrams only render when explanation is expanded
- **No external requests:** All rendering is client-side with no API calls
- **Bundle size:** Estimate +15-20KB for diagram components (acceptable)

---

## Alternatives Considered

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| DALL-E image generation | Rich visuals | $0.04-0.08/image, low math accuracy | Rejected |
| ASCII art in text | Simple, no components | Poor mobile display, limited visuals | Rejected |
| Canvas rendering | Faster for complex graphics | Poor accessibility, harder to style | Rejected |
| **SVG + React components** | Accessible, scalable, styleable, performant | More code to write | **Chosen** |

---

## Open Technical Questions

- [x] SVG vs Canvas? → **SVG chosen** for accessibility and styling
- [ ] Should diagrams animate? → Recommend no for MVP, consider P2
- [ ] Export diagrams as images? → Out of scope for MVP
