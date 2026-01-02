# PRD: Upgrade Math Grading Accuracy

**Status:** PROPOSED
**Author:** Claude (AI Assistant)
**Created:** 2026-01-02
**Target Codebase:** Grade-Math (Next.js PWA)

---

## Problem Statement

### What problem are we solving?

The current AI grading system uses Groq's Llama 3.2 Vision Preview as the primary provider, which struggles with:
1. **Complex math calculations** - Algebra, fractions, multi-step problems
2. **Handwriting recognition** - Generic OCR not optimized for math notation
3. **Single-pass verification** - No double-checking of AI calculations

Teachers are experiencing inaccurate grades on harder math problems, requiring manual review and reducing trust in the system.

### Who has this problem?

**Teachers** who grade math homework for grades K-12, especially:
- Middle school math (fractions, decimals, pre-algebra)
- High school algebra and geometry
- Any classroom with students who have messy handwriting

### Why does it matter now?

- Current accuracy is insufficient for teacher confidence
- Groq's "preview" model is not production-ready for math
- Competitors using GPT-4o and specialized OCR have higher accuracy
- User retention depends on grading accuracy

---

## User Personas

### Primary Persona: Math Teacher
- **Who:** K-12 math teacher grading 20-100+ papers daily
- **Needs:** Accurate grading of complex math problems with messy handwriting
- **Current workaround:** Manually reviews all flagged papers; doesn't trust AI on algebra/fractions

### Secondary Persona: Substitute/Aide
- **Who:** Non-math-specialist helping with grading
- **Needs:** High-confidence grades they can trust without math expertise
- **Current workaround:** Flags everything for teacher review

---

## User Stories

### Must Have (P0)

- As a teacher, I want accurate grading on algebra problems so that I don't have to manually verify every paper
- As a teacher, I want the AI to correctly read messy handwriting so that student answers aren't marked wrong due to OCR errors
- As a teacher, I want the AI to verify its own calculations so that computational errors don't cause incorrect grades

### Should Have (P1)

- As a teacher, I want to see when the AI is uncertain so that I can prioritize which papers to manually review
- As a teacher, I want different accuracy modes (fast vs. accurate) so that I can balance speed and cost

### Nice to Have (P2)

- As a teacher, I want the system to learn from my corrections so that accuracy improves over time
- As a teacher, I want to see the AI's step-by-step work so that I can explain mistakes to students

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Grading accuracy (simple arithmetic) | ~90% | 98%+ | Manual audit of 100 random papers |
| Grading accuracy (algebra/fractions) | ~70% | 95%+ | Manual audit of 50 algebra papers |
| Handwriting OCR accuracy | ~80% | 95%+ | Compare extracted text to ground truth |
| Papers needing manual review | ~30% | <10% | Track `needsReview` flag rate |
| Teacher trust (NPS) | Unknown | 8+ | In-app survey |

---

## Scope

### In Scope

1. **Provider Upgrade** - Make GPT-4o or Claude primary for grading
2. **Mathpix Integration** - Specialized math handwriting OCR
3. **Wolfram Alpha Integration** - Computational verification for complex math
4. **Chain-of-Thought Verification** - AI double-checks its own work
5. **Confidence-Based Routing** - Use premium services only when needed
6. **Math Difficulty Classification** - Route problems to appropriate pipeline

### Out of Scope

- Fine-tuning custom models (Phase 3 / future work)
- Real-time teacher feedback learning loop
- Support for non-math subjects
- Handwriting style training per student

### Future Considerations

- Collect grading data for fine-tuning
- Per-student handwriting models
- Support for showing work / partial credit analysis
- Geometry diagram recognition

---

## User Flows

### Primary Flow: Enhanced Grading Pipeline

```
1. Teacher uploads homework image
2. System sends to Mathpix for math-specific OCR
3. Mathpix returns structured LaTeX/text for problems + answers
4. System classifies math difficulty (simple vs. complex)
5. For simple math: GPT-4o calculates and grades
6. For complex math: GPT-4o calculates → Wolfram Alpha verifies
7. If AI calculation ≠ Wolfram result: flag for review
8. Return graded results with confidence scores
9. Teacher reviews only low-confidence items
```

