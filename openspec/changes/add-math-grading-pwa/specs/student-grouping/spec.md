# Student Grouping

## ADDED Requirements

### Requirement: Student Name Detection
The system SHALL attempt to extract student names from submissions.

#### Scenario: Clear name detected
- **WHEN** AI detects a student name with high confidence
- **THEN** detected_name is populated
- **AND** name_confidence > 0.8

#### Scenario: Ambiguous name
- **WHEN** AI detects a name but with uncertainty
- **THEN** detected_name is populated
- **AND** name_confidence < 0.7
- **AND** status = 'needs_review'

#### Scenario: No name found
- **WHEN** AI cannot detect any name
- **THEN** detected_name is null
- **AND** the submission requires manual assignment

---

### Requirement: Automatic Student Matching
The system SHALL auto-assign submissions to known students.

#### Scenario: Exact match
- **WHEN** detected_name matches a student_roster entry exactly
- **THEN** student_id is set automatically
- **AND** no teacher intervention needed

#### Scenario: Fuzzy match
- **WHEN** detected_name is similar to a roster entry (e.g., "Jon" vs "John")
- **THEN** the best match is suggested
- **AND** teacher can confirm or change

#### Scenario: No match found
- **WHEN** detected_name doesn't match any roster entry
- **THEN** teacher is prompted to assign or add new student

---

### Requirement: Manual Student Assignment
The system SHALL allow teachers to manually assign students.

#### Scenario: Select existing student
- **WHEN** a teacher selects a student from the dropdown
- **THEN** student_id is updated
- **AND** the assignment persists

#### Scenario: Add new student
- **WHEN** a teacher enters a new student name
- **THEN** a student_roster entry is created
- **AND** the submission is assigned to the new student

#### Scenario: Change assignment
- **WHEN** a teacher changes a submission's student
- **THEN** the new assignment replaces the old one

---

### Requirement: Student Roster Management
The system SHALL maintain a roster of known students per teacher.

#### Scenario: View roster
- **WHEN** a teacher views their student roster
- **THEN** all known students are listed

#### Scenario: Add student manually
- **WHEN** a teacher adds a student to the roster
- **THEN** the student is available for assignment in all projects

#### Scenario: Edit student name
- **WHEN** a teacher edits a student's name
- **THEN** the change reflects across all submissions

#### Scenario: Roster per teacher
- **WHEN** teacher A adds a student
- **THEN** teacher B cannot see that student
- **AND** rosters are isolated by teacher

---

### Requirement: Project-Level Grouping
The system SHALL display submissions grouped by student within a project.

#### Scenario: Grouped view
- **WHEN** a teacher views project submissions
- **THEN** submissions are grouped by student
- **AND** unassigned submissions are in a separate group

#### Scenario: Student summary
- **WHEN** multiple submissions exist for a student
- **THEN** aggregate score is calculated
- **AND** displayed with the student group

#### Scenario: Expand/collapse groups
- **WHEN** a teacher clicks a student group
- **THEN** individual submissions expand/collapse

---

### Requirement: Handwriting Association (Future)
The system SHALL improve name detection over time.

#### Scenario: Learn from corrections
- **WHEN** a teacher corrects a name assignment
- **THEN** the correction is stored
- **AND** improves future matching for that student

#### Scenario: Handwriting signature
- **WHEN** multiple submissions are assigned to a student
- **THEN** handwriting patterns can be learned (future enhancement)
