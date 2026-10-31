import {
  connection,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
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

    const { id } = await context.params;

    const admin = createAdminClient();

    const { data: interview, error } = await admin
      .from("interviews")
      .select(
        "id, job_id, application_id, interviewer_id, start_at, end_at, status, meeting_url"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Interview not found." },
        { status: 404 }
      );
    }

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, title")
      .eq("id", interview.job_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    if (
      interview.status !== "confirmed" &&
      interview.status !== "completed"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "The candidate must accept the interview before the video room opens.",
        },
        { status: 409 }
      );
    }

    if (!interview.meeting_url) {
      return NextResponse.json(
        { success: false, error: "No video meeting link is configured." },
        { status: 404 }
      );
    }

    const [
      { data: candidate, error: candidateError },
      { data: interviewer, error: interviewerError },
    ] = await Promise.all([
      admin
        .from("applications")
        .select("candidate_name")
        .eq("id", interview.application_id)
        .maybeSingle(),

      admin
        .from("interviewers")
        .select("name")
        .eq("id", interview.interviewer_id)
        .maybeSingle(),
    ]);

    if (candidateError || interviewerError) {
      throw new Error(
        candidateError?.message ||
        interviewerError?.message ||
        "Unable to load interview participants."
      );
    }

    return NextResponse.json(
      {
        success: true,
        meeting: {
          id: interview.id,
          jobTitle: job.title,
          candidateName:
            candidate?.candidate_name || "Candidate",
          interviewerName:
            interviewer?.name || "Interviewer",
          startAt: interview.start_at,
          endAt: interview.end_at,
          status: interview.status,
          meetingUrl: interview.meeting_url,
          displayName:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : user.email || interviewer?.name || "Interviewer",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Load interviewer video room error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load video meeting.",
      },
      { status: 500 }
    );
  }
}