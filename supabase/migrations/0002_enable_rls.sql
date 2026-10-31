
-- HireSync migration 0002
-- Enable Row Level Security and enforce job ownership.

-- 1. Enable RLS on all application tables.

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;


-- 2. Jobs: users can manage only their own jobs.

CREATE POLICY jobs_owner_all
ON public.jobs
FOR ALL TO authenticated
USING (created_by = (SELECT auth.uid()))
WITH CHECK (created_by = (SELECT auth.uid()));


-- 3. Rubric versions: access through the owning job.

CREATE POLICY rubric_versions_owner_all
ON public.rubric_versions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = rubric_versions.job_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = rubric_versions.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 4. Rubric criteria: access through rubric version and job.

CREATE POLICY rubric_criteria_owner_all
ON public.rubric_criteria
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rubric_versions rv
    JOIN public.jobs j ON j.id = rv.job_id
    WHERE rv.id = rubric_criteria.rubric_version_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rubric_versions rv
    JOIN public.jobs j ON j.id = rv.job_id
    WHERE rv.id = rubric_criteria.rubric_version_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 5. Applications: access through the owning job.

CREATE POLICY applications_owner_all
ON public.applications
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = applications.job_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = applications.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 6. Resume files: access through application and job.

CREATE POLICY resume_files_owner_all
ON public.resume_files
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = resume_files.application_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = resume_files.application_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 7. Extracted facts.

CREATE POLICY extracted_facts_owner_all
ON public.extracted_facts
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = extracted_facts.application_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = extracted_facts.application_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 8. Evidence.

CREATE POLICY evidence_owner_all
ON public.evidence
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = evidence.application_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = evidence.application_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 9. Assessments.

CREATE POLICY assessments_owner_all
ON public.assessments
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = assessments.application_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = assessments.application_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 10. Assessment criteria.

CREATE POLICY assessment_criteria_owner_all
ON public.assessment_criteria
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessments ass
    JOIN public.applications a ON a.id = ass.application_id
    JOIN public.jobs j ON j.id = a.job_id
    WHERE ass.id = assessment_criteria.assessment_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessments ass
    JOIN public.applications a ON a.id = ass.application_id
    JOIN public.jobs j ON j.id = a.job_id
    WHERE ass.id = assessment_criteria.assessment_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 11. Interviewers.

CREATE POLICY interviewers_owner_all
ON public.interviewers
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = interviewers.job_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = interviewers.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 12. Interviewer availability.

CREATE POLICY interviewer_availability_owner_all
ON public.interviewer_availability
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.interviewers i
    JOIN public.jobs j ON j.id = i.job_id
    WHERE i.id = interviewer_availability.interviewer_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.interviewers i
    JOIN public.jobs j ON j.id = i.job_id
    WHERE i.id = interviewer_availability.interviewer_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 13. Interviews.

CREATE POLICY interviews_owner_all
ON public.interviews
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = interviews.job_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = interviews.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 14. Invitation tokens are server-only.
-- Intentionally no authenticated or anonymous policies.


-- 15. Emails.

CREATE POLICY emails_owner_all
ON public.emails
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.interviews i
    JOIN public.jobs j ON j.id = i.job_id
    WHERE i.id = emails.interview_id
      AND j.created_by = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.interviews i
    JOIN public.jobs j ON j.id = i.job_id
    WHERE i.id = emails.interview_id
      AND j.created_by = (SELECT auth.uid())
  )
);


-- 16. Audit logs: users may read their own job logs.
-- Writes should be performed by trusted server-side code.

CREATE POLICY audit_logs_owner_select
ON public.audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = audit_logs.job_id
      AND j.created_by = (SELECT auth.uid())
  )
);