### Alternative Flow: Fallback Pipeline

```
1. If Mathpix fails/unavailable → use GPT-4o vision OCR
2. If Wolfram fails/unavailable → use chain-of-thought verification
3. If GPT-4o fails → fall back to Claude → Groq
4. All failures → mark for manual review with explanation
```

---

## Acceptance Criteria

### Provider Upgrade
- [ ] GPT-4o is the default primary provider for grading
- [ ] Provider preference can be configured via environment variable
- [ ] Temperature is set to 0.0 for deterministic math output
- [ ] Fallback order is configurable (not hardcoded)

### Mathpix Integration
- [ ] Mathpix API integrated as OCR preprocessing step
- [ ] Extracted math is converted to structured format (LaTeX or text)
- [ ] Confidence score from Mathpix influences `needsReview` flag
- [ ] Fallback to vision model OCR if Mathpix unavailable
- [ ] MATHPIX_APP_ID and MATHPIX_APP_KEY environment variables added

### Wolfram Alpha Integration
- [ ] Wolfram Alpha API integrated for calculation verification
- [ ] Used for algebra, fractions, equations, and multi-step problems
- [ ] Comparison logic handles equivalent forms (1/2 = 0.5)
- [ ] Discrepancies between AI and Wolfram flagged for review
- [ ] WOLFRAM_APP_ID environment variable added

### Chain-of-Thought Verification
- [ ] AI performs second-pass verification on its calculations
- [ ] Verification uses different solving approach when possible
- [ ] Conflicts between passes flagged for review

### Math Difficulty Classification
- [ ] System classifies problems as simple, moderate, or complex
- [ ] Simple: basic arithmetic (+, -, ×, ÷)
- [ ] Moderate: fractions, decimals, percentages
- [ ] Complex: algebra, equations, multi-step, word problems
- [ ] Classification informs which verification methods to use

### Confidence and Routing
- [ ] Overall confidence score calculated from multiple signals
- [ ] Low confidence (<0.8) triggers additional verification
- [ ] Very low confidence (<0.6) automatically flags for review
- [ ] Cost optimization: premium services only when needed

---

## Existing Assets to Leverage

Based on codebase analysis:

**Components:**
- `AIProviderManager` - Already supports multiple providers with fallback
- `GradingService` - Orchestration layer ready for enhancement
- Existing blind grading prompts - Can be enhanced with verification

**Services:**
- Provider abstraction (`providers/groq.ts`, `openai.ts`, `anthropic.ts`)
- Image processing utilities (`utils/image-processing.ts`)
- Processing queue for background jobs

**Patterns:**
- Fallback order pattern in `provider-manager.ts`
- Token usage tracking
- Confidence scoring in grading response

---

## Technical Constraints

1. **Vercel Function Limits** - 60 second timeout; pipeline must complete in time
2. **API Costs** - Budget ~$0.02-0.05 per paper with full pipeline
3. **Rate Limits** - Mathpix: 100/min, Wolfram: 2000/day free tier
4. **Latency** - Target <30 seconds per paper with full pipeline

---

## Open Questions

- [ ] Should Mathpix be mandatory or optional (user configurable)?
- [ ] What's the cost ceiling per paper before warning the user?
- [ ] Should we expose "accuracy mode" toggle to teachers?
- [ ] How do we handle Wolfram API rate limits at scale?

---

## Appendix

### Cost Analysis (Per Paper)

| Service | Cost | When Used |
|---------|------|-----------|
| Mathpix OCR | $0.004-0.01 | Always (if enabled) |
| GPT-4o Vision | $0.01-0.02 | Always (primary) |
| Wolfram Alpha | $0.01-0.05 | Complex math only |
| **Total (simple)** | **~$0.02** | Basic arithmetic |
| **Total (complex)** | **~$0.05** | Algebra with verification |

### API References

- Mathpix: https://docs.mathpix.com/
- Wolfram Alpha: https://products.wolframalpha.com/api/
- OpenAI Vision: https://platform.openai.com/docs/guides/vision

### Change History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-02 | Claude | Initial PRD created |
