# Change: Visual Math Diagrams for Smart Explanations

**Status:** PROPOSED
**PRD:** [./prd.md](./prd.md)
**Created:** 2026-01-02

---

## Summary

See [PRD](./prd.md) for full product requirements.

**TL;DR:** Add visual math diagrams (bar models, number lines, fraction visuals, arrays) to Smart Explanations by extending GPT-4o prompts to generate structured diagram data, and building React/SVG components to render them methodology-aware.

---

## Technical Impact

### New Components/Files
- `src/components/diagrams/BarModel.tsx` - Bar model SVG component
- `src/components/diagrams/NumberLine.tsx` - Number line SVG component
- `src/components/diagrams/FractionVisual.tsx` - Fraction circle/strip component
- `src/components/diagrams/ArrayGrid.tsx` - Multiplication array component
- `src/components/diagrams/DiagramRenderer.tsx` - Router component for diagram types
- `src/components/diagrams/index.ts` - Exports
- `src/lib/ai/diagram-types.ts` - TypeScript interfaces for diagram data

### Modified Components/Files
- `src/lib/ai/explanation-service.ts` - Update prompt to request diagram JSON
- `src/lib/ai/rag/index.ts` - Add diagram selection guidance per methodology
- `src/components/submissions/SubmissionList.tsx` - Render diagrams in explanation UI
- `src/types/database.ts` - Extend explanation type with diagram field

### New Dependencies
- None required - SVG rendering is native React, no external charting library needed

---

## Affected Systems

### Specs Affected
- `openspec/changes/add-math-grading-pwa/specs/grading-pipeline/spec.md` - Explanation generation
- None others directly affected

### Code Affected
- `src/lib/ai/` - Explanation service and RAG system
- `src/components/submissions/` - SubmissionList display
- `src/components/diagrams/` - New directory
- `src/types/` - Database types

### Database Changes
- No schema changes required
- Diagram data stored in existing `questions_json` column in `graded_results` table
- JSON structure extended (backward compatible)

---

## Technical Approach

### Diagram Data Structure
```typescript
interface DiagramData {
  type: 'bar-model' | 'number-line' | 'fraction-visual' | 'array-grid';
  data: BarModelData | NumberLineData | FractionVisualData | ArrayGridData;
  textFallback: string; // Always required - human-readable description
}

interface BarModelData {
  layout: 'part-whole' | 'comparison';
  total?: number;
  parts: Array<{ value: number | '?'; label?: string; color?: string }>;
  unknownIndex?: number;
}

interface NumberLineData {
  min: number;
  max: number;
  points: Array<{ value: number; label?: string; highlight?: boolean }>;
  jumps?: Array<{ from: number; to: number; label?: string }>;
}

interface FractionVisualData {
  type: 'circle' | 'strip';
  fractions: Array<{
    numerator: number;
    denominator: number;
    shaded?: number; // defaults to numerator
    label?: string;
  }>;
}

interface ArrayGridData {
  rows: number;
  columns: number;
  objectStyle: 'dot' | 'square';
  highlight?: { row?: number; column?: number };
  label?: string;
}
```

### Prompt Engineering
Update `buildExplanationPrompt()` to request diagram data:
```
For each question, ALSO provide a "diagram" object when a visual would help:
{
  "type": "bar-model" | "number-line" | "fraction-visual" | "array-grid",
  "data": { ... type-specific fields ... },
  "textFallback": "Description if diagram can't render"
}

DIAGRAM SELECTION BY METHODOLOGY:
- Singapore Math: Prefer bar-model for word problems, number bonds for part-whole
- Common Core: Use bar-model (tape diagrams), arrays for multiplication
- Traditional: Use arrays for multiplication, number-line for integers
- Montessori: Describe manipulatives, use fraction-visual for fractions
...
```

### Rendering Strategy
1. `DiagramRenderer` receives diagram data from explanation
2. Validates `type` against supported types
3. Routes to appropriate component (`BarModel`, `NumberLine`, etc.)
4. Component renders SVG with proper styling
5. If type unsupported or data invalid → render `textFallback` in styled box

---

## Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GPT-4o generates invalid diagram JSON | Medium | Low | Validate schema, fallback to text |
| Diagram renders incorrectly (proportions) | Medium | Medium | Extensive testing, clamp values |
| Performance hit from SVG rendering | Low | Low | SVGs are lightweight, no concern |
| Mobile rendering issues | Medium | Medium | Responsive SVG, mobile testing |
| Accessibility gaps | Medium | Medium | Add aria-labels, ensure contrast |

---

## Success Criteria

From PRD - technical verification:
- [ ] All 4 diagram components render correctly with valid data
- [ ] Invalid/unsupported diagram types show text fallback gracefully
- [ ] Diagram data validates against TypeScript interfaces
- [ ] Explanation generation time remains under 5 seconds
- [ ] No TypeScript errors after changes
- [ ] Mobile-responsive rendering
- [ ] WCAG 2.1 AA color contrast compliance
