# Projects

## ADDED Requirements

### Requirement: Project Creation
The system SHALL allow teachers to create homework projects.

#### Scenario: Create project with all fields
- **WHEN** a teacher submits a new project with name, date, and notes
- **THEN** the project is created in the database
- **AND** the teacher is redirected to the project detail page

#### Scenario: Create project with defaults
- **WHEN** a teacher submits only a project name
- **THEN** the project is created with date = today
- **AND** notes are empty

#### Scenario: Duplicate name allowed
- **WHEN** a teacher creates a project with the same name as an existing project
- **THEN** the project is created successfully (names are not unique)

---

### Requirement: Project Listing
The system SHALL display a list of the teacher's projects.

#### Scenario: View active projects
- **WHEN** a teacher views the projects page
- **THEN** they see a list of non-archived projects
- **AND** projects are sorted by date descending

#### Scenario: View archived projects
- **WHEN** a teacher toggles "Show archived"
- **THEN** archived projects are also displayed
- **AND** they are visually distinguished

#### Scenario: Empty state
- **WHEN** a teacher has no projects
- **THEN** a helpful empty state is shown with a create button

---

### Requirement: Project Detail View
The system SHALL display project details with submission status.

#### Scenario: View project
- **WHEN** a teacher opens a project
- **THEN** they see project name, date, notes
- **AND** answer key status
- **AND** submission count and status breakdown

#### Scenario: Submission progress
- **WHEN** a project has submissions
- **THEN** the detail view shows "X of Y completed"
- **AND** links to filter by status

---

### Requirement: Project Editing
The system SHALL allow teachers to edit project details.

#### Scenario: Edit project
- **WHEN** a teacher updates project name, date, or notes
- **THEN** the changes are saved
- **AND** updated_at is refreshed

---

### Requirement: Project Archiving
The system SHALL allow teachers to archive and restore projects.

#### Scenario: Archive project
- **WHEN** a teacher archives a project
- **THEN** is_archived is set to true
- **AND** the project is hidden from the default list

#### Scenario: Restore project
- **WHEN** a teacher restores an archived project
- **THEN** is_archived is set to false
- **AND** the project appears in the active list

---

### Requirement: Answer Key Management
The system SHALL allow teachers to add answer keys to projects.

#### Scenario: Upload image answer key
- **WHEN** a teacher uploads a photo of an answer key
- **THEN** the image is stored in Supabase Storage
- **AND** a project_answer_keys record is created with type='image'

#### Scenario: Upload PDF answer key
- **WHEN** a teacher uploads a PDF answer key
- **THEN** the PDF is stored in Supabase Storage
- **AND** a project_answer_keys record is created with type='pdf'

#### Scenario: Manual answer entry
- **WHEN** a teacher manually enters answers
- **THEN** the answers are stored as JSON in project_answer_keys
- **AND** type='manual'

#### Scenario: No answer key warning
- **WHEN** a teacher creates a project without an answer key
- **THEN** a message is displayed: "Providing an answer key significantly increases grading accuracy"

#### Scenario: Replace answer key
- **WHEN** a teacher uploads a new answer key
- **THEN** the old answer key is replaced
- **AND** existing graded results are NOT reprocessed automatically
