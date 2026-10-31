import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type FeedbackRecommendation =
  | "strong_yes"
  | "yes"
  | "mixed"
  | "no"
  | "strong_no";

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

const recommendations: FeedbackRecommendation[] = [
  "strong_yes",
  "yes",
  "mixed",
  "no",
  "strong_no",
];

async function verifyInterviewOwnership(
  interviewId: string,
  userId: string
) {
  const admin = createAdminClient();

  const { data: interview, error: interviewError } =
    await admin
      .from("interviews")
      .select(
        "id, job_id, application_id, interviewer_id, start_at, end_at, status, meeting_url"
      )
      .eq("id", interviewId)
      .maybeSingle();

  if (interviewError) {
    throw new Error(interviewError.message);
  }

  if (!interview) {
    return { error: "Interview not found.", status: 404 };
  }

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id")
    .eq("id", interview.job_id)
    .eq("created_by", userId)
    .maybeSingle();

  if (jobError) {
    throw new Error(jobError.message);
  }

  if (!job) {
    return { error: "Access denied.", status: 403 };
  }

  return { interview };
}

export async function GET(
  _request: NextRequest,
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

    const result = await verifyInterviewOwnership(id, user.id);

    if ("error" in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    const admin = createAdminClient();

    const { data: feedback, error } = await admin
      .from("interview_feedback")
      .select("*")
      .eq("interview_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        success: true,
        interview: result.interview,
        feedback: feedback || [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Load interview feedback error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load interview feedback.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
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

    const result = await verifyInterviewOwnership(id, user.id);

    if ("error" in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    const interview = result.interview;

    if (
      interview.status !== "confirmed" &&
      interview.status !== "completed"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Feedback can only be submitted after the candidate has accepted the interview.",
        },
        { status: 409 }
      );
    }

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const scores = [
      data.technicalScore,
      data.communicationScore,
      data.problemSolvingScore,
      data.roleFitScore,
    ];

    if (!scores.every(isValidScore)) {
      return NextResponse.json(
        {
          success: false,
          error: "All four ratings must be between 0 and 100.",
        },
        { status: 400 }
      );
    }

    if (
      typeof data.recommendation !== "string" ||
      !recommendations.includes(
        data.recommendation as FeedbackRecommendation
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Select a valid interview recommendation.",
        },
        { status: 400 }
      );
    }

    const strengths =
      typeof data.strengths === "string"
        ? data.strengths.trim().slice(0, 5000)
        : "";

    const concerns =
      typeof data.concerns === "string"
        ? data.concerns.trim().slice(0, 5000)
        : "";

    const notes =
      typeof data.notes === "string"
        ? data.notes.trim().slice(0, 10000)
        : "";

    const overallScore = Number(
      (
        (scores[0] +
          scores[1] +
          scores[2] +
          scores[3]) /
        4
      ).toFixed(2)
    );

    const now = new Date().toISOString();
    const admin = createAdminClient();

    // One feedback record per interview and interviewer.
    // A revised submission updates the existing record.

    const { data: feedback, error: feedbackError } =
      await admin
        .from("interview_feedback")
        .upsert(
          {
            interview_id: interview.id,
            application_id: interview.application_id,
            interviewer_id: interview.interviewer_id,
            created_by: user.id,
            technical_score: scores[0],
            communication_score: scores[1],
            problem_solving_score: scores[2],
            role_fit_score: scores[3],
            overall_score: overallScore,
            recommendation: data.recommendation,
            strengths,
            concerns,
            notes,
            updated_at: now,
          },
          {
            onConflict: "interview_id,interviewer_id",
          }
        )
        .select()
        .single();

    if (feedbackError || !feedback) {
      throw new Error(
        feedbackError?.message ||
          "Unable to save interview feedback."
      );
    }

    // Mark the interview completed after feedback is saved.

    let interviewStatusUpdated = true;

    if (interview.status !== "completed") {
      const { error: statusError } = await admin
        .from("interviews")
        .update({
          status: "completed",
          updated_at: now,
        })
        .eq("id", interview.id);

      if (statusError) {
        interviewStatusUpdated = false;
        console.error(
          "Interview completion status update failed:",
          statusError.message
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Interview feedback saved successfully.",
      feedback,
      overallScore,
      interviewStatusUpdated,
    });
  } catch (error) {
    console.error("Save interview feedback error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save interview feedback.",
      },
      { status: 500 }
    );
  }
}