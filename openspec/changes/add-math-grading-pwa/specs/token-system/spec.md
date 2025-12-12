# Token System

## ADDED Requirements

### Requirement: Token Balance Tracking
The system SHALL maintain accurate token balances per teacher.

#### Scenario: View balance
- **WHEN** a teacher views the dashboard or settings
- **THEN** their current token balance is displayed

#### Scenario: Initial balance
- **WHEN** a new teacher completes onboarding
- **THEN** they receive an initial token grant
- **AND** a token_ledger entry records the grant

---

### Requirement: Token Deduction
The system SHALL deduct tokens when creating submissions.

#### Scenario: Sufficient balance
- **WHEN** a teacher uploads a submission
- **AND** they have sufficient tokens
- **THEN** tokens are deducted
- **AND** the submission is queued for processing

#### Scenario: Insufficient balance
- **WHEN** a teacher attempts to upload
- **AND** they have zero tokens
- **THEN** the upload is blocked
- **AND** a message indicates insufficient tokens

#### Scenario: Batch upload deduction
- **WHEN** a teacher uploads 10 pages
- **THEN** tokens for all 10 pages are deducted upfront
- **AND** before any processing begins

---

### Requirement: Token Costs
The system SHALL apply different costs based on processing mode.

#### Scenario: Low cost mode
- **WHEN** teacher selects low-cost mode
- **THEN** minimal tokens are deducted
- **AND** no feedback is generated

#### Scenario: Full feedback mode
- **WHEN** teacher selects full feedback mode
- **THEN** higher token cost applies
- **AND** feedback is included in results

#### Scenario: Bulk discount
- **WHEN** teacher uses "Auto-grade Entire Class"
- **THEN** a discounted per-page rate applies

---

### Requirement: Token Refunds
The system SHALL refund tokens for failed processing.

#### Scenario: Processing failure refund
- **WHEN** a submission fails after max retries
- **THEN** tokens are refunded
- **AND** a token_ledger credit entry is created

#### Scenario: No refund on success
- **WHEN** processing completes successfully
- **THEN** no refund is issued
- **AND** balance remains unchanged

---

### Requirement: Low Balance Warnings
The system SHALL warn teachers of low token balance.

#### Scenario: Low balance warning
- **WHEN** balance drops below threshold (e.g., 10 tokens)
- **THEN** a warning banner is displayed
- **AND** the warning persists until balance increases

#### Scenario: Zero balance block
- **WHEN** balance reaches zero
- **THEN** upload buttons are disabled
- **AND** a clear message explains the block

---

### Requirement: Token History
The system SHALL provide transaction history.

#### Scenario: View history
- **WHEN** a teacher views token history
- **THEN** they see all transactions
- **AND** each shows amount, type, date, and balance after

#### Scenario: Filter history
- **WHEN** a teacher filters by operation type
- **THEN** only matching transactions are shown

---

### Requirement: Token Administration
The system SHALL allow admins to grant tokens.

#### Scenario: Admin token grant
- **WHEN** an admin grants tokens to a teacher
- **THEN** the balance increases
- **AND** a ledger entry with operation='grant' is created

#### Scenario: Monthly allocation
- **WHEN** a new month begins
- **THEN** teachers receive their monthly token allocation
- **AND** ledger entries record the grants
