# PRD: Visual Math Diagrams for Smart Explanations

**Status:** PROPOSED
**Author:** Claude
**Created:** 2026-01-02
**Target Codebase:** Grade-Math (iGradeMath)

---

## Problem Statement

### What problem are we solving?
When Smart Explanations are generated for incorrect answers, they currently provide text-only instructions like "Step 1: Let's draw a bar model to represent the problem" without actually showing the visual diagram. Students and teachers see descriptive text but no actual visual representation, reducing the educational impact of the explanations.

### Who has this problem?
Teachers using iGradeMath with the Smart Explanations add-on who want to provide students with visual, methodology-appropriate math feedback.

### Why does it matter now?
- Teaching methodologies (Singapore Math, Montessori, Common Core) heavily rely on visual representations
- The methodology feature was just added, and Singapore Math specifically references bar models in every explanation
- Visual learners (estimated 65% of students) aren't being served by text-only explanations
- Competitors offer visual math explanations; this is table stakes for premium features

---

## User Personas

### Primary Persona: Teacher (Smart Explanations Subscriber)
- **Who:** K-12 math teacher using iGradeMath to grade homework
- **Needs:** Visual diagrams that match their selected teaching methodology to share with students
- **Current workaround:** Manually draw diagrams or skip the visual component entirely

### Secondary Persona: Student
- **Who:** K-12 student receiving graded work with explanations
- **Needs:** Clear, visual representation of how to solve problems they got wrong
- **Current workaround:** Relies on text-only instructions, often misunderstanding spatial/visual concepts

---

## User Stories

### Must Have (P0)
- As a teacher, I want explanations to include visual bar models when using Singapore Math methodology so students can see part-whole relationships
- As a teacher, I want number line diagrams for addition/subtraction problems so students understand operations as movements
- As a teacher, I want fraction visuals (circles/strips) for fraction problems so students see the relationship between parts and wholes
- As a teacher, I want array/grid diagrams for multiplication problems so students understand grouping

### Should Have (P1)
- As a teacher, I want diagrams to automatically match my selected teaching methodology
- As a teacher, I want a text fallback if diagram generation fails so explanations still display properly

### Nice to Have (P2)
- As a teacher, I want to export/print diagrams with explanations for offline student use
- As a teacher, I want base ten blocks, area models, and fact triangles in future updates

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Diagram Render Success Rate | 95%+ | Logs: successful renders vs text fallbacks |
| Explanation Generation Time | < 5 seconds | API response time (current: ~3s, budget +2s for diagrams) |
| Teacher Adoption | 80%+ of Smart Explanations users use methodology settings | Analytics: methodology != 'standard' |
| Student Comprehension | Qualitative feedback | User surveys, support tickets |

---

## Scope

### In Scope (MVP)
- **4 Diagram Types:**
  1. Bar Model (part-whole, comparison) - Singapore Math, Common Core
  2. Number Line (jumps, intervals) - All methodologies
  3. Fraction Visual (circles, strips) - All methodologies
  4. Array Grid (rows × columns) - Traditional, Common Core
- Methodology-aware diagram selection (AI chooses based on teaching methodology)
- Text fallback when diagram type not supported or rendering fails
- React/SVG rendering components
- Integration with existing SubmissionList explanation display

### Out of Scope
- Base ten blocks, area models, ten frames, fact triangles (P2)
- Balance scales, coordinate planes, Venn diagrams (P3)
- Waldorf form drawing, Montessori bead representations (P4)
- Export/print functionality
- Student accounts / student-facing features
- Billing changes (included in existing $5/mo add-on)

### Future Considerations
- P2 diagram types (8 total)
- Interactive diagrams (drag/drop)
- Diagram customization (colors, labels)
- Teacher diagram library/templates

---

## User Flows

### Primary Flow: Generate Explanation with Diagram
1. Teacher clicks "Generate Explanations" on a graded submission
2. System sends questions + methodology to GPT-4o
3. GPT-4o returns JSON with steps AND diagram data for each question
4. Frontend receives response, stores in database
5. Teacher expands "Show Student Explanation" on a question
6. System renders text steps + visual diagram inline
7. Teacher can share/print explanation for student

### Fallback Flow: Diagram Not Available
1. GPT-4o returns diagram type not in supported list, or diagram data is invalid
2. Frontend detects unsupported/invalid diagram
3. Frontend renders text-only explanation with styled fallback message
4. No error shown to user - graceful degradation

---

## Acceptance Criteria

### Bar Model Diagram
- [ ] Renders horizontal bar divided into parts
- [ ] Shows part values and total
- [ ] Highlights unknown value with "?" symbol
- [ ] Supports part-whole and comparison layouts
- [ ] Proportional widths based on values

### Number Line Diagram
- [ ] Renders horizontal line with tick marks
- [ ] Shows labeled points at key values
- [ ] Displays jump arrows for operations
- [ ] Supports positive and negative numbers
- [ ] Configurable range and intervals

### Fraction Visual Diagram
- [ ] Renders circle or strip representation
- [ ] Shows shaded vs unshaded portions
- [ ] Displays numerator/denominator labels
- [ ] Supports multiple fractions for comparison
- [ ] Equal part divisions are visually accurate

### Array Grid Diagram
- [ ] Renders rows × columns of objects
- [ ] Labels row and column counts
- [ ] Shows total count
- [ ] Supports highlighting partial groups
- [ ] Configurable object style (dots, squares)

### Integration
- [ ] Diagram renders inline with existing explanation text
- [ ] Graceful fallback to text-only when diagram unavailable
- [ ] No visual regression in existing explanation display
- [ ] Works on mobile (responsive)
- [ ] Accessible (aria labels, color contrast)

---

## Existing Assets to Leverage

Based on codebase analysis:
- **Services:** `explanation-service.ts` - extend to generate diagram JSON
- **RAG System:** `src/lib/ai/rag/index.ts` - 8 methodologies already defined with visual language
- **UI Component:** `SubmissionList.tsx` lines 852-901 - existing explanation display
- **Types:** `QuestionDetail.explanation` interface - extend with `diagram` field
- **Patterns:** GPT-4o JSON mode already used for explanations

---

## Open Questions

- [x] Which diagram types for MVP? → Bar Model, Number Line, Fraction Visual, Array Grid
- [x] Pricing model? → Include in existing $5/mo Smart Explanations add-on
- [x] Methodology-aware vs universal? → Methodology-aware diagram selection
- [ ] Should diagrams be SVG or Canvas? → Recommend SVG for accessibility/scaling

---

## Appendix

### Research Summary
Deep research conducted on 40+ visual math representations across 8 teaching methodologies:
- Singapore Math: Bar models (part-whole, comparison), number bonds
- Montessori: Golden beads, bead bars, stamp game
- Common Core: Tape diagrams, arrays, area models, number bonds
- Traditional: Standard algorithms, fact families
- Saxon: Incremental practice, fact triangles
- Waldorf: Form drawing, movement-based

Priority ranking based on cross-methodology usage:
- P1 (MVP): Bar models, number lines, fraction visuals, arrays - 70%+ coverage
- P2: Base ten blocks, area models, ten frames, fact triangles
- P3: Balance scales, coordinate planes, tree diagrams, Venn diagrams

### Change History
| Date | Author | Change |
|------|--------|--------|
| 2026-01-02 | Claude | Initial PRD created |
