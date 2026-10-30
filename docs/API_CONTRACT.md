# HireSync — API Contract

**Version:** 1.0  
**Base path:** `/api`  
**Audience:** frontend and backend developers.  
**Rule:** frontend must consume these contracts; backend must not silently rename fields or change response shapes.

## 1. General conventions

- JSON request/response bodies unless a route explicitly uses `multipart/form-data`.
- IDs are UUID strings.
- Timestamps are ISO 8601 UTC strings, e.g. `2026-10-30T12:30:00.000Z`.
- Dates without time use `YYYY-MM-DD`.
- Timezones use IANA names, e.g. `Asia/Kolkata`.
- Scores are numbers from 0 to 100.
- Weights are numbers from 0 to 100 and must total 100 for a saved rubric.
- All routes except candidate token routes require an authenticated HR session.
- All authorization checks happen on the server, not only in the UI.

## 2. Standard response envelope

Success:
```json
{
  "data": {},
  "meta": {}
}
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The rubric weights must total 100.",
    "details": {}
  }
}
```

Use appropriate HTTP status codes:
- `200` successful read/update/action.
- `201` resource created.
- `202` accepted for asynchronous processing.
- `400` malformed request.
- `401` unauthenticated.
- `403` unauthorized.
- `404` not found.
- `409` state/conflict/duplicate conflict.
- `413` upload too large.
- `422` valid JSON but invalid business rules.
- `500` unexpected server failure.

Never return stack traces, provider secrets, raw model prompts, or private storage URLs that bypass authorization.

## 3. Health

### `GET /api/health`
No auth required. Used for deployment checks.

Response:
```json
{
  "data": {
    "status": "ok",
    "service": "hiresync"
  }
}
```

This endpoint must not expose secrets or detailed infrastructure configuration.

## 4. Jobs

### `GET /api/jobs`
Returns jobs visible to the authenticated HR user.

### `POST /api/jobs`
Request:
```json
{
  "title": "Frontend Developer",
  "description": "Role description...",
  "requiredSkills": ["TypeScript", "React"],
  "preferredSkills": ["Next.js"],
  "interview": {
    "durationMinutes": 45,
    "bufferMinutes": 10,
    "capacity": 8,
    "dateStart": "2026-11-01",
    "dateEnd": "2026-11-14",
    "timezone": "Asia/Kolkata",
    "workingHours": [
      { "dayOfWeek": 1, "start": "09:00", "end": "17:00" },
      { "dayOfWeek": 2, "start": "09:00", "end": "17:00" }
    ],
    "breaks": [
      { "start": "13:00", "end": "14:00" }
    ]
  },
  "rubric": [
    {
      "key": "technical_skills",
      "label": "Technical skills",
      "description": "Evidence of required technical skills",
      "weight": 40,
      "guidance": "Score only skills supported by resume evidence."
    },
    {
      "key": "experience",
      "label": "Relevant experience",
      "description": "Relevant work or project experience",
      "weight": 30,
      "guidance": "Consider relevance and evidence, not only years."
    },
    {
      "key": "projects",
      "label": "Projects",
      "description": "Relevant projects and demonstrated contribution",
      "weight": 20,
      "guidance": "Look for specific contribution and outcomes."
    },
    {
      "key": "communication",
      "label": "Communication evidence",
      "description": "Evidence from written project descriptions",
      "weight": 10,
      "guidance": "Do not infer spoken communication ability from a resume."
    }
  ]
}
```

Rules:
- `rubric` weights must total exactly 100.
- `dayOfWeek`: 0 Sunday through 6 Saturday.
- `workingHours` may include only enabled days.
- All time windows use local 24-hour `HH:mm`.
- `dateStart` must be on/before `dateEnd`.

### `GET /api/jobs/:jobId`
Returns job, interview rules, rubric version, and summary counts.

### `PATCH /api/jobs/:jobId`
Updates editable job fields. If rubric changes, create a new rubric version; do not rewrite historical assessment inputs.

## 5. Resume upload and applications

### `POST /api/jobs/:jobId/resumes`
Content type: `multipart/form-data`  
Fields:
- `files`: one or more PDF/DOCX files.

Response (`202`):
```json
{
  "data": {
    "accepted": [
      {
        "applicationId": "uuid",
        "fileName": "candidate-a.pdf",
        "processingStatus": "uploaded"
      }
    ],
    "rejected": []
  }
}
```

Upload limits and file validation are enforced server-side. Processing may be asynchronous.

### `GET /api/jobs/:jobId/applications`
Returns paginated applications and summary status. Suggested query parameters: `page`, `pageSize`, `status`, `search`, `sort`.

### `GET /api/applications/:applicationId`
Returns candidate profile, evidence, processing status, assessment, HR decision, and permitted resume download action.

### `POST /api/applications/:applicationId/process`
Requests/retries extraction. Response `202` with `processingStatus`.

