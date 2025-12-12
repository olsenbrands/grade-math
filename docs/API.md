# API Documentation

## Overview

Grade Math uses Next.js API routes for server-side operations. All API routes require authentication via Supabase Auth.

**Base URL:** `/api`

---

## Authentication

All API routes require a valid Supabase session. The session is automatically managed through cookies set by Supabase Auth.

### Error Response (401 Unauthorized)

```json
{
  "error": "Unauthorized"
}
```

---

## Token API

Manages user token balance and transactions.

### GET /api/tokens

Get current user's token balance and status.

**Response:**
```json
{
  "balance": 50,
  "status": "healthy",
  "canGrade": true
}
```

**Status Values:**
- `healthy` - Balance > 10
- `low` - Balance 6-10
- `critical` - Balance 1-5
- `zero` - Balance 0

---

### POST /api/tokens

Perform token operations.

#### Action: `history`

Get transaction history.

**Request:**
```json
{
  "action": "history",
  "limit": 20
}
```

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "amount": -5,
      "balance_after": 45,
      "operation": "submission",
      "reference_id": "submission-uuid",
      "notes": "Grading 5 submissions",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

#### Action: `check-cost`

Check if user can afford an operation.

**Request:**
```json
{
  "action": "check-cost",
  "submissionCount": 10,
  "includeFeedback": true
}
```

**Response:**
```json
{
  "cost": 18,
  "currentBalance": 50,
  "canAfford": true,
  "remaining": 32,
  "hasDiscount": true,
  "savings": 2
}
```

**Cost Calculation:**
- Base: 1 token per submission
- Feedback: +1 token per submission (if enabled)
- Bulk discount: 10% off for 10+ submissions

---

#### Action: `admin-grant`

Grant tokens (admin only).

**Request:**
```json
{
  "action": "admin-grant",
  "targetUserId": "uuid",
  "amount": 100,
  "reason": "Welcome bonus"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "uuid",
  "newBalance": 150
}
```

---

## Grouping API

Manages student-submission assignments.

### GET /api/grouping

Get grouping statistics for a project.

**Query Parameters:**
- `projectId` (required) - Project UUID

**Response:**
```json
{
  "total": 25,
  "assigned": 20,
  "unassigned": 5,
  "withDetectedName": 23,
  "withoutDetectedName": 2,
  "avgConfidence": 0.87
}
```

---

### POST /api/grouping

Perform grouping operations.

#### Action: `auto-group`

Auto-assign a student to a submission based on detected name.

**Request:**
```json
{
  "action": "auto-group",
  "submissionId": "uuid",
  "detectedName": "John Smith",
  "nameConfidence": 0.92
}
```

**Response:**
```json
{
  "submissionId": "uuid",
  "detectedName": "John Smith",
  "nameConfidence": 0.92,
  "matches": [
    {
      "studentId": "uuid",
      "studentName": "John Smith",
      "confidence": 1.0,
      "matchType": "exact"
    }
  ],
  "assigned": true,
  "assignedTo": {
    "studentId": "uuid",
    "studentName": "John Smith"
  },
  "needsReview": false
}
```

**Match Types:**
- `exact` - Perfect name match
- `fuzzy` - Close match (typos, abbreviations)
- `partial` - First/last name matches
- `first_name` - Only first name matches
- `last_name` - Only last name matches

---

#### Action: `batch-auto-group`

Auto-assign all unassigned submissions in a project.

**Request:**
```json
{
  "action": "batch-auto-group",
  "projectId": "uuid"
}
```

**Response:**
```json
{
  "processed": 15,
  "assigned": 12,
  "needsReview": 3,
  "results": [...]
}
```

---

#### Action: `manual-assign`

Manually assign a student to a submission.

**Request:**
```json
{
  "action": "manual-assign",
  "submissionId": "uuid",
  "studentId": "uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

#### Action: `create-and-assign`

Create a new student and assign to submission.

**Request:**
```json
{
  "action": "create-and-assign",
  "submissionId": "uuid",
  "studentName": "Jane Doe"
}
```

**Response:**
```json
{
  "success": true,
  "studentId": "uuid"
}
```

---

#### Action: `match-preview`

Preview name matches without making changes.

**Request:**
```json
{
  "action": "match-preview",
  "detectedName": "Jon Smith"
}
```

**Response:**
```json
{
  "matches": [
    {
      "studentId": "uuid",
      "studentName": "John Smith",
      "confidence": 0.86,
      "matchType": "fuzzy"
    }
  ]
}
```

---

#### Action: `save-correction`

Save a teacher's correction for future matching.

**Request:**
```json
{
  "action": "save-correction",
  "detectedName": "Johnny S",
  "correctStudentId": "uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Grading API

### POST /api/grading/process

Process and grade submissions.

**Request:**
```json
{
  "projectId": "uuid",
  "submissionIds": ["uuid1", "uuid2"],
  "includeFeedback": true
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "status": "processing",
  "submissionsQueued": 2
}
```

---

### GET /api/grading/submission/[id]

Get grading result for a specific submission.

**Response:**
```json
{
  "id": "uuid",
  "submissionId": "uuid",
  "score": 8,
  "totalPoints": 10,
  "percentage": 80,
  "questions": [
    {
      "number": 1,
      "studentAnswer": "42",
      "correctAnswer": "42",
      "isCorrect": true,
      "points": 2,
      "maxPoints": 2,
      "confidence": 0.95
    }
  ],
  "feedback": "Great work! You got 8 out of 10 correct...",
  "needsReview": false,
  "gradedAt": "2024-01-15T10:35:00Z"
}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message here"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Not authenticated |
| 403 | Forbidden - Not allowed |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Rate Limiting

API calls are rate-limited per user:
- 100 requests per minute for read operations
- 20 requests per minute for write operations

Exceeded rate limits return:
```json
{
  "error": "Too many requests. Please try again later."
}
```
