# HireSync — Database Schema

**Version:** 1.0  
**Database:** Supabase PostgreSQL  
**Status:** Initial MVP schema contract.

## 1. Design rules

- Use UUID primary keys.
- Use `timestamptz` for absolute timestamps; store timestamps in UTC.
- Store the job's IANA timezone separately for local display and scheduling rules.
- Keep original resumes in a private Storage bucket; database rows store the object path, not public URLs.
- Keep historical rubric versions so old assessments remain explainable.
- Keep an audit record for HR decisions, booking changes, and email approvals.
- Do not store raw invitation tokens; store only a cryptographic hash.
- Add Row Level Security (RLS) before connecting client-side Supabase access. Prefer server-side access for sensitive operations.

## 2. Entities and relationships

```text
auth.users
   └── jobs (created_by)
         ├── rubric_versions
         │     └── rubric_criteria
         ├── applications
         │     ├── resume_files
         │     ├── extracted_facts
         │     ├── evidence
         │     ├── assessments
         │     │     └── assessment_criteria
         │     └── interviews
         │           ├── invitation_tokens
         │           └── emails
         ├── interviewers
         │     └── interviewer_availability
         └── audit_logs
```

## 3. Table contracts

### `jobs`
- `id`
- `created_by` → `auth.users.id`
- `title`, `description`
- `required_skills`, `preferred_skills` (text arrays)
- `interview_duration_minutes`, `buffer_minutes`, `interview_capacity`
- `date_start`, `date_end`
- `timezone`
- `working_hours` and `breaks` (JSONB, validated by server)
- `status` (`draft`, `active`, `archived`)
- `created_at`, `updated_at`

### `rubric_versions`
One immutable version per saved rubric revision.
- `id`, `job_id`, `version`
- `created_by`, `created_at`

### `rubric_criteria`
- `id`, `rubric_version_id`
- `key`, `label`, `description`, `guidance`
- `weight` (0–100)
- Unique `(rubric_version_id, key)`

### `applications`
- `id`, `job_id`
- `candidate_name`, `candidate_email`, `candidate_phone`
- `processing_status` (`uploaded`, `processing`, `processed`, `failed`)
- `review_status` (`pending_review`, `reviewed`)
- `decision` (`pending_review`, `shortlisted`, `not_shortlisted`)
- `decision_note`, `decided_by`, `decided_at`
- `created_at`, `updated_at`

### `resume_files`
- `id`, `application_id`
- `storage_path`, `original_file_name`, `mime_type`, `file_size_bytes`
- `sha256`, `uploaded_at`

### `extracted_facts`
One structured extraction result per application/version.
- `id`, `application_id`, `schema_version`
- `extracted_json` (validated JSONB)
- `provider`, `model`, `created_at`

### `evidence`
- `id`, `application_id`, `extracted_fact_id` nullable
- `claim_key`, `claim_text`, `source_excerpt`
- `page_number`, `section_name`
- `confidence`, `review_status` (`unreviewed`, `accepted`, `rejected`)
- `created_at`

### `assessments`
- `id`, `application_id`, `rubric_version_id`
- `total_score` (0–100)
- `status` (`complete`, `needs_review`, `failed`)
- `model_provider`, `model_name`
- `created_at`

### `assessment_criteria`
- `id`, `assessment_id`, `rubric_criterion_id`
- `score` (0–100), `weight`, `weighted_contribution`
- `explanation`
- `evidence_ids` (UUID array)
- `evidence_status` (`supported`, `insufficient_evidence`, `conflicting`)
- Unique `(assessment_id, rubric_criterion_id)`

### `interviewers`
- `id`, `job_id`
- `name`, `email`
- `created_at`

### `interviewer_availability`
- `id`, `interviewer_id`
- `start_at`, `end_at` (`timestamptz`)
- `created_at`
Availability rows represent explicit available windows, not bookings.

### `interviews`
- `id`, `job_id`, `application_id`, `interviewer_id`
- `start_at`, `end_at` (`timestamptz`)
- `status` (`proposed`, `confirmed`, `completed`, `declined`, `reschedule_requested`, `cancelled`)
- `meeting_url` nullable; only populate if actually created/verified.
- `created_at`, `updated_at`

### `invitation_tokens`
- `id`, `interview_id`
- `token_hash`, `expires_at`, `used_at`
- `candidate_response` (`accept`, `decline`, `request_reschedule`) nullable
- `responded_at`, `created_at`

### `emails`
- `id`, `interview_id`
- `recipient`, `subject`, `body`
- `status` (`draft`, `approved`, `queued`, `sent`, `failed`)
- `approved_by`, `approved_at`
- `provider`, `provider_message_id`, `sent_at`, `failure_reason`
- `created_at`, `updated_at`

### `audit_logs`
- `id`, `job_id`, `actor_user_id`
- `entity_type`, `entity_id`, `action`
- `details` JSONB (do not put secrets or full resume text here)
- `created_at`

## 4. Important constraints and indexes

- Rubric criterion weight must be between 0 and 100. The server must verify that weights sum to 100 before activating/saving a complete rubric.
- Interview end must be after start.
- Availability end must be after start.
- Interview capacity and duration must be positive.
- Index all foreign keys used for common lookups.
- Unique `(job_id, version)` on rubric versions.
- Unique `(rubric_version_id, key)` on rubric criteria.
- Prevent overlapping confirmed interviews for the same interviewer or application. Implement with PostgreSQL exclusion constraints where feasible (`btree_gist`) or a transaction/locking strategy. Do not rely only on frontend checks.
- Token hashes must be unique.
- Restrict access to candidate PII and resume storage through RLS/server authorization.

## 5. Initial migration notes

The accompanying SQL migration creates the core tables and basic constraints. It is a starting point, not a substitute for:
- Enabling and testing RLS policies.
- Configuring the private Storage bucket.
- Adding overlap protection and transaction-safe booking confirmation.
- Validating JSONB working-hours/breaks in server code.
- Reviewing schema against the actual Supabase project before production use.

Do not expose the Supabase service-role key to the browser.
