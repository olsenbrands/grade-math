-- Grade Math Storage Buckets
-- Migration: 002_storage_buckets
-- Created: 2025-12-12

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create submissions bucket for homework images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submissions',
  'submissions',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create answer-keys bucket for answer key uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'answer-keys',
  'answer-keys',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Submissions bucket policies
-- Users can upload to their own folder
CREATE POLICY "Users can upload submissions"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submissions' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submissions' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own submissions
CREATE POLICY "Users can delete own submissions"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'submissions' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Answer keys bucket policies
-- Users can upload to their own folder
CREATE POLICY "Users can upload answer keys"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'answer-keys' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own answer keys
CREATE POLICY "Users can view own answer keys"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'answer-keys' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own answer keys
CREATE POLICY "Users can delete own answer keys"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'answer-keys' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
