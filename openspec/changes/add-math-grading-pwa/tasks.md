# Math Homework AI Grading App - Tasks

**Change:** add-math-grading-pwa
**PRD:** [./prd.md](./prd.md)
**Status:** PROPOSED
**Estimated Effort:** 80-120 hours

---

## Phase 1: Project Foundation (12-16 hrs)

### 1.1 Next.js PWA Setup
- [x] Initialize Next.js 14 with App Router
- [x] Configure TypeScript strict mode
- [x] Set up Tailwind CSS
- [x] Install and configure next-pwa
- [x] Create PWA manifest.json
- [x] Set up service worker
- [x] Configure Vercel deployment

### 1.2 Supabase Integration
- [x] Create Supabase project
- [x] Configure environment variables
- [x] Set up Supabase client (browser)
- [x] Set up Supabase server client (SSR)
- [x] Configure Supabase middleware for auth

### 1.3 UI Foundation
- [x] Install shadcn/ui
- [x] Set up base components (Button, Input, Card, etc.)
- [x] Create responsive layout shell
- [x] Implement mobile-first navigation
- [x] Create loading and error states

---

## Phase 2: Authentication & Onboarding (8-12 hrs) ✅

### 2.1 Supabase Auth Setup
- [x] Configure email/password auth
- [ ] Configure Google OAuth provider (pending: needs Google Cloud credentials)
- [x] Set up auth callback route
- [x] Implement auth middleware

### 2.2 Auth UI
- [x] Create login page
- [x] Create signup page
- [x] Implement password reset flow
- [x] Add Google sign-in button

### 2.3 Onboarding Flow
- [x] Create onboarding page
- [x] Build profile form (name, school, grade level)
- [x] Implement profile completion check
- [x] Add PWA install prompt

---

## Phase 3: Database & Core Data Models (10-14 hrs)

### 3.1 Schema Creation
- [x] Create `users` extension table (profiles)
- [x] Create `projects` table
- [x] Create `student_roster` table
- [x] Create `project_answer_keys` table
- [x] Create `submissions` table
- [x] Create `graded_results` table
- [x] Create `processing_queue` table
- [x] Create `token_ledger` table

### 3.2 Row Level Security
- [x] RLS policy: users own their data
- [x] RLS policy: projects belong to teacher
- [x] RLS policy: submissions belong to project owner
- [x] RLS policy: token ledger teacher-only access
- [ ] Test RLS policies thoroughly

### 3.3 Supabase Storage
- [x] Create `submissions` bucket
- [x] Create `answer-keys` bucket
- [x] Configure storage policies
- [ ] Set up signed URL generation

### 3.4 TypeScript Types
- [x] Generate types from Supabase schema
- [ ] Create API request/response types
- [ ] Create component prop types

---

## Phase 4: Project Management (12-16 hrs)

### 4.1 Project CRUD
- [x] Create project service
- [x] Build project list page
- [x] Build create project page
- [x] Build project detail page
- [x] Implement project archiving
- [x] Add project search/filter

### 4.2 Answer Key Management
- [x] Build answer key upload UI
- [x] Implement manual answer entry
- [x] Store answer keys in Supabase Storage
- [x] Display answer key status on project

### 4.3 Student Roster
- [x] Create student roster service
- [x] Build student list component
- [x] Implement add/edit student
- [ ] Link students to project submissions

---

## Phase 5: Submission Workflows (16-20 hrs) ✅

### 5.1 Mobile Camera Capture
- [x] Implement camera hook (useCamera)
- [x] Build camera capture component
- [x] Add alignment guide overlay
- [x] Implement image capture
- [x] Add manual rotation control
- [x] Upload to Supabase Storage

### 5.2 Batch Scan Mode
- [x] Implement edge detection
- [x] Build hands-free capture UI
- [x] Auto-capture on stability
- [x] Queue multiple captures
- [x] Batch upload handling

### 5.3 Desktop File Upload
- [x] Build drag-and-drop zone
- [x] Implement multi-file selection
- [x] Add progress indicators
- [x] Show thumbnail previews
- [x] Handle HEIC conversion

### 5.4 PDF Processing
- [x] Implement PDF to image conversion
- [x] Split multi-page PDFs
- [x] Preserve page order
- [x] Create submission per page
- [x] Handle large PDFs gracefully

### 5.5 Submission Management
- [x] Build submission list view
- [x] Show processing status
- [x] Enable manual student assignment
- [x] Display thumbnails
- [x] Filter by status

---

## Phase 6: AI Grading Pipeline (16-20 hrs) ✅

### 6.1 AI Provider Abstraction
- [x] Create provider interface
- [x] Implement Groq provider (Llama 3.2 Vision)
- [x] Implement OpenAI provider (GPT-4o)
- [x] Implement Anthropic provider (Claude)
- [x] Add fallback logic

