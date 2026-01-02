# Change: Upgrade Math Grading Accuracy

**Status:** PROPOSED
**PRD:** [./prd.md](./prd.md)
**Created:** 2026-01-02

---

## Summary

See [PRD](./prd.md) for full product requirements.

**TL;DR:** Improve math grading accuracy by upgrading to GPT-4o as primary provider, integrating Mathpix for specialized math OCR, adding Wolfram Alpha for calculation verification, and implementing chain-of-thought double-checking.

---

## Technical Impact

### New Files

| File | Purpose |
|------|---------|
| `src/lib/ai/providers/mathpix.ts` | Mathpix API integration for math OCR |
| `src/lib/ai/providers/wolfram.ts` | Wolfram Alpha API for computation verification |
| `src/lib/ai/math-classifier.ts` | Classifies math difficulty (simple/moderate/complex) |
| `src/lib/ai/verification-service.ts` | Orchestrates multi-step verification pipeline |
| `src/lib/ai/prompts-verification.ts` | Chain-of-thought verification prompts |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/ai/provider-manager.ts` | Configurable fallback order, GPT-4o default |
| `src/lib/ai/grading-service.ts` | Integrate Mathpix preprocessing, Wolfram verification |
| `src/lib/ai/prompts.ts` | Enhanced prompts with verification instructions |
| `src/lib/ai/types.ts` | New types for Mathpix/Wolfram responses |
| `.env.local.example` | Add MATHPIX_*, WOLFRAM_*, AI provider keys |

### New Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `mathpix-markdown-it` | (Optional) Render Mathpix LaTeX | ^1.3.0 |

*Note: Mathpix and Wolfram use REST APIs, no SDK needed.*

---

## Affected Systems

### Database Changes

**New columns in `graded_results`:**

```sql
ALTER TABLE graded_results ADD COLUMN IF NOT EXISTS
  ocr_provider TEXT DEFAULT 'vision', -- 'mathpix' | 'vision'
  ocr_confidence DECIMAL(3,2),
  verification_method TEXT, -- 'wolfram' | 'chain_of_thought' | 'none'
  verification_result JSONB, -- {matched: boolean, wolfram_answer: string, ...}
  math_difficulty TEXT; -- 'simple' | 'moderate' | 'complex'
```

**New columns in `questions_json` (JSONB):**

```json
{
  "mathpixLatex": "\\frac{3}{4} + \\frac{1}{2}",
  "wolframVerified": true,
  "wolframAnswer": "1.25",
  "difficultyLevel": "moderate"
}
```

### Specs Affected

- `grading-pipeline/spec.md` - Update with new verification steps
- May need new spec: `math-verification/spec.md`

### Environment Variables

```bash
# AI Providers (updated order)
OPENAI_API_KEY=sk-...        # Primary
ANTHROPIC_API_KEY=sk-ant-... # Secondary
GROQ_API_KEY=gsk_...         # Tertiary (cost fallback)

# Mathpix OCR
MATHPIX_APP_ID=your-app-id
MATHPIX_APP_KEY=your-app-key

# Wolfram Alpha
WOLFRAM_APP_ID=your-app-id

# Feature flags
ENABLE_MATHPIX=true
ENABLE_WOLFRAM_VERIFICATION=true
AI_PROVIDER_PRIMARY=openai
```

---

## Architecture Overview

### Current Pipeline

```
Image → Groq Vision (OCR + Solve + Grade) → Result
```

### New Pipeline

```
Image
  │
  ├─[Mathpix OCR]─→ Structured Math (LaTeX)
  │                      │
  │                      ↓
  │              [Math Classifier]
  │                      │
  │      ┌───────────────┼───────────────┐
  │      ↓               ↓               ↓
  │   Simple         Moderate        Complex
  │      │               │               │
  │      ↓               ↓               ↓
  └─→ GPT-4o ←──────────────────────────┘
      (Solve)
         │
         ├── Simple: Return directly
         │
         ├── Moderate: Chain-of-thought verify
         │
         └── Complex: Wolfram Alpha verify
                           │
                           ↓
                    [Compare Results]
                           │
                           ↓
                    Flag if mismatch
                           │
                           ↓
                       Result
```

---

## Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Mathpix API downtime | Low | Medium | Fallback to GPT-4o vision OCR |
| Wolfram rate limits exceeded | Medium | Medium | Queue complex problems, cache results |
| Increased latency (multiple APIs) | High | Medium | Parallel calls where possible, timeout limits |
| Higher costs than expected | Medium | Medium | Cost caps, usage monitoring, alerts |
| LaTeX parsing errors | Medium | Low | Robust error handling, fallback to raw text |
| Equivalent answer comparison fails | Medium | High | Normalize answers before comparison |

---

## Performance Considerations

### Latency Budget (30 seconds total)

| Step | Target | Parallel |
|------|--------|----------|
| Mathpix OCR | 3-5s | Yes (with upload) |
| Math Classification | <1s | After OCR |
| GPT-4o Vision Analysis | 10-15s | No |
| Wolfram Verification | 2-5s | After GPT-4o |
| Result Processing | <1s | No |
| **Total (worst case)** | **~25s** | - |

### Optimization Strategies

1. **Parallel Mathpix + Image upload** - Start OCR while preparing prompt
2. **Skip Wolfram for simple math** - Classification reduces API calls
3. **Cache Wolfram results** - Same problem type = same answer
4. **Batch verification** - Send multiple problems to Wolfram in one call

---

## Success Criteria

From PRD - technical verification:

- [ ] GPT-4o responds successfully as primary provider
- [ ] Mathpix extracts LaTeX from handwritten math images
- [ ] Wolfram Alpha returns correct solutions for algebra problems
- [ ] Pipeline completes within 30 seconds
- [ ] Fallbacks work when any service is unavailable
- [ ] Cost tracking accurate for all new services
- [ ] `needsReview` flag properly set for low confidence/mismatches

---

## Rollout Plan

### Phase 1: Provider Upgrade (1-2 days)
- Change default provider to GPT-4o
- Make fallback order configurable
- Set temperature to 0.0
- Deploy and monitor accuracy

### Phase 2: Mathpix Integration (2-3 days)
- Implement Mathpix provider
- Add preprocessing step to grading pipeline
- Fallback logic if Mathpix unavailable
- Deploy behind feature flag

### Phase 3: Wolfram Integration (2-3 days)
- Implement Wolfram provider
- Add verification step for complex math
- Comparison logic for equivalent answers
- Deploy behind feature flag

### Phase 4: Chain-of-Thought (1-2 days)
- Enhanced prompts for self-verification
- Moderate math verification without Wolfram
- Conflict detection and flagging

### Phase 5: Full Pipeline (1-2 days)
- Math difficulty classifier
- Intelligent routing
- End-to-end testing
- Remove feature flags, enable by default
