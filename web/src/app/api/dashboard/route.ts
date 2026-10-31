
import { connection, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const interviewStatuses = [
  "proposed",
  "confirmed",
  "reschedule_requested",
] as const;

export async function GET() {
  await connection();

  const apiKey = process.env.GEMINI_API_KEY;
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const now = new Date();
    const nextSevenDays = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    // Fetch real jobs, application counts and interview data.
    const [
      jobsResult,
      recentApplicationsResult,
      applicationsCountResult,
      shortlistedCountResult,
      pendingReviewCountResult,
      notShortlistedCountResult,
      interviewsCountResult,
      upcomingInterviewsResult,
    ] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, title, status, created_at")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("applications")
        .select(
          "id, job_id, candidate_name, candidate_email, processing_status, decision, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(6),

      supabase
        .from("applications")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("decision", "shortlisted"),

      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("decision", "pending_review"),

      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("decision", "not_shortlisted"),

      supabase
        .from("interviews")
        .select("id", { count: "exact", head: true })
        .gte("start_at", now.toISOString())
        .lte("start_at", nextSevenDays.toISOString())
        .in("status", [...interviewStatuses]),

      supabase
        .from("interviews")
        .select(
          "id, job_id, application_id, start_at, end_at, status, meeting_url"
        )
        .gte("start_at", now.toISOString())
        .lte("start_at", nextSevenDays.toISOString())
        .in("status", [...interviewStatuses])
        .order("start_at", { ascending: true })
        .limit(5),
    ]);

    const errors = [
      jobsResult.error,
      recentApplicationsResult.error,
      applicationsCountResult.error,
      shortlistedCountResult.error,
      pendingReviewCountResult.error,
      notShortlistedCountResult.error,
      interviewsCountResult.error,
      upcomingInterviewsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error(
        "Dashboard data retrieval failed:",
        errors.map((error) => error?.message)
      );

      return NextResponse.json(
        { error: "Unable to load dashboard data." },
        { status: 500 }
      );
    }

    const jobs = jobsResult.data ?? [];
    const applications = recentApplicationsResult.data ?? [];
    const interviews = upcomingInterviewsResult.data ?? [];

    // Get scores for recent candidates, if assessments exist.
    const applicationIds = applications.map((application) => application.id);

    const assessmentsResult =
      applicationIds.length > 0
        ? await supabase
            .from("assessments")
            .select("application_id, total_score, created_at")
            .in("application_id", applicationIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };

    if (assessmentsResult.error) {
      console.error(
        "Dashboard assessment retrieval failed:",
        assessmentsResult.error.message
      );

      return NextResponse.json(
        { error: "Unable to load assessment data." },
        { status: 500 }
      );
    }

    // Keep only the latest assessment for each application.
    const scoreByApplication = new Map<string, number | null>();

    for (const assessment of assessmentsResult.data ?? []) {
      if (!scoreByApplication.has(assessment.application_id)) {
        scoreByApplication.set(
          assessment.application_id,
          assessment.total_score === null
            ? null
            : Number(assessment.total_score)
        );
      }
    }

    const interviewApplicationIds = [
      ...new Set(interviews.map((interview) => interview.application_id)),
    ];

    const interviewApplicationsResult =
      interviewApplicationIds.length > 0
        ? await supabase
            .from("applications")
            .select("id, candidate_name, job_id")
            .in("id", interviewApplicationIds)
        : { data: [], error: null };

    if (interviewApplicationsResult.error) {
      console.error(
        "Dashboard interview candidate lookup failed:",
        interviewApplicationsResult.error.message
      );

      return NextResponse.json(
        { error: "Unable to load interview details." },
        { status: 500 }
      );
    }

    const jobById = new Map(
      jobs.map((job) => [job.id, job])
    );

    const applicationById = new Map<
      string,
      { candidate_name: string | null; job_id: string }
    >();

    for (const application of applications) {
      applicationById.set(application.id, {
        candidate_name: application.candidate_name,
        job_id: application.job_id,
      });
    }

    for (const application of interviewApplicationsResult.data ?? []) {
      applicationById.set(application.id, {
        candidate_name: application.candidate_name,
        job_id: application.job_id,
      });
    }

    const recentCandidates = applications.map((application) => {
      let status = "Under review";

      if (application.processing_status === "failed") {
        status = "Processing failed";
      } else if (application.processing_status !== "processed") {
        status = "Processing";
      } else if (application.decision === "shortlisted") {
        status = "Shortlisted";
      } else if (application.decision === "not_shortlisted") {
        status = "Not shortlisted";
      }

      return {
        id: application.id,
        name: application.candidate_name || "Name not extracted",
        email: application.candidate_email,
        jobTitle:
          jobById.get(application.job_id)?.title || "Position unavailable",
        score: scoreByApplication.get(application.id) ?? null,
        status,
        createdAt: application.created_at,
      };
    });

    const upcoming = interviews.map((interview) => {
      const application = applicationById.get(
        interview.application_id
      );

      return {
        id: interview.id,
        candidateName:
          application?.candidate_name || "Candidate",
        jobTitle:
          jobById.get(interview.job_id)?.title || "Position unavailable",
        startAt: interview.start_at,
        endAt: interview.end_at,
        status: interview.status,
        meetingUrl: interview.meeting_url,
      };
    });

    const activeJobs = jobs.filter(
      (job) => job.status === "active"
    ).length;

    return NextResponse.json(
      {
        metrics: {
          totalJobs: jobs.length,
          activeJobs,
          totalCandidates: applicationsCountResult.count ?? 0,
          shortlisted: shortlistedCountResult.count ?? 0,
          interviewsNextSevenDays:
            interviewsCountResult.count ?? 0,
        },

        pipeline: {
          pendingReview: pendingReviewCountResult.count ?? 0,
          shortlisted: shortlistedCountResult.count ?? 0,
          notShortlisted: notShortlistedCountResult.count ?? 0,
        },

        recentCandidates,
        upcomingInterviews: upcoming,

        recentJobs: jobs.slice(0, 5),
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      { error: "An unexpected dashboard error occurred." },
      { status: 500 }
    );
  }
}
