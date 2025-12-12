# Math Homework AI Grading App - Design Document

**Change:** add-math-grading-pwa
**PRD:** [./prd.md](./prd.md)
**Created:** 2025-12-12

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (PWA)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Mobile    │  │   Desktop   │  │   Offline   │             │
│  │   Camera    │  │   Upload    │  │   Cache     │             │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘             │
│         │                │                                      │
│         └────────┬───────┘                                      │
│                  ▼                                              │
│         ┌───────────────┐                                       │
│         │  Next.js App  │                                       │
│         │  (App Router) │                                       │
│         └───────┬───────┘                                       │
└─────────────────┼───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Vercel Platform                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Serverless │  │  Background │  │    Edge     │             │
│  │  Functions  │  │  Functions  │  │  Middleware │             │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘             │
│         │                │                                      │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  PostgreSQL │  │    Auth     │  │   Storage   │             │
│  │  (+ RLS)    │  │             │  │  (Images)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI Providers                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Groq     │  │   OpenAI    │  │  Anthropic  │             │
│  │ (Primary)   │  │ (Fallback)  │  │ (Fallback)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Complete Schema

```sql
-- Users (extends Supabase Auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  school TEXT,
  grade_level TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (homework assignments)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Roster (known students per teacher)
CREATE TABLE public.student_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handwriting_signature JSONB, -- Future: for handwriting matching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Answer Keys
CREATE TABLE public.project_answer_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'pdf', 'manual')),
  storage_path TEXT, -- For uploaded files
  answers JSONB, -- For manual entry: [{question: 1, answer: "42"}, ...]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions (individual pages)
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.student_roster(id),
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  page_number INTEGER, -- For multi-page PDFs
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'needs_review', 'failed')),
  detected_name TEXT,
  name_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Graded Results
CREATE TABLE public.graded_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  score FLOAT,
  max_score FLOAT,
  problems JSONB, -- [{number: 1, student_answer: "5", correct_answer: "7", is_correct: false}, ...]
  overall_confidence FLOAT,
  feedback TEXT, -- Student-friendly summary
  raw_ocr_text TEXT, -- For debugging
  ai_provider TEXT, -- Which AI processed this
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Processing Queue
CREATE TABLE public.processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT, -- Worker identifier
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token Ledger
CREATE TABLE public.token_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive = credit, Negative = debit
  balance_after INTEGER NOT NULL,
  operation TEXT NOT NULL, -- 'grant', 'submission', 'refund', 'purchase'
  reference_id UUID, -- Submission ID if applicable
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user ON public.projects(user_id);
CREATE INDEX idx_submissions_project ON public.submissions(project_id);
CREATE INDEX idx_submissions_status ON public.submissions(status);
CREATE INDEX idx_queue_status ON public.processing_queue(status, priority DESC);
CREATE INDEX idx_token_ledger_user ON public.token_ledger(user_id);
```

### Row Level Security

```sql
-- Users: own data only
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_own ON public.users
  FOR ALL USING (auth.uid() = id);

-- Projects: own projects only
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_own ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- Student Roster: own roster only
ALTER TABLE public.student_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY roster_own ON public.student_roster
  FOR ALL USING (auth.uid() = user_id);

-- Answer Keys: via project ownership
ALTER TABLE public.project_answer_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY keys_via_project ON public.project_answer_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_answer_keys.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Submissions: via project ownership
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY submissions_via_project ON public.submissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = submissions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Graded Results: via submission ownership
ALTER TABLE public.graded_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY results_via_submission ON public.graded_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      JOIN public.projects ON projects.id = submissions.project_id
      WHERE submissions.id = graded_results.submission_id
      AND projects.user_id = auth.uid()
    )
  );

-- Processing Queue: service role only (no user access)
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
-- No policies = service role only

-- Token Ledger: own transactions only (read), service role for writes
ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_read_own ON public.token_ledger
  FOR SELECT USING (auth.uid() = user_id);
```

---

