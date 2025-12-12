# Authentication

## ADDED Requirements

### Requirement: Teacher Account Creation
The system SHALL allow teachers to create accounts using email/password or Google OAuth.

#### Scenario: Email signup
- **WHEN** a teacher submits valid email and password on the signup form
- **THEN** an account is created in Supabase Auth
- **AND** a corresponding record is created in the users table
- **AND** the teacher is redirected to onboarding

#### Scenario: Google OAuth signup
- **WHEN** a teacher clicks "Sign in with Google"
- **THEN** they are redirected to Google OAuth flow
- **AND** upon successful authentication, an account is created
- **AND** the teacher is redirected to onboarding

#### Scenario: Duplicate email
- **WHEN** a teacher attempts to sign up with an existing email
- **THEN** an error message is displayed
- **AND** no duplicate account is created

---

### Requirement: Teacher Login
The system SHALL allow existing teachers to log in.

#### Scenario: Valid email login
- **WHEN** a teacher enters valid email and password
- **THEN** a session is created
- **AND** the teacher is redirected to the dashboard

#### Scenario: Invalid credentials
- **WHEN** a teacher enters invalid email or password
- **THEN** an error message "Invalid credentials" is displayed
- **AND** no session is created

#### Scenario: Google OAuth login
- **WHEN** a teacher clicks "Sign in with Google" with an existing account
- **THEN** they are authenticated via OAuth
- **AND** redirected to the dashboard

---

### Requirement: Teacher Onboarding
The system SHALL require profile completion on first login.

#### Scenario: First login
- **WHEN** a teacher logs in and onboarding_completed is false
- **THEN** they are redirected to the onboarding page
- **AND** cannot access the dashboard until complete

#### Scenario: Complete onboarding
- **WHEN** a teacher submits their name (school and grade level optional)
- **THEN** their profile is updated
- **AND** onboarding_completed is set to true
- **AND** they are redirected to the dashboard

#### Scenario: Returning user
- **WHEN** a teacher logs in and onboarding_completed is true
- **THEN** they are taken directly to the dashboard

---

### Requirement: PWA Install Prompt
The system SHALL prompt users to install the PWA on supported devices.

#### Scenario: Eligible device
- **WHEN** a teacher visits on a device that supports PWA installation
- **AND** they have not dismissed the prompt before
- **THEN** an install prompt is displayed

#### Scenario: Already installed
- **WHEN** a teacher opens the app from installed PWA
- **THEN** no install prompt is shown

---

### Requirement: Session Management
The system SHALL maintain secure user sessions.

#### Scenario: Session expiry
- **WHEN** a teacher's session expires
- **THEN** they are redirected to the login page
- **AND** a message indicates session expired

#### Scenario: Logout
- **WHEN** a teacher clicks logout
- **THEN** their session is destroyed
- **AND** they are redirected to the login page
