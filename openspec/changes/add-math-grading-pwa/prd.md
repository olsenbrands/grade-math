# PRD: Math Homework AI Grading App (PWA)

**Status:** PROPOSED
**Version:** 1.1 — Mobile + Desktop + PDF Support
**Author:** Jordan Olsen
**Created:** 2025-12-12
**Target Codebase:** Grade-Math (greenfield)

---

## 1. Executive Summary

This product is a mobile-first but desktop-capable Progressive Web App (PWA) that allows teachers to grade math homework using AI-powered vision recognition. Teachers can capture photos via mobile devices or upload existing PDFs and images from desktop. The system automatically parses handwritten math assignments, groups pages by student, grades answers, and provides scores with optional student-friendly feedback.

The app is optimized for batch workflows, asynchronous background processing, and token-based usage limits to control AI costs. All data is unified through CRUD operations so mobile and desktop experiences remain fully synchronized.

### Core Stack
- **Frontend:** Next.js PWA on Vercel (mobile + desktop responsive)
- **Backend:** Vercel Serverless & Background Functions
- **Database/Auth/Storage:** Supabase (Postgres + Auth + Storage)
- **AI Models:** Llama 3.2 Vision (Groq), GPT-4o Vision, or Claude Vision

---

## 2. Goals

### Primary Goals
- Reduce teacher grading time by 90%
- Support fast batch grading for entire classes
- Accurately read messy student handwriting
- Group homework pages by student automatically
- Grade math assignments reliably with optional answer keys
- Process images and PDFs asynchronously
- Enforce token-based usage limits

### Secondary Goals
- Improve handwriting recognition over time
- Generate clear, student-friendly feedback summaries
- Provide long-term project storage and retrieval

---

## 3. Non-Goals (V1)

- No student login accounts
- No teacher score overrides or partial credit editing
- No LMS integrations (Google Classroom, Canvas, etc.)
- No parent portals
- No cross-teacher shared projects

---

## 4. User Types

### Teacher (Primary User)
- Create account (email/password or Google OAuth)
- Create projects
- Upload images or PDFs
- Scan homework via mobile camera
- Review grades and feedback
- Manage tokens
- Archive projects

### System Admin
- Manage usage limits
- Adjust token allocations
- Monitor system health

---

## 5. Core Concepts

### Project
- A single homework assignment (e.g., "Math Homework – Jan 15")
- Contains many student submissions
- May include an optional answer key

### Student Group
- Pages grouped by detected student name
- Grouping persists within a project
- AI learns handwriting associations over time

### Submission
- A single page (image or PDF-derived page)
- Processed independently
- Assigned to a student group

---

## 6. Authentication & Onboarding

- Teachers can sign up via email/password or Google OAuth
- On first login, teacher completes profile:
  - Name
  - School (optional)
  - Grade level (optional)
- PWA install prompt shown on supported devices

---

## 7. Project Creation

### Fields
- Project name
- Date (default = today)
- Optional answer key (highly recommended)
- Optional notes

### Without Answer Key
- System attempts inferred grading
- Results marked lower confidence

---

## 8. Answer Key (Optional, Recommended)

Teachers may:
- Upload a photo of an answer key
- Upload a PDF of an answer key
- Manually enter correct answers

**System messaging:**
> "Providing an answer key significantly increases grading accuracy."

Answer keys are stored per project and reused across submissions.

---

## 9. Input Methods (Mobile + Desktop)

### Supported File Types
- PDF (single or multi-page)
- JPG / JPEG
- PNG
- HEIC

All inputs are normalized into page-level image submissions.

---

## 10. Mobile Scanning Workflows

### Standard Scan Mode
- Camera opens with visual alignment guides
- Teacher captures image
- Image uploaded immediately
- Processing runs in background

### Batch Mode
- Hands-free scanning
- Edge detection auto-snaps pages
- 1–2 seconds per page
- Teacher slides pages continuously
- No blocking between captures

