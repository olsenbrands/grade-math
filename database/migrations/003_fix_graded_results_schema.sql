-- Grade Math Database Schema Fix
-- Migration: 003_fix_graded_results_schema
-- Created: 2025-12-12
-- Fixes: graded_results table schema to match application code

-- ============================================
-- FIX GRADED_RESULTS TABLE SCHEMA
-- ============================================

-- Add missing columns to graded_results
ALTER TABLE public.graded_results
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.student_roster(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_score FLOAT,
  ADD COLUMN IF NOT EXISTS total_possible FLOAT,
  ADD COLUMN IF NOT EXISTS questions_json JSONB,
  ADD COLUMN IF NOT EXISTS detected_name TEXT,
  ADD COLUMN IF NOT EXISTS name_confidence FLOAT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id);

-- Create index on project_id
CREATE INDEX IF NOT EXISTS idx_results_project ON public.graded_results(project_id);

-- ============================================
-- ADD INSERT POLICY FOR GRADED_RESULTS
-- ============================================

-- Allow users to insert results for their own submissions
CREATE POLICY IF NOT EXISTS "Users can insert results for own submissions"
  ON public.graded_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions
      JOIN public.projects ON projects.id = submissions.project_id
      WHERE submissions.id = graded_results.submission_id
      AND projects.user_id = auth.uid()
    )
  );

-- Allow users to update results for their own submissions
CREATE POLICY IF NOT EXISTS "Users can update results for own submissions"
  ON public.graded_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      JOIN public.projects ON projects.id = submissions.project_id
      WHERE submissions.id = graded_results.submission_id
      AND projects.user_id = auth.uid()
    )
  );