## API Design

### API Routes

```
/api/
├── auth/
│   ├── callback/route.ts        # OAuth callback
│   └── profile/route.ts         # GET/PATCH profile
│
├── projects/
│   ├── route.ts                 # GET list, POST create
│   └── [id]/
│       ├── route.ts             # GET, PATCH, DELETE
│       ├── answer-key/route.ts  # POST upload answer key
│       └── submissions/route.ts # GET submissions for project
│
├── submissions/
│   ├── route.ts                 # POST create (with file)
│   └── [id]/
│       ├── route.ts             # GET, PATCH (assign student)
│       └── result/route.ts      # GET grading result
│
├── students/
│   └── route.ts                 # GET list, POST create
│
├── tokens/
│   ├── balance/route.ts         # GET current balance
│   └── history/route.ts         # GET transaction history
│
└── webhooks/
    └── processing/route.ts      # Internal: queue processing
```

### Key Endpoints

**Create Submission**
```typescript
// POST /api/submissions
// Content-Type: multipart/form-data

interface CreateSubmissionRequest {
  projectId: string;
  file: File; // Image or PDF
}

interface CreateSubmissionResponse {
  submission: {
    id: string;
    status: 'pending';
    storagePath: string;
  };
  tokensDeducted: number;
  newBalance: number;
}
```

**Get Grading Result**
```typescript
// GET /api/submissions/[id]/result

interface GradingResult {
  submissionId: string;
  status: 'completed' | 'needs_review';
  score: number;
  maxScore: number;
  percentage: number;
  problems: {
    number: number;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    confidence: number;
  }[];
  feedback?: string;
  detectedStudent?: {
    id: string;
    name: string;
    confidence: number;
  };
}
```

---

## AI Provider Abstraction

```typescript
// lib/ai/providers/types.ts

interface AIProvider {
  name: string;
  gradeSubmission(params: GradeParams): Promise<GradeResult>;
  extractStudentName(imageUrl: string): Promise<NameResult>;
}

interface GradeParams {
  imageUrl: string;
  answerKey?: AnswerKey;
  includeFeedback: boolean;
}

interface GradeResult {
  problems: ProblemResult[];
  overallConfidence: number;
  rawOcrText: string;
  feedback?: string;
}

interface NameResult {
  name: string | null;
  confidence: number;
  alternatives: string[];
}
```

```typescript
// lib/ai/grading.ts

import { groqProvider } from './providers/groq';
import { openaiProvider } from './providers/openai';
import { anthropicProvider } from './providers/anthropic';

const providers = [groqProvider, openaiProvider, anthropicProvider];

export async function gradeWithFallback(params: GradeParams): Promise<GradeResult> {
  for (const provider of providers) {
    try {
      const result = await provider.gradeSubmission(params);
      if (result.overallConfidence > 0.5) {
        return { ...result, provider: provider.name };
      }
    } catch (error) {
      console.error(`Provider ${provider.name} failed:`, error);
      continue;
    }
  }
  throw new Error('All AI providers failed');
}
```

---

## Background Processing

### Vercel Background Function

```typescript
// app/api/webhooks/processing/route.ts

import { waitUntil } from '@vercel/functions';

export async function POST(request: Request) {
  const { submissionId } = await request.json();

  // Acknowledge immediately
  waitUntil(processSubmission(submissionId));

  return Response.json({ accepted: true });
}

async function processSubmission(submissionId: string) {
  const supabase = createServiceClient();

  // Lock the job
  const { data: job } = await supabase
    .from('processing_queue')
    .update({
      status: 'processing',
      locked_at: new Date().toISOString(),
      locked_by: process.env.VERCEL_DEPLOYMENT_ID
    })
    .eq('submission_id', submissionId)
    .eq('status', 'queued')
    .select()
    .single();

  if (!job) return; // Already processed or locked

  try {
    // Get submission and answer key
    const submission = await getSubmission(submissionId);
    const answerKey = await getAnswerKey(submission.project_id);

    // Get signed URL for image
    const imageUrl = await getSignedUrl(submission.storage_path);

    // Grade with AI
    const result = await gradeWithFallback({
      imageUrl,
      answerKey,
      includeFeedback: true // Based on user preference
    });

    // Extract student name
    const nameResult = await extractStudentName(imageUrl);

    // Save results
    await saveGradedResult(submissionId, result);
    await updateSubmissionStatus(submissionId, nameResult);

    // Mark job complete
    await supabase
      .from('processing_queue')
      .update({ status: 'completed' })
      .eq('id', job.id);

  } catch (error) {
    // Handle failure, potentially refund tokens
    await handleProcessingFailure(job, error);
  }
}
```