### Orientation Control
- Auto-rotation attempted
- Manual 90° rotation available before submission

---

## 11. Desktop File Upload Workflows

Desktop supports drag-and-drop and multi-select uploads.

### Flow
1. Teacher selects project
2. Clicks "Upload Files"
3. Drops PDFs/images or selects via file picker
4. Files uploaded to Supabase Storage

### PDF Handling
- Backend converts PDF → page images
- Each page becomes a separate submission
- Page order preserved
- Student grouping attempted per page

### Desktop UI Requirements
- Drag-and-drop upload zone
- Progress indicators
- Thumbnail previews
- Ability to manually assign pages to students

---

## 12. Student Name Detection & Grouping

- AI attempts to read handwritten student name from page corner
- If confident:
  - Auto-group page under detected student
- If ambiguous or unreadable:
  - Present dropdown of known student names
  - Option to add new student
- Teacher selection trains future handwriting association

Grouping memory persists within the project.

---

## 13. Background Processing Pipeline

1. Submission created
2. Token balance checked and deducted
3. Job added to processing queue
4. Background function:
   - Enhances image
   - Performs OCR
   - Segments math problems
   - Extracts answers
   - Compares to answer key
   - Calculates score
   - Generates confidence scores
   - Optionally generates feedback
5. Results written to database
6. Submission status updated

---

## 14. Processing States

### Per Submission
- Processing
- Completed
- Needs Review (low confidence)

### Per Project
- X of Y submissions completed
- Filters by status

---

## 15. Results & Feedback

### Per Student
- Overall score
- Problems correct/incorrect
- Confidence indicators
- Optional student-friendly feedback summary

### Feedback Summary
- Plain language explanations
- Screenshot/print-friendly
- Designed for sharing with parents or students

---

## 16. Token System

### Purpose
- Control AI costs
- Enable monetization

### Rules
- Teachers receive X tokens per month
- Token cost per page:
  - Low Cost Mode: minimal
  - Full Feedback Mode: higher
  - Auto-grade Entire Class: bulk discounted cost

### UI
- Token balance visible
- Warnings when low
- Scanning blocked at zero tokens

### Backend
- Tokens deducted on job creation
- Refunded on processing failure

---

## 17. Auto-Grade Entire Class (Premium)

- Teacher scans or uploads entire class set
- AI groups, grades, and summarizes
- Teacher receives notification when complete

---

## 18. Archiving & History

- Projects can be archived
- Archived projects hidden by default
- Fully searchable and restorable

---

## 19. Data Model (High Level)

| Table | Purpose |
|-------|---------|
| `users` | Teacher accounts and profiles |
| `projects` | Homework assignments |
| `student_roster` | Known students per teacher |
| `project_answer_keys` | Answer keys per project |
| `submissions` | Individual pages/images |
| `graded_results` | AI grading output |
| `processing_queue` | Background job queue |
| `token_ledger` | Token transactions |

---

## 20. Security & Compliance

- Supabase Row Level Security enforced
- Signed URLs for file access
- All AI calls proxied server-side
- Teacher-only access to submissions
- Data deletion on request (FERPA-aware)

---

## 21. Performance Requirements

- Batch capture: 1–2 seconds per page
- Async processing only (no blocking UI)
- Support 30–60 page class sets
- Graceful handling of large PDFs

---

## 22. Roadmap (Post-V1)

### V2
- Teacher score overrides
- Partial credit
- Student self-check mode
- CSV/PDF exports

### V3
- LMS integrations
- School admin dashboards
- Advanced handwriting models
- Offline capture + sync

---

## 23. Success Metrics

| Metric | Target |
|--------|--------|
| Grading time reduction | 90% |
| OCR accuracy (with answer key) | >90% |
| Processing failure rate | <2% |
| Teacher reuse rate | High (repeat projects) |

---

## Change History

| Date | Author | Change |
|------|--------|--------|
| 2025-12-12 | Jordan Olsen | Initial PRD created |
