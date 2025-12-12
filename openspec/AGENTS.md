# OpenSpec Agent Instructions

This document provides guidance for AI agents working with OpenSpec in this project.

## Spec Format

### WHEN/THEN Scenarios
All specs use this format:
```markdown
#### Scenario: [Scenario name]
- **WHEN** [trigger/action]
- **THEN** [expected outcome]
- **AND** [additional outcomes]
```

### Requirement Structure
```markdown
### Requirement: [Requirement Name]
[Description of what the system SHALL do]

#### Scenario: [Happy path]
...

#### Scenario: [Edge case]
...
```

## File Locations

- **Specs:** `openspec/specs/<capability>/spec.md`
- **Changes:** `openspec/changes/<slug>/`
  - `prd.md` - Product requirements (source of truth)
  - `proposal.md` - Technical impact
  - `tasks.md` - Implementation checklist
  - `design.md` - Architecture decisions

## Change Workflow

1. **Create proposal:** `/openspec:proposal`
2. **Implement:** `/openspec:apply <slug>`
3. **Archive:** `/openspec:archive <slug>`

## Conventions

- Use kebab-case for slugs: `add-math-grading-pwa`
- Keep specs focused on one capability
- Reference PRD from technical docs (don't duplicate)
- Mark status: PROPOSED → IN_PROGRESS → COMPLETED → ARCHIVED