### 6.2 Background Processing
- [x] Set up Vercel Background Functions
- [x] Create processing queue handler
- [x] Implement job pickup and locking
- [x] Add retry logic with backoff
- [x] Handle timeouts gracefully

### 6.3 Grading Logic
- [x] Build image enhancement step
- [x] Implement OCR extraction
- [x] Parse math problem segments
- [x] Extract student answers
- [x] Compare to answer key
- [x] Calculate scores
- [x] Generate confidence levels

### 6.4 Feedback Generation
- [x] Create feedback prompt template
- [x] Generate student-friendly explanations
- [x] Format for print/screenshot
- [x] Make feedback optional (token cost)

### 6.5 Results Storage
- [x] Write graded results to database
- [x] Update submission status
- [x] Link results to student groups
- [x] Calculate aggregate scores

---

## Phase 7: Student Grouping (8-10 hrs) ✅

### 7.1 Name Detection
- [x] Create name extraction prompt
- [x] Implement confidence scoring
- [x] Handle multiple name formats
- [x] Store detected names

### 7.2 Auto-Grouping
- [x] Match detected name to roster
- [x] Auto-assign high-confidence matches
- [x] Flag ambiguous matches for review

### 7.3 Manual Assignment
- [x] Build student assignment dropdown
- [x] Enable "Add new student" option
- [x] Save teacher corrections
- [ ] Train grouping model (future)

---

## Phase 8: Token System (6-8 hrs) ✅

### 8.1 Token Ledger
- [x] Create token service
- [x] Implement balance queries
- [x] Record transactions (debit/credit)
- [x] Handle concurrent updates safely

### 8.2 Token UI
- [x] Display balance in header/nav
- [x] Show low balance warnings
- [x] Block operations at zero balance
- [x] Show cost before operations

### 8.3 Token Rules
- [x] Define cost per operation type
- [x] Implement bulk discount logic
- [x] Refund on processing failure
- [x] Admin token grants

---

## Phase 9: Results & Reporting (6-8 hrs) ✅

### 9.1 Results Display
- [x] Build student results card
- [x] Show score breakdown
- [x] Display confidence indicators
- [x] Highlight needs-review items

### 9.2 Project Summary
- [x] Calculate class statistics
- [x] Show completion progress
- [x] List students with scores
- [x] Filter by score/status

### 9.3 Feedback Sharing
- [x] Generate shareable feedback view
- [x] Optimize for printing
- [x] Mobile-friendly display

---

## Phase 10: Polish & Launch (6-10 hrs) ✅

### 10.1 Performance
- [x] Optimize image loading (src/components/ui/image-loader.tsx)
- [x] Implement pagination (src/components/ui/pagination.tsx)
- [x] Add loading skeletons (src/components/ui/skeleton-loaders.tsx)
- [x] Test on slow connections (docs/TESTING_CHECKLIST.md)

### 10.2 Error Handling
- [x] Global error boundary (src/components/error-boundary.tsx)
- [x] Toast notifications (src/lib/toast.ts + Toaster in layout)
- [x] Graceful degradation (src/lib/graceful-degradation.ts)
- [x] Offline awareness (src/components/offline-indicator.tsx)

### 10.3 Testing
- [x] Unit tests for services (97 tests passing - vitest)
- [x] Integration tests for API routes (src/app/api/**/route.test.ts)
- [x] E2E tests for critical flows (e2e/*.spec.ts - Playwright)
- [x] Manual device testing (docs/TESTING_CHECKLIST.md)

### 10.4 Documentation
- [x] Update README (comprehensive project documentation)
- [x] Document environment setup (docs/ENVIRONMENT_SETUP.md)
- [x] API documentation (docs/API.md)
- [x] User guide basics (docs/USER_GUIDE.md)

---

## Summary

| Phase | Tasks | Est. Hours |
|-------|-------|------------|
| 1. Foundation | 16 | 12-16 |
| 2. Auth | 10 | 8-12 |
| 3. Database | 16 | 10-14 |
| 4. Projects | 12 | 12-16 |
| 5. Submissions | 20 | 16-20 |
| 6. AI Pipeline | 18 | 16-20 |
| 7. Grouping | 8 | 8-10 |
| 8. Tokens | 9 | 6-8 |
| 9. Results | 9 | 6-8 |
| 10. Polish | 12 | 6-10 |
| **Total** | **130** | **80-120 hrs** |

---

## Dependencies

- Phase 2 (Auth) blocks Phase 3-10
- Phase 3 (Database) blocks Phase 4-9
- Phase 5 (Submissions) blocks Phase 6 (Grading)
- Phase 6 (Grading) blocks Phase 7 (Grouping)
- Phase 3 (Token table) blocks Phase 8

## Parallelizable Work

- Phase 4 (Projects) and Phase 5 (Submissions) can partially overlap
- Phase 7 (Grouping) and Phase 8 (Tokens) can run in parallel
- Phase 9 (Results) can start once Phase 6 is 50% complete
- UI polish can happen throughout later phases
