-- Grade Math Database Schema
-- Migration: 001_initial_schema
-- Created: 2025-12-12

-- ============================================
-- PROFILES TABLE (extends Supabase Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  school_name TEXT,
  grade_level TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_date ON public.projects(date DESC);

-- ============================================
-- STUDENT ROSTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.student_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roster_user ON public.student_roster(user_id);

-- ============================================
-- PROJECT ANSWER KEYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.project_answer_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'pdf', 'manual')),
  storage_path TEXT,
  answers JSONB, -- [{question: 1, answer: "42"}, ...]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answer_keys_project ON public.project_answer_keys(project_id);

-- ============================================
-- SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.student_roster(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  page_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'needs_review', 'failed')),
  detected_name TEXT,
  name_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_project ON public.submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions(student_id);

-- ============================================
-- GRADED RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.graded_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  score FLOAT,
  max_score FLOAT,
  percentage FLOAT GENERATED ALWAYS AS (
    CASE WHEN max_score > 0 THEN (score / max_score) * 100 ELSE 0 END
  ) STORED,
  problems JSONB, -- [{number: 1, student_answer: "5", correct_answer: "7", is_correct: false}, ...]
  overall_confidence FLOAT,
  feedback TEXT,
  raw_ocr_text TEXT,
  ai_provider TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_results_submission ON public.graded_results(submission_id);

-- ============================================
-- PROCESSING QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON public.processing_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_queue_submission ON public.processing_queue(submission_id);

-- ============================================
-- TOKEN LEDGER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.token_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive = credit, Negative = debit
  balance_after INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('signup_bonus', 'submission', 'refund', 'purchase', 'admin_grant')),
  reference_id UUID, -- Submission ID if applicable
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON public.token_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON public.token_ledger(created_at DESC);

-- Function to get user's current token balance
CREATE OR REPLACE FUNCTION public.get_token_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(
    (SELECT balance_after FROM public.token_ledger
     WHERE user_id = p_user_id
     ORDER BY created_at DESC
     LIMIT 1),
    0
  ) INTO balance;
  RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant initial tokens on profile creation
CREATE OR REPLACE FUNCTION public.grant_signup_tokens()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.token_ledger (user_id, amount, balance_after, operation, notes)
  VALUES (NEW.id, 100, 100, 'signup_bonus', 'Welcome bonus tokens');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_grant_tokens ON public.profiles;
CREATE TRIGGER on_profile_created_grant_tokens
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_signup_tokens();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Profiles: own data only
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Projects: own projects only
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects"
  ON public.projects FOR ALL
  USING (auth.uid() = user_id);

-- Student Roster: own roster only
ALTER TABLE public.student_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own roster"
  ON public.student_roster FOR ALL
  USING (auth.uid() = user_id);

-- Answer Keys: via project ownership
ALTER TABLE public.project_answer_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage answer keys for own projects"
  ON public.project_answer_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_answer_keys.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Submissions: via project ownership
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage submissions for own projects"
  ON public.submissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = submissions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Graded Results: via submission ownership
ALTER TABLE public.graded_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view results for own submissions"
  ON public.graded_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      JOIN public.projects ON projects.id = submissions.project_id
      WHERE submissions.id = graded_results.submission_id
      AND projects.user_id = auth.uid()
    )
  );

-- Processing Queue: service role only (no user access)
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
-- No policies = service role only access

-- Token Ledger: read own only, writes via service role
ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token history"
  ON public.token_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_student_roster_updated_at
  BEFORE UPDATE ON public.student_roster
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_answer_keys_updated_at
  BEFORE UPDATE ON public.project_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_queue_updated_at
  BEFORE UPDATE ON public.processing_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
