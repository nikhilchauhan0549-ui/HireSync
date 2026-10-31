
BEGIN;

-- Keep job management available to authenticated owners.
DROP POLICY IF EXISTS jobs_owner_all ON public.jobs;

CREATE POLICY jobs_owner_all
ON public.jobs
FOR ALL TO authenticated
USING (created_by = (SELECT auth.uid()))
WITH CHECK (created_by = (SELECT auth.uid()));


-- Remove broad write permissions from other tables.

DROP POLICY IF EXISTS rubric_versions_owner_all ON public.rubric_versions;
DROP POLICY IF EXISTS rubric_criteria_owner_all ON public.rubric_criteria;
DROP POLICY IF EXISTS applications_owner_all ON public.applications;
DROP POLICY IF EXISTS resume_files_owner_all ON public.resume_files;
DROP POLICY IF EXISTS extracted_facts_owner_all ON public.extracted_facts;
DROP POLICY IF EXISTS evidence_owner_all ON public.evidence;
DROP POLICY IF EXISTS assessments_owner_all ON public.assessments;
DROP POLICY IF EXISTS assessment_criteria_owner_all ON public.assessment_criteria;
DROP POLICY IF EXISTS interviewers_owner_all ON public.interviewers;
DROP POLICY IF EXISTS interviewer_availability_owner_all ON public.interviewer_availability;
DROP POLICY IF EXISTS interviews_owner_all ON public.interviews;
DROP POLICY IF EXISTS emails_owner_all ON public.emails;
DROP POLICY IF EXISTS audit_logs_owner_select ON public.audit_logs;


-- Rubric versions: read own job's rubrics.

CREATE POLICY rubric_versions_owner_read
ON public.rubric_versions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = rubric_versions.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Rubric criteria: read through owning job.

CREATE POLICY rubric_criteria_owner_read
ON public.rubric_criteria
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rubric_versions rv
    JOIN public.jobs j ON j.id = rv.job_id
    WHERE rv.id = rubric_criteria.rubric_version_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Applications.

CREATE POLICY applications_owner_read
ON public.applications
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = applications.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Resume files.

CREATE POLICY resume_files_owner_read
ON public.resume_files
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = resume_files.application_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Extracted facts.

CREATE POLICY extracted_facts_owner_read
ON public.extracted_facts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = extracted_facts.application_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Evidence.

CREATE POLICY evidence_owner_read
ON public.evidence
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = evidence.application_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Assessments.

CREATE POLICY assessments_owner_read
ON public.assessments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = assessments.application_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Assessment criteria.

CREATE POLICY assessment_criteria_owner_read
ON public.assessment_criteria
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessments ass
    JOIN public.applications a ON a.id = ass.application_id
    JOIN public.jobs j ON j.id = a.job_id
    WHERE ass.id = assessment_criteria.assessment_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Interviewers.

CREATE POLICY interviewers_owner_read
ON public.interviewers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = interviewers.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Interviewer availability.

CREATE POLICY interviewer_availability_owner_read
ON public.interviewer_availability
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.interviewers i
    JOIN public.jobs j ON j.id = i.job_id
    WHERE i.id = interviewer_availability.interviewer_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Interviews.

CREATE POLICY interviews_owner_read
ON public.interviews
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = interviews.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Emails.

CREATE POLICY emails_owner_read
ON public.emails
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.interviews i
    JOIN public.jobs j ON j.id = i.job_id
    WHERE i.id = emails.interview_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- Audit logs: read own job's logs only.

CREATE POLICY audit_logs_owner_read
ON public.audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = audit_logs.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);

COMMIT;