### `POST /api/applications/:applicationId/assess`
Requests assessment using the current rubric version. Backend validates extracted structured data, obtains criterion assessments, and calculates weighted total deterministically.

Response:
```json
{
  "data": {
    "assessmentId": "uuid",
    "rubricVersion": 1,
    "totalScore": 82.5,
    "criteria": [
      {
        "key": "technical_skills",
        "score": 90,
        "weight": 40,
        "weightedContribution": 36,
        "evidenceIds": ["uuid"],
        "explanation": "The resume explicitly lists TypeScript and React."
      }
    ],
    "flags": ["communication_not_assessed_from_resume"]
  }
}
```

Backend calculation:
`totalScore = sum(score * weight) / 100`

The LLM may propose criterion scores and explanations, but backend code validates bounds and computes the total. Store model/provider metadata sufficient for debugging, but never expose secrets.

## 6. HR review and shortlist

### `PATCH /api/applications/:applicationId/decision`
Request:
```json
{
  "decision": "shortlisted",
  "note": "Relevant React project experience; reviewed evidence."
}
```
Allowed decisions: `pending_review`, `shortlisted`, `not_shortlisted`.

A change from the current decision requires a non-empty note. Record actor and timestamp in the audit log.

### `POST /api/jobs/:jobId/shortlist/approve`
Request:
```json
{
  "applicationIds": ["uuid", "uuid"]
}
```
Backend verifies every application belongs to the job, has been reviewed, and capacity is not exceeded. Return `409` or `422` with a clear reason when invalid.

## 7. Interviewer availability and scheduling

### `GET /api/jobs/:jobId/interviewers`
Returns interviewers configured for the job and their availability.

### `POST /api/jobs/:jobId/interviewers`
Request:
```json
{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "availability": [
    {
      "date": "2026-11-03",
      "start": "09:00",
      "end": "12:00",
      "timezone": "Asia/Kolkata"
    }
  ]
}
```

### `POST /api/jobs/:jobId/schedule/proposals`
Request:
```json
{
  "applicationIds": ["uuid", "uuid"],
  "candidateAvailability": [
    {
      "applicationId": "uuid",
      "windows": [
        {
          "start": "2026-11-03T03:30:00.000Z",
          "end": "2026-11-03T07:30:00.000Z"
        }
      ]
    }
  ]
}
```

Response:
```json
{
  "data": {
    "proposals": [
      {
        "applicationId": "uuid",
        "interviewerId": "uuid",
        "startAt": "2026-11-03T04:30:00.000Z",
        "endAt": "2026-11-03T05:15:00.000Z",
        "status": "proposed"
      }
    ],
    "unscheduled": [
      {
        "applicationId": "uuid",
        "reason": "NO_COMMON_AVAILABLE_SLOT"
      }
    ]
  }
}
```

A proposal is not a booking. The scheduler must re-check conflicts during confirmation.

### `POST /api/interviews/:interviewId/confirm`
HR-only. Confirms a proposed slot. Use a database transaction/locking strategy to prevent race-condition double bookings. Return `409` if a conflict now exists.

### `PATCH /api/interviews/:interviewId`
HR-only changes/cancellation. Require valid state transitions and audit changes.

## 8. Email

### `POST /api/interviews/:interviewId/email-draft`
Creates or regenerates an invitation draft from verified data.

Response:
```json
{
  "data": {
    "emailId": "uuid",
    "status": "draft",
    "to": "candidate@example.com",
    "subject": "Interview invitation — Frontend Developer",
    "body": "Hello ..."
  }
}
```

### `PATCH /api/emails/:emailId`
Edits a draft. Only `draft` emails may be edited.

### `POST /api/emails/:emailId/approve`
HR approves the exact current draft. Store approver and timestamp.

### `POST /api/emails/:emailId/send`
Sends only an approved draft. Server verifies configuration and records provider response. Never return `sent` if provider did not confirm acceptance.

## 9. Candidate response routes

These routes use the invitation token instead of HR session authentication.

### `GET /api/candidate/invitations/:token`
Returns only the information needed by the candidate to review their invitation.

### `POST /api/candidate/invitations/:token/respond`
Request:
```json
{
  "response": "accept"
}
```
Allowed values: `accept`, `decline`, `request_reschedule`.

Response:
```json
{
  "data": {
    "response": "accept",
    "recordedAt": "2026-11-01T10:00:00.000Z"
  }
}
```

Tokens must be hashed at rest, expire, be scoped to one invitation, and support idempotent responses.

## 10. Frontend integration rules

- Use generated/shared TypeScript types where practical.
- Do not invent endpoints or field names.
- Do not hardcode fake API success.
- Show loading, empty, success, and error states.
- Display `processing`, `proposed`, `sent`, and similar statuses exactly as returned by the backend.
- If an endpoint is not implemented, show a clearly labeled unavailable/coming-soon state or a visibly labeled mock mode.
- Keep API calls in a small service/client layer, not scattered through components.
