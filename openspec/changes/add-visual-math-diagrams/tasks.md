# Visual Math Diagrams - Tasks

**Change:** add-visual-math-diagrams
**PRD:** [./prd.md](./prd.md)
**Status:** IN PROGRESS
**Estimated Effort:** 8-12 hours
**Last Updated:** 2026-01-02

---

## Phase 1: Foundation & Types (2 hours) - COMPLETE

### 1.1 Create Diagram Type Definitions
- [x] Create `src/lib/ai/diagram-types.ts` with all diagram interfaces
- [x] Define `DiagramType` union type
- [x] Define `BarModelData`, `NumberLineData`, `FractionVisualData`, `ArrayGridData`
- [x] Define `DiagramData` wrapper with type discriminator and textFallback
- [x] Export all types

### 1.2 Extend Explanation Types
- [x] Update `QuestionDetail.explanation` interface in `SubmissionList.tsx`
- [x] Add optional `diagram?: DiagramData` field
- [x] Update `GeneratedExplanation` in `explanation-service.ts`

---

## Phase 2: AI Prompt Engineering (2 hours) - COMPLETE

### 2.1 Update Explanation Prompt
- [x] Modify `buildExplanationPrompt()` in `explanation-service.ts`
- [x] Add diagram JSON schema to prompt
- [x] Add methodology-specific diagram selection guidance (via `getDiagramGuidanceForMethodology()`)
- [x] Request `textFallback` for every diagram

### 2.2 Update RAG Methodology Content
- [x] Add diagram preferences to each methodology in `getDiagramGuidanceForMethodology()`
- [x] Singapore: bar-model priority
- [x] Common Core: tape diagrams (bar-model), arrays
- [x] Traditional: arrays, number-line
- [x] Montessori: fraction-visual with manipulative language
- [x] Others: balanced defaults

### 2.3 Update Response Parsing
- [x] Modify `parseExplanationResponse()` to handle diagram data
- [x] Add validation for diagram schema (uses `validateDiagramData()`)
- [x] Default to null diagram if invalid

---

## Phase 3: React Components (4 hours) - COMPLETE

### 3.1 Create DiagramRenderer (Router)
- [x] Create `src/components/diagrams/DiagramRenderer.tsx`
- [x] Accept `DiagramData` prop
- [x] Route to correct component based on `type`
- [x] Render text fallback for unsupported types
- [x] Handle null/undefined diagram gracefully

### 3.2 Create BarModel Component
- [x] Create `src/components/diagrams/BarModel.tsx`
- [x] Implement part-whole layout (horizontal bar split into parts)
- [x] Implement comparison layout (two parallel bars)
- [x] Calculate proportional widths from values
- [x] Render unknown values as "?" with highlight
- [x] Add labels and colors
- [x] SVG with viewBox for responsiveness

### 3.3 Create NumberLine Component
- [x] Create `src/components/diagrams/NumberLine.tsx`
- [x] Render horizontal line with tick marks
- [x] Calculate tick intervals from min/max
- [x] Plot labeled points
- [x] Draw jump arrows between points
- [x] Support negative numbers
- [x] SVG with viewBox for responsiveness

### 3.4 Create FractionVisual Component
- [x] Create `src/components/diagrams/FractionVisual.tsx`
- [x] Implement circle view (pie chart style)
- [x] Implement strip view (horizontal bar divided)
- [x] Shade correct number of parts
- [x] Support multiple fractions for comparison
- [x] Label numerator/denominator
- [x] SVG with viewBox for responsiveness

### 3.5 Create ArrayGrid Component
- [x] Create `src/components/diagrams/ArrayGrid.tsx`
- [x] Render rows x columns grid of objects
- [x] Support dot and square object styles
- [x] Highlight specific row/column if specified
- [x] Label with total count
- [x] SVG with viewBox for responsiveness

### 3.6 Create Index Export
- [x] Create `src/components/diagrams/index.ts`
- [x] Export all diagram components
- [x] Export `DiagramRenderer` as default

---

## Phase 4: Integration (1.5 hours) - COMPLETE

### 4.1 Update SubmissionList
- [x] Import `DiagramRenderer`
- [x] Add diagram rendering in explanation expansion (lines 874-880)
- [x] Position diagram after text steps, before feedback
- [x] Ensure no visual regression

### 4.2 Styling
- [x] Add consistent color palette for diagrams (DIAGRAM_COLORS in diagram-types.ts)
- [x] Ensure dark mode compatibility (class-based dark: variants)
- [x] Match existing app styling (Tailwind)
- [x] Add subtle border/background to diagram container

---

## Phase 5: Testing & Validation (2 hours) - COMPLETE (Build/Lint)

### 5.1 Unit Testing
- [ ] Test BarModel with various data configurations
- [ ] Test NumberLine with positive/negative ranges
- [ ] Test FractionVisual with different denominators
- [ ] Test ArrayGrid with various sizes
- [ ] Test DiagramRenderer fallback behavior

### 5.2 Integration Testing
- [ ] Test explanation generation produces valid diagram JSON
- [ ] Test Singapore methodology generates bar-model diagrams
- [ ] Test graceful fallback when diagram is null/invalid
- [ ] Test end-to-end from "Generate Explanations" to rendered diagram

### 5.3 Manual Verification
- [ ] Test on mobile viewport (responsive)
- [ ] Verify color contrast (WCAG AA)
- [ ] Check aria-labels for accessibility
- [ ] Test with different teaching methodologies
- [ ] Verify database storage/retrieval

### 5.4 Build Verification
- [x] Run `npm run build` - no TypeScript errors
- [x] Run `npm run lint` - no linting errors in diagram code
- [ ] Test production build locally

---

## Summary

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| 1. Foundation | 2 | 2 hrs |
| 2. AI Prompt | 3 | 2 hrs |
| 3. Components | 6 | 4 hrs |
| 4. Integration | 2 | 1.5 hrs |
| 5. Testing | 4 | 2 hrs |
| **Total** | **17** | **11.5 hrs** |

---

## Dependencies

- Phase 2 depends on Phase 1 (types must exist before prompt uses them)
- Phase 3 depends on Phase 1 (components use type definitions)
- Phase 4 depends on Phase 2 + Phase 3 (integration needs AI + components)
- Phase 5 depends on Phase 4 (testing requires full integration)

## Parallelizable Work

- Phase 3 components (3.2-3.5) can be built in parallel
- Unit tests can be written alongside component development
