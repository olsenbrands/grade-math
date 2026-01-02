# Math Grading Accuracy

## ADDED Requirements

### Requirement: GPT-4o Primary Provider
The system SHALL use GPT-4o as the primary AI provider for grading math homework.

#### Scenario: Default provider selection
- **WHEN** a grading request is submitted
- **THEN** GPT-4o is used as the primary provider
- **AND** fallback order is OpenAI → Anthropic → Groq

#### Scenario: Provider unavailable
- **WHEN** GPT-4o is unavailable (API error, rate limit)
- **THEN** the system falls back to Claude 3.5 Sonnet
- **AND** if Claude fails, falls back to Groq Llama 3.2

#### Scenario: Configurable provider order
- **WHEN** `AI_PROVIDER_PRIMARY` environment variable is set
- **THEN** that provider is used as primary
- **AND** `AI_FALLBACK_ORDER` determines fallback sequence

---

### Requirement: Mathpix OCR Integration
The system SHALL use Mathpix API for specialized math handwriting recognition.

#### Scenario: Successful OCR extraction
- **WHEN** an image is submitted for grading
- **AND** Mathpix is enabled (`ENABLE_MATHPIX=true`)
- **THEN** the image is sent to Mathpix API first
- **AND** extracted LaTeX is included in the grading prompt
- **AND** `ocr_provider` is recorded as 'mathpix'

#### Scenario: Mathpix returns low confidence
- **WHEN** Mathpix OCR confidence is below 0.7
- **THEN** the result is flagged with `needsReview=true`
- **AND** `reviewReason` includes "Low OCR confidence"

#### Scenario: Mathpix unavailable
- **WHEN** Mathpix API fails or times out
- **THEN** the system falls back to vision model OCR
- **AND** `ocr_provider` is recorded as 'vision'
- **AND** processing continues without blocking

#### Scenario: Mathpix disabled
- **WHEN** `ENABLE_MATHPIX` is false or unset
- **THEN** only vision model OCR is used
- **AND** `ocr_provider` is recorded as 'vision'

---

### Requirement: Wolfram Alpha Verification
The system SHALL use Wolfram Alpha API to verify AI calculations for complex math problems.

#### Scenario: Complex math verification
- **WHEN** a problem is classified as 'complex'
- **AND** Wolfram verification is enabled
- **THEN** the AI's answer is sent to Wolfram Alpha
- **AND** Wolfram's result is compared to AI's answer

#### Scenario: Verification match
- **WHEN** Wolfram's answer matches AI's answer
- **THEN** `wolframVerified` is set to true
- **AND** confidence is increased

#### Scenario: Verification mismatch
- **WHEN** Wolfram's answer differs from AI's answer
- **THEN** `verificationConflict` is set to true
- **AND** `needsReview` is set to true
- **AND** both answers are recorded for teacher review

#### Scenario: Equivalent answer forms
- **WHEN** Wolfram returns "1.25"
- **AND** AI calculated "5/4"
- **THEN** answers are recognized as equivalent
- **AND** `wolframVerified` is set to true

#### Scenario: Wolfram unavailable
- **WHEN** Wolfram API fails or rate limit exceeded
- **THEN** chain-of-thought verification is used instead
- **AND** `verificationMethod` is 'chain_of_thought'

---

### Requirement: Math Difficulty Classification
The system SHALL classify math problems by difficulty to optimize the verification pipeline.

#### Scenario: Simple math classification
- **WHEN** a problem contains only basic arithmetic (+, -, ×, ÷)
- **AND** operands are integers
- **THEN** difficulty is classified as 'simple'
- **AND** no verification is performed

#### Scenario: Moderate math classification
- **WHEN** a problem contains fractions, decimals, or percentages
- **THEN** difficulty is classified as 'moderate'
- **AND** chain-of-thought verification is performed

#### Scenario: Complex math classification
- **WHEN** a problem contains variables, equations, or multi-step operations
- **THEN** difficulty is classified as 'complex'
- **AND** Wolfram Alpha verification is performed

---

### Requirement: Chain-of-Thought Verification
The system SHALL perform AI self-verification using a second solving pass with different methodology.

#### Scenario: Verification pass execution
- **WHEN** chain-of-thought verification is triggered
- **THEN** the AI is prompted to solve the problem again
- **AND** the prompt instructs using a different solving method
- **AND** both answers are compared

#### Scenario: Self-verification conflict
- **WHEN** the verification answer differs from original
- **THEN** `verificationConflict` is set to true
- **AND** `needsReview` is set to true
- **AND** both calculations are recorded

---

### Requirement: Enhanced Confidence Scoring
The system SHALL calculate overall confidence from multiple signals.

#### Scenario: High confidence result
- **WHEN** OCR confidence > 0.9
- **AND** verification matches (if performed)
- **AND** AI calculation confidence > 0.9
- **THEN** overall confidence is high (≥ 0.9)
- **AND** `needsReview` is false

#### Scenario: Low confidence result
- **WHEN** any signal has confidence < 0.7
- **THEN** `needsReview` is set to true
- **AND** `reviewReason` explains which signal was low

#### Scenario: Verification adds confidence
- **WHEN** Wolfram verification matches AI answer
- **THEN** confidence is boosted by 0.1 (max 1.0)

---

### Requirement: Cost Tracking for New Services
The system SHALL track costs for Mathpix and Wolfram API usage.

#### Scenario: Mathpix cost tracking
- **WHEN** Mathpix OCR is performed
- **THEN** API call is recorded in cost tracking
- **AND** cost is attributed to the user's account

#### Scenario: Wolfram cost tracking
- **WHEN** Wolfram verification is performed
- **THEN** API call is recorded in cost tracking
- **AND** cost is attributed to the user's account

---

### Requirement: Deterministic Temperature Setting
The system SHALL use temperature 0.0 for all math grading to ensure deterministic output.

#### Scenario: Temperature configuration
- **WHEN** a grading request is made
- **THEN** AI temperature is set to 0.0
- **AND** responses are deterministic for the same input

---

## MODIFIED Requirements

### Requirement: Grading Pipeline Flow
The grading pipeline SHALL include preprocessing, classification, and verification stages.

#### Scenario: Full pipeline execution
- **WHEN** a submission is graded
- **THEN** the following steps execute in order:
  1. Mathpix OCR (if enabled)
  2. Math difficulty classification
  3. GPT-4o grading
  4. Verification (based on difficulty)
  5. Confidence calculation
  6. Result storage

#### Scenario: Pipeline timeout
- **WHEN** total pipeline execution exceeds 30 seconds
- **THEN** processing is terminated
- **AND** partial results are saved
- **AND** `needsReview` is set to true
- **AND** `reviewReason` is "Pipeline timeout"
