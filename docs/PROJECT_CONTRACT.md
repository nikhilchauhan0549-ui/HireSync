# HireSync — Project Contract

**Version:** 1.0  
**Status:** MVP agreement for both developers and their coding assistants.

## 1. Product goal

Build an HR-facing recruitment workspace that assists with resume review and interview coordination. The product must make decisions explainable and keep consequential actions under human control.

**Core principle:** AI recommends. Software verifies. Humans approve. Agents execute.

## 2. Users and permissions

### HR user
- Creates and manages jobs.
- Defines required/preferred skills and scoring rubric.
- Uploads resumes.
- Reviews candidate evidence and scores.
- Approves or changes shortlist decisions.
- Enters interviewer availability and scheduling rules.
- Approves interview invitations and email drafts.
- Reviews activity history.

### Candidate (limited, token-based access)
- Opens a secure interview-response link.
- Accepts, declines, or requests a reschedule.
- Does not receive access to HR dashboard or other candidates.

MVP may use one authenticated HR workspace/account model. Do not build complex enterprise roles unless time permits and the team agrees.

## 3. End-to-end workflow

### A. Create a job
HR supplies:
- Job title and description.
- Required skills.
- Preferred skills.
- Weighted rubric criteria.
- Interview duration.
- Interview date range.
- Working hours, timezone, breaks, and interviewer list.
- Maximum interview capacity.

Validation:
- Rubric weights must be positive and total exactly 100.
- Interview duration must be positive.
- End date must not precede start date.
- Timezone must be a valid IANA timezone.
- Capacity must be a positive integer.

### B. Upload resumes
- Accept PDF and DOCX only for the MVP.
- Enforce a configured file-size limit.
- Store originals in a private Supabase Storage bucket.
- Validate file extension and actual file type server-side.
- Do not make uploaded files public.
- Create a candidate/application record for each accepted resume.
- Show per-file processing status and useful errors.
- Duplicate detection may use normalized email when available; do not silently overwrite an existing application.

### C. Extract candidate information
Extract, when present:
- Full name and contact details.
- Skills.
- Employment history and dates.
- Total relevant experience (derived carefully and marked estimated).
- Education.
- Projects and certifications.
- Evidence snippets and source locations.

For every extracted claim, store:
- The claim/value.
- Supporting exact text excerpt from the resume.
- Page number or section if available.
- Confidence or review status.
- Whether the information was explicit or inferred.

Rules:
- Never fabricate missing data.
- Use `null` or `unknown` when not found.
- Distinguish “not found” from “candidate does not have this skill.”
- LLM output is untrusted input: validate it against a schema before saving.
- If extraction fails, retain the resume and mark processing as failed; allow retry.

### D. Score and rank candidates
- The backend calculates scores using the saved rubric; the LLM must not calculate the final numeric score.
- Each criterion receives a score from 0 to 100, based on evidence and defined criterion guidance.
- Weighted total = sum(criterion score × criterion weight) / 100.
- Missing evidence must not automatically be treated as proof of absence. Mark it “insufficient evidence” and apply the criterion's agreed scoring policy.
- Display criterion-level score, weight, evidence, and explanation.
- Store rubric version used for each assessment.
- Rank deterministically by total score descending; use a stable tie-breaker (application creation time ascending).
- Scores support human review; they must not automatically reject or hire a person.

### E. HR review and shortlist
- HR can inspect original resume, extracted profile, evidence, criterion scores, and flags.
- HR can override recommendation/status and must provide an optional note (required for override in the MVP).
- The system records who changed the decision, when, and why.
- Shortlist capacity cannot exceed job interview capacity unless HR explicitly changes capacity.
- No candidate is invited before HR approves the shortlist.

### F. Interview scheduling
HR configures:
- Interview duration.
- Date range.
- Working hours and timezone.
- Break windows.
- Interviewer availability.
- Optional buffer between interviews.
- Candidate availability (if collected).

Scheduler requirements:
- Use timezone-aware timestamps internally.
- Convert local working-hour windows using the configured IANA timezone.
- Never schedule outside working hours or inside breaks.
- Never double-book an interviewer or candidate.
- Respect interview duration and buffer.
- Re-check conflicts immediately before confirming a booking.
- Store timestamps in UTC; retain the job timezone for display.
- If no slot exists, explain the constraint and show that no slot was found. Never invent a slot.
- A proposed slot is not a confirmed booking until HR approves it and the backend successfully reserves it.
- Candidate decline/reschedule request changes booking state and triggers a new scheduling proposal; it does not silently overwrite another booking.

For the MVP, interviewer availability can be entered manually. Do not claim calendar synchronization.

### G. Email workflow
- Generate personalized email drafts from verified application/job/booking data.
- Keep drafts editable.
- HR approval is required before sending.
- Use a configured provider (e.g. Resend) only when credentials are present.
- Store provider message ID and delivery state when available.
- Distinguish `draft`, `approved`, `queued`, `sent`, `failed`.
- Never display “sent” unless the provider confirms acceptance.
- In local/demo mode, clearly label simulated email and do not imply it was delivered.

### H. Candidate response
- Use a cryptographically random, single-purpose token; store only its hash.
- Token must be scoped to one invitation and expire.
- Candidate can accept, decline, or request reschedule.
- Make responses idempotent; repeated clicks must not create duplicate actions.
- Do not expose internal candidate notes, scores, or other applicants.

## 4. Required application states

### Resume processing
`uploaded` → `processing` → `processed`  
Failure path: `processing` → `failed` → retry → `processing`

### Application review
`pending_review` → `reviewed` → `shortlisted` or `not_shortlisted`  
HR may revise a decision; preserve the audit trail.

### Interview
`proposed` → `confirmed` → `completed`  
Alternative states: `declined`, `reschedule_requested`, `cancelled`

### Email
`draft` → `approved` → `queued` → `sent`  
Failure path: `queued` → `failed`

## 5. Non-functional requirements

- Protect resumes and candidate personal data.
- Enforce authorization on every server route.
- Keep API keys server-side only.
- Validate all request bodies and uploaded files.
- Use structured logs without logging resume contents, secrets, or full candidate personal data.
- Provide clear user-facing error messages.
- Use accessible labels, keyboard navigation, and responsive layouts.
- Use database transactions or equivalent locking for booking conflict checks.
- Keep an audit trail for HR decisions, booking changes, and email approvals.

## 6. MVP acceptance checklist

- [ ] HR can create a job and save a valid weighted rubric.
- [ ] HR can upload PDF/DOCX resumes and see processing status.
- [ ] Extracted facts have source evidence or are explicitly marked unavailable.
- [ ] Scores are calculated by backend code and can be explained criterion by criterion.
- [ ] Candidate ranking is deterministic for the same saved assessment data.
- [ ] HR can override and approve shortlist decisions.
- [ ] Scheduler never returns a conflicting or out-of-hours confirmed booking.
- [ ] No slot is reported honestly when constraints cannot be satisfied.
- [ ] Email drafts require HR approval.
- [ ] Candidate token links support accept/decline/reschedule securely.
- [ ] Tests cover score calculation, schedule conflicts, and state transitions.
- [ ] Demo mode is visibly labeled and never reports simulated actions as real.

## 7. Explicitly excluded claims

Unless actually implemented and tested, do not claim:
- Google Calendar/Gmail synchronization.
- Automatic Google Meet creation.
- LinkedIn integration or scraping.
- Real email delivery in mock/demo mode.
- Perfect resume parsing or unbiased/fully objective AI decisions.
