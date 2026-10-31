import {
  connection,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await connection();

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please sign in." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const { data: jobs, error: jobsError } = await admin
      .from("jobs")
      .select("id, title")
      .eq("created_by", user.id);

    if (jobsError) throw new Error(jobsError.message);

    const jobIds = (jobs || []).map((item) => item.id);

    if (!jobIds.length) {
      return NextResponse.json({
        success: true,
        emails: [],
      });
    }

    const { data: interviews, error: interviewsError } =
      await admin
        .from("interviews")
        .select(
          "id, job_id, application_id, interviewer_id, start_at, status"
        )
        .in("job_id", jobIds);

    if (interviewsError) {
      throw new Error(interviewsError.message);
    }

    const interviewRows = interviews || [];
    const interviewIds = interviewRows.map((item) => item.id);

    if (!interviewIds.length) {
      return NextResponse.json({
        success: true,
        emails: [],
      });
    }

    const { data: emails, error: emailsError } = await admin
      .from("emails")
      .select(
        "id, interview_id, recipient, subject, body, status, provider, provider_message_id, sent_at, failure_reason, created_at, updated_at"
      )
      .in("interview_id", interviewIds)
      .order("created_at", { ascending: false });

    if (emailsError) throw new Error(emailsError.message);

    const applicationIds = [
      ...new Set(interviewRows.map((item) => item.application_id)),
    ];

    const interviewerIds = [
      ...new Set(interviewRows.map((item) => item.interviewer_id)),
    ];

    const [
      applicationsResult,
      interviewersResult,
    ] = await Promise.all([
      applicationIds.length
        ? admin
            .from("applications")
            .select("id, candidate_name")
            .in("id", applicationIds)
        : Promise.resolve({ data: [], error: null }),

      interviewerIds.length
        ? admin
            .from("interviewers")
            .select("id, name")
            .in("id", interviewerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (applicationsResult.error) {
      throw new Error(applicationsResult.error.message);
    }

    if (interviewersResult.error) {
      throw new Error(interviewersResult.error.message);
    }

    const jobMap = new Map(
      (jobs || []).map((item) => [item.id, item.title])
    );

    const interviewMap = new Map(
      interviewRows.map((item) => [item.id, item])
    );

    const candidateMap = new Map(
      (applicationsResult.data || []).map((item) => [
        item.id,
        item.candidate_name,
      ])
    );

    const interviewerMap = new Map(
      (interviewersResult.data || []).map((item) => [
        item.id,
        item.name,
      ])
    );

    const result = (emails || []).map((email) => {
      const interview = interviewMap.get(email.interview_id);

      return {
        ...email,
        candidateName: interview
          ? candidateMap.get(interview.application_id) || "Candidate"
          : "Candidate",
        interviewerName: interview
          ? interviewerMap.get(interview.interviewer_id) || "Interviewer"
          : "Interviewer",
        jobTitle: interview
          ? jobMap.get(interview.job_id) || "Job"
          : "Job",
        interviewStart: interview?.start_at || null,
        interviewStatus: interview?.status || "unknown",
      };
    });

    return NextResponse.json(
      { success: true, emails: result },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Email list error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load email records.",
      },
      { status: 500 }
    );
  }
}