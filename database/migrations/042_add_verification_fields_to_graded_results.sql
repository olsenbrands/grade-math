-- Migration: Add OCR and verification tracking columns to graded_results
-- Version: 042
-- Date: 2024-01-02
-- Description: Adds fields to track which OCR provider was used,
--              what verification method was applied, and the results of verification

-- Add OCR provider tracking (mathpix or vision)
ALTER TABLE graded_results
ADD COLUMN IF NOT EXISTS ocr_provider TEXT DEFAULT 'vision'
  CHECK (ocr_provider IN ('mathpix', 'vision'));

-- Add OCR confidence score (0.0 to 1.0)
ALTER TABLE graded_results
ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(3,2)
  CHECK (ocr_confidence >= 0.0 AND ocr_confidence <= 1.0);

-- Add verification method tracking
ALTER TABLE graded_results
ADD COLUMN IF NOT EXISTS verification_method TEXT
  CHECK (verification_method IN ('wolfram', 'chain_of_thought', 'none') OR verification_method IS NULL);

-- Add verification result as JSONB for detailed data
ALTER TABLE graded_results
ADD COLUMN IF NOT EXISTS verification_result JSONB;

-- Add math difficulty classification
ALTER TABLE graded_results
ADD COLUMN IF NOT EXISTS math_difficulty TEXT
  CHECK (math_difficulty IN ('simple', 'moderate', 'complex') OR math_difficulty IS NULL);

-- Add indexes for efficient querying

-- Index for querying by verification method
CREATE INDEX IF NOT EXISTS idx_graded_results_verification_method
  ON graded_results(verification_method)
  WHERE verification_method IS NOT NULL;

-- Index for querying by math difficulty
CREATE INDEX IF NOT EXISTS idx_graded_results_math_difficulty
  ON graded_results(math_difficulty)
  WHERE math_difficulty IS NOT NULL;

-- Index for finding low-confidence results that need review
CREATE INDEX IF NOT EXISTS idx_graded_results_ocr_confidence_low
  ON graded_results(ocr_confidence)
  WHERE ocr_confidence < 0.8;

-- Index for finding results with verification conflicts
CREATE INDEX IF NOT EXISTS idx_graded_results_verification_conflict
  ON graded_results((verification_result->>'conflict'))
  WHERE verification_result IS NOT NULL AND (verification_result->>'conflict')::boolean = true;

-- Backfill existing records with default values
UPDATE graded_results
SET
  ocr_provider = 'vision',
  verification_method = 'none',
  math_difficulty = 'moderate'
WHERE ocr_provider IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN graded_results.ocr_provider IS 'Which OCR service extracted the problem text: mathpix (specialized math OCR) or vision (generic vision model)';
COMMENT ON COLUMN graded_results.ocr_confidence IS 'Confidence score from OCR provider (0.0-1.0). Low confidence (<0.8) should trigger manual review';
COMMENT ON COLUMN graded_results.verification_method IS 'Which verification method was used: wolfram (computational verification), chain_of_thought (AI self-check), or none (no verification)';
COMMENT ON COLUMN graded_results.verification_result IS 'JSON object with verification details: {matched: boolean, method: string, verificationAnswer: string, conflict: boolean}';
COMMENT ON COLUMN graded_results.math_difficulty IS 'Automatically classified difficulty level: simple (basic arithmetic), moderate (fractions/decimals), complex (algebra/equations)';
