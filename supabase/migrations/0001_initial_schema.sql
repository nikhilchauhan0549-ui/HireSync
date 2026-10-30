-- HireSync initial schema (MVP starting point)
-- Review and test in a disposable Supabase project before production.
-- RLS policies and booking-overlap protection must be added before real use.

create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  required_skills text[] not null default '{}',
  preferred_skills text[] not null default '{}',
  interview_duration_minutes integer not null check (interview_duration_minutes > 0),
  buffer_minutes integer not null default 0 check (buffer_minutes >= 0),
  interview_capacity integer not null check (interview_capacity > 0),
  date_start date not null,
  date_end date not null,
  timezone text not null,
  working_hours jsonb not null default '[]'::jsonb,
  breaks jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_end >= date_start)
);

create table if not exists public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  version integer not null check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (job_id, version)
);

create table if not exists public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  rubric_version_id uuid not null references public.rubric_versions(id) on delete cascade,
  key text not null,
  label text not null,
  description text not null default '',
  guidance text not null default '',
  weight numeric(5,2) not null check (weight >= 0 and weight <= 100),
  unique (rubric_version_id, key)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_name text,
  candidate_email text,
  candidate_phone text,
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded','processing','processed','failed')),
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review','reviewed')),
  decision text not null default 'pending_review'
    check (decision in ('pending_review','shortlisted','not_shortlisted')),
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resume_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  storage_path text not null unique,
  original_file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  sha256 text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.extracted_facts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  schema_version integer not null default 1,
  extracted_json jsonb not null,
  provider text,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  extracted_fact_id uuid references public.extracted_facts(id) on delete set null,
  claim_key text not null,
  claim_text text not null,
  source_excerpt text not null,
  page_number integer,
  section_name text,
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed','accepted','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  rubric_version_id uuid not null references public.rubric_versions(id) on delete restrict,
  total_score numeric(5,2) check (total_score >= 0 and total_score <= 100),
  status text not null default 'complete'
    check (status in ('complete','needs_review','failed')),
  model_provider text,
  model_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_criteria (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  rubric_criterion_id uuid not null references public.rubric_criteria(id) on delete restrict,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  weight numeric(5,2) not null check (weight >= 0 and weight <= 100),
  weighted_contribution numeric(6,3) not null,
  explanation text not null default '',
  evidence_ids uuid[] not null default '{}',
  evidence_status text not null
    check (evidence_status in ('supported','insufficient_evidence','conflicting')),
  unique (assessment_id, rubric_criterion_id)
);

create table if not exists public.interviewers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.interviewer_availability (
  id uuid primary key default gen_random_uuid(),
  interviewer_id uuid not null references public.interviewers(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  interviewer_id uuid not null references public.interviewers(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'proposed'
    check (status in ('proposed','confirmed','completed','declined','reschedule_requested','cancelled')),
  meeting_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.invitation_tokens (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  candidate_response text
    check (candidate_response in ('accept','decline','request_reschedule')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  recipient text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft','approved','queued','sent','failed')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_created_by on public.jobs(created_by);
create index if not exists idx_applications_job_id on public.applications(job_id);
create index if not exists idx_resume_files_application_id on public.resume_files(application_id);
create index if not exists idx_evidence_application_id on public.evidence(application_id);
create index if not exists idx_assessments_application_id on public.assessments(application_id);
create index if not exists idx_interviewers_job_id on public.interviewers(job_id);
create index if not exists idx_interviewer_availability_interviewer_id on public.interviewer_availability(interviewer_id);
create index if not exists idx_interviews_interviewer_time on public.interviews(interviewer_id, start_at, end_at);
create index if not exists idx_interviews_application_time on public.interviews(application_id, start_at, end_at);
create index if not exists idx_emails_interview_id on public.emails(interview_id);
create index if not exists idx_audit_logs_job_id_created_at on public.audit_logs(job_id, created_at desc);

-- IMPORTANT:
-- RLS is intentionally not enabled in this starter migration because safe policies
-- depend on the final workspace/auth model. Before any client access, enable RLS
-- and add policies. Sensitive mutations should run through authenticated server
-- routes with ownership checks. Add transaction-safe overlap prevention before
-- allowing interview confirmation.
