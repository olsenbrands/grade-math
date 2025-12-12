# Submissions

## ADDED Requirements

### Requirement: Mobile Camera Capture
The system SHALL allow teachers to capture homework pages via mobile camera.

#### Scenario: Standard scan
- **WHEN** a teacher opens the camera and captures an image
- **THEN** the image is uploaded to Supabase Storage
- **AND** a submission record is created with status='pending'
- **AND** the submission is queued for processing

#### Scenario: Alignment guides
- **WHEN** the camera view opens
- **THEN** visual guides help align the page within the frame

#### Scenario: Manual rotation
- **WHEN** a teacher rotates the image before submission
- **THEN** the rotated orientation is saved

---

### Requirement: Batch Scan Mode
The system SHALL support rapid sequential scanning.

#### Scenario: Enable batch mode
- **WHEN** a teacher enables batch mode
- **THEN** the camera auto-captures when page edge is detected
- **AND** captures occur every 1-2 seconds

#### Scenario: Continuous scanning
- **WHEN** the teacher slides pages under the camera
- **THEN** each page is captured automatically
- **AND** uploads happen in background without blocking

#### Scenario: Batch completion
- **WHEN** the teacher exits batch mode
- **THEN** all captured images are shown for review
- **AND** any can be deleted before final submission

---

### Requirement: Desktop File Upload
The system SHALL allow file uploads from desktop.

#### Scenario: Drag and drop
- **WHEN** a teacher drags files onto the upload zone
- **THEN** files are accepted and upload begins
- **AND** progress indicators are shown

#### Scenario: File picker
- **WHEN** a teacher clicks "Select Files"
- **THEN** a file picker opens allowing multi-select
- **AND** selected files are uploaded

#### Scenario: Supported formats
- **WHEN** a teacher uploads JPG, JPEG, PNG, HEIC, or PDF
- **THEN** the file is accepted

#### Scenario: Unsupported format
- **WHEN** a teacher uploads an unsupported file type
- **THEN** an error is shown
- **AND** the file is rejected

---

### Requirement: PDF Processing
The system SHALL convert PDFs to individual page submissions.

#### Scenario: Multi-page PDF
- **WHEN** a teacher uploads a 10-page PDF
- **THEN** 10 separate submissions are created
- **AND** each has page_number set (1-10)
- **AND** page order is preserved

#### Scenario: Single-page PDF
- **WHEN** a teacher uploads a 1-page PDF
- **THEN** 1 submission is created
- **AND** page_number = 1

#### Scenario: Large PDF handling
- **WHEN** a PDF exceeds 60 pages
- **THEN** processing continues but may take longer
- **AND** the teacher is notified of extended processing time

---

### Requirement: Submission Status Tracking
The system SHALL track and display submission processing status.

#### Scenario: Pending status
- **WHEN** a submission is created
- **THEN** status = 'pending'
- **AND** the UI shows a pending indicator

#### Scenario: Processing status
- **WHEN** background processing begins
- **THEN** status = 'processing'
- **AND** the UI shows a spinner

#### Scenario: Completed status
- **WHEN** grading completes successfully
- **THEN** status = 'completed'
- **AND** the score is displayed

#### Scenario: Needs review status
- **WHEN** grading completes with low confidence
- **THEN** status = 'needs_review'
- **AND** the UI highlights for teacher attention

#### Scenario: Failed status
- **WHEN** processing fails after retries
- **THEN** status = 'failed'
- **AND** the teacher can retry manually

---

### Requirement: Submission Management
The system SHALL allow teachers to manage submissions.

#### Scenario: View submission list
- **WHEN** a teacher views a project's submissions
- **THEN** thumbnails are displayed
- **AND** status is shown for each

#### Scenario: Filter by status
- **WHEN** a teacher filters by "Needs Review"
- **THEN** only submissions with that status are shown

#### Scenario: Delete submission
- **WHEN** a teacher deletes a submission
- **THEN** the submission and related results are removed
- **AND** tokens are NOT refunded (already processed)

#### Scenario: Manual student assignment
- **WHEN** a teacher assigns a student to a submission
- **THEN** the student_id is updated
- **AND** the grouping persists