### Queue Management

```typescript
// lib/services/queueService.ts

export async function enqueueSubmission(submissionId: string, priority = 0) {
  const supabase = createServiceClient();

  await supabase
    .from('processing_queue')
    .insert({
      submission_id: submissionId,
      priority,
      status: 'queued'
    });

  // Trigger processing
  await fetch(`${process.env.NEXT_PUBLIC_URL}/api/webhooks/processing`, {
    method: 'POST',
    body: JSON.stringify({ submissionId })
  });
}
```

---

## PWA Configuration

### manifest.json

```json
{
  "name": "Grade Math",
  "short_name": "GradeMath",
  "description": "AI-powered math homework grading",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### next.config.js

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  // Next.js config
});
```

---

## Camera Implementation

```typescript
// hooks/useCamera.ts

import { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';

export function useCamera() {
  const webcamRef = useRef<Webcam>(null);
  const [rotation, setRotation] = useState(0);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return null;

    // Apply rotation if needed
    if (rotation !== 0) {
      return rotateImage(imageSrc, rotation);
    }

    return imageSrc;
  }, [rotation]);

  const rotate90 = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  return {
    webcamRef,
    capture,
    rotate90,
    rotation
  };
}
```

---

## Security Considerations

1. **Authentication**
   - All API routes verify Supabase JWT
   - Service role key only used server-side
   - OAuth state validated

2. **Authorization**
   - RLS enforces data isolation
   - Signed URLs expire after 1 hour
   - No direct Storage access from client

3. **AI Security**
   - All AI calls proxied through API routes
   - API keys never exposed to client
   - Rate limiting per user

4. **Data Protection**
   - Student data never shared between teachers
   - Images stored in teacher-isolated paths
   - FERPA-aware deletion capabilities

---

## Performance Considerations

1. **Image Optimization**
   - Compress before upload (client-side)
   - Generate thumbnails for list views
   - Lazy load images in grids

2. **Database**
   - Indexed columns for common queries
   - Pagination for large result sets
   - Optimistic UI updates

3. **Processing**
   - Background jobs don't block UI
   - Progress polling with exponential backoff
   - Batch operations where possible

4. **Caching**
   - Service worker caches app shell
   - SWR for data fetching
   - Supabase realtime for live updates

---

## Alternatives Considered

| Decision | Option A | Option B | Choice |
|----------|----------|----------|--------|
| **Database** | Supabase | PlanetScale | Supabase - includes auth + storage |
| **AI Primary** | GPT-4o | Groq Llama | Groq - faster, cheaper for MVP |
| **Camera** | Native API | react-webcam | react-webcam - easier cross-browser |
| **PDF Processing** | pdf-lib | pdfjs-dist | pdfjs-dist - better rendering |
| **Queue** | Custom table | Upstash Redis | Custom - simpler, Supabase-native |
| **Background Jobs** | Vercel BG Functions | Inngest | Vercel - native integration |

---

## Open Technical Questions

- [ ] Should we implement offline capture with sync, or require connectivity?
- [ ] Exact token costs per operation (needs cost modeling)
- [ ] Should we use Supabase Realtime for live processing updates?
- [ ] Image compression target size/quality tradeoff
- [ ] Retry strategy for failed AI calls (max attempts, backoff)
