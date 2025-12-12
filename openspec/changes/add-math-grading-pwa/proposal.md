# Change: Math Homework AI Grading App (PWA)

**Status:** PROPOSED
**PRD:** [./prd.md](./prd.md)
**Created:** 2025-12-12

---

## Summary

See [PRD](./prd.md) for full product requirements.

**TL;DR:** Build a Next.js PWA that lets teachers photograph/upload math homework, uses AI vision to grade submissions, groups pages by student, and manages usage via a token system.

---

## Technical Impact

### New Project Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── onboarding/page.tsx
│   ├── (dashboard)/
│   │   ├── projects/
│   │   │   ├── page.tsx              # Project list
│   │   │   ├── [id]/page.tsx         # Project detail
│   │   │   └── new/page.tsx          # Create project
│   │   ├── scan/page.tsx             # Mobile camera
│   │   └── settings/page.tsx         # Profile & tokens
│   ├── api/
│   │   ├── submissions/
│   │   ├── grading/
│   │   └── webhooks/
│   ├── layout.tsx
│   └── manifest.json                 # PWA manifest
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── camera/                       # Camera capture components
│   ├── upload/                       # File upload components
│   ├── projects/                     # Project-related components
│   └── grading/                      # Results display components
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── ai/
│   │   ├── providers/
│   │   │   ├── groq.ts
│   │   │   ├── openai.ts
│   │   │   └── anthropic.ts
│   │   ├── grading.ts
│   │   └── ocr.ts
│   └── utils/
│       ├── pdf.ts                    # PDF → images
│       └── image.ts                  # Image processing
├── hooks/
│   ├── useProjects.ts
│   ├── useSubmissions.ts
│   ├── useCamera.ts
│   └── useTokens.ts
├── services/
│   ├── projectService.ts
│   ├── submissionService.ts
│   ├── gradingService.ts
│   └── tokenService.ts
└── types/
    ├── database.ts                   # Supabase generated types
    └── api.ts
```

### New Dependencies
| Package | Purpose |
|---------|---------|
| `next-pwa` | PWA capabilities |
| `@supabase/supabase-js` | Database, auth, storage |
| `@supabase/ssr` | Server-side Supabase |
| `groq-sdk` | Groq AI API |
| `openai` | OpenAI API (fallback) |
| `@anthropic-ai/sdk` | Claude API (fallback) |
| `pdf-lib` or `pdfjs-dist` | PDF processing |
| `sharp` | Image optimization |
| `react-webcam` | Camera capture |
| `react-dropzone` | File uploads |
| `tailwindcss` | Styling |
| `shadcn/ui` | UI components |

---

## Affected Systems

### Database (New - Supabase)

8 tables to create:

1. **users** - Extended from Supabase Auth
2. **projects** - Homework assignments
3. **student_roster** - Known students per teacher
4. **project_answer_keys** - Answer keys
5. **submissions** - Individual pages
6. **graded_results** - AI output
7. **processing_queue** - Job queue
8. **token_ledger** - Token transactions

### External Integrations

| Service | Purpose |
|---------|---------|
| Supabase | Database, Auth, Storage |
| Vercel | Hosting, Serverless Functions, Background Jobs |
| Groq | Primary AI vision (Llama 3.2) |
| OpenAI | Fallback AI (GPT-4o) |
| Anthropic | Fallback AI (Claude) |

### Specs Created
- `authentication/spec.md`
- `projects/spec.md`
- `submissions/spec.md`
- `grading-pipeline/spec.md`
- `token-system/spec.md`
- `student-grouping/spec.md`

---

## Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI accuracy on messy handwriting | Medium | High | Multi-provider fallback, confidence thresholds, teacher review |
| Vercel background function timeouts | Medium | Medium | Chunk large PDFs, use queue-based processing |
| Token accounting race conditions | Low | High | Use database transactions, optimistic locking |
| PWA camera compatibility | Medium | Medium | Feature detection, graceful fallback to file upload |
| PDF processing memory limits | Medium | Medium | Process pages individually, use streaming |
| Cost overruns from AI usage | Medium | High | Token system, rate limiting, monitoring |

---

## Success Criteria

From PRD - technical verification:

- [ ] PWA installable on iOS and Android
- [ ] Camera capture works on mobile Safari and Chrome
- [ ] File uploads work on desktop browsers
- [ ] PDF pages correctly split into submissions
- [ ] AI grading returns results within 30 seconds per page
- [ ] Token balance accurately tracked
- [ ] Background processing completes without UI blocking
- [ ] Supabase RLS prevents cross-teacher data access
- [ ] 90%+ OCR accuracy on clean handwriting with answer key
