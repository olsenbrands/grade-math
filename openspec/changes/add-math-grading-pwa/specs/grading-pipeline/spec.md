# Grading Pipeline

## ADDED Requirements

### Requirement: Background Processing
The system SHALL process submissions asynchronously without blocking the UI.

#### Scenario: Queue submission
- **WHEN** a submission is created
- **THEN** a processing_queue record is created
- **AND** the background function is triggered

#### Scenario: Job locking
- **WHEN** a worker picks up a job
- **THEN** the job is locked with timestamp and worker ID
- **AND** other workers skip locked jobs

#### Scenario: Job timeout
- **WHEN** a job is locked for more than 5 minutes
- **THEN** the lock is released
- **AND** another worker can pick it up

---

### Requirement: AI Vision Grading
The system SHALL use AI to extract and grade math answers.

#### Scenario: Grade with answer key
- **WHEN** a submission is processed with an answer key available
- **THEN** AI extracts student answers via OCR
- **AND** compares to answer key
- **AND** calculates score

#### Scenario: Grade without answer key
- **WHEN** a submission is processed without an answer key
- **THEN** AI attempts to infer correctness
- **AND** results are marked with lower confidence

#### Scenario: Problem segmentation
- **WHEN** AI processes an image
- **THEN** individual math problems are identified
- **AND** each problem gets a separate result entry

---

### Requirement: AI Provider Fallback
The system SHALL fallback to alternative AI providers on failure.

#### Scenario: Primary succeeds
- **WHEN** Groq (Llama 3.2) processes successfully
- **THEN** results are saved with ai_provider='groq'

#### Scenario: Primary fails, secondary succeeds
- **WHEN** Groq fails
- **THEN** OpenAI (GPT-4o) is attempted
- **AND** results are saved with ai_provider='openai'

#### Scenario: All providers fail
- **WHEN** all three providers fail
- **THEN** the submission status = 'failed'
- **AND** the error is logged for debugging

---

### Requirement: Confidence Scoring
The system SHALL provide confidence scores for grading results.

#### Scenario: High confidence
- **WHEN** AI is confident in all extractions
- **THEN** overall_confidence > 0.8
- **AND** status = 'completed'

#### Scenario: Low confidence
- **WHEN** AI has uncertainty about any problem
- **THEN** overall_confidence < 0.7
- **AND** status = 'needs_review'

#### Scenario: Per-problem confidence
- **WHEN** results are displayed
- **THEN** each problem shows individual confidence
- **AND** low-confidence problems are highlighted

---

### Requirement: Feedback Generation
The system SHALL optionally generate student-friendly feedback.

#### Scenario: Generate feedback
- **WHEN** processing mode includes feedback
- **THEN** AI generates plain-language explanations
- **AND** feedback is stored in graded_results

#### Scenario: Skip feedback
- **WHEN** processing mode is low-cost (no feedback)
- **THEN** feedback field is null
- **AND** fewer tokens are consumed

#### Scenario: Feedback format
- **WHEN** feedback is generated
- **THEN** it is suitable for printing
- **AND** uses student-appropriate language

---

### Requirement: Result Storage
The system SHALL persist grading results.

#### Scenario: Save results
- **WHEN** grading completes
- **THEN** a graded_results record is created
- **AND** includes score, problems JSON, feedback, and raw OCR

#### Scenario: Update submission
- **WHEN** results are saved
- **THEN** the submission status is updated
- **AND** detected_name and name_confidence are set

---

### Requirement: Retry Logic
The system SHALL retry failed processing jobs.

#### Scenario: Transient failure
- **WHEN** processing fails due to network error
- **THEN** the job is retried after exponential backoff
- **AND** attempts counter is incremented

#### Scenario: Max retries exceeded
- **WHEN** 3 retry attempts fail
- **THEN** status = 'failed'
- **AND** tokens are refunded
- **AND** the teacher is notified

#### Scenario: Permanent failure
- **WHEN** processing fails due to invalid image
- **THEN** no retry is attempted
- **AND** status = 'failed' immediately
