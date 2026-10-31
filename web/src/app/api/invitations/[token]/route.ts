import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type CandidateResponse =
  | "accept"
  | "decline"
  | "request_reschedule";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const validToken = (token: string) =>
  /^[a-f0-9]{64}$/i.test(token);

async function loadInvitation(token: string) {
  if (!validToken(token)) {
    return { error: "Invalid invitation link.", status: 400 };
  }

  const admin = createAdminClient();

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const { data: invitationToken, error: tokenError } =
    await admin
      .from("invitation_tokens")
      .select(
        "id, interview_id, expires_at, used_at, candidate_response"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

  if (tokenError) {
    throw new Error(tokenError.message);
  }

  if (!invitationToken) {
    return { error: "Invitation not found.", status: 404 };
  }

  if (
    new Date(invitationToken.expires_at).getTime() <=
    Date.now()
  ) {
    return { error: "This invitation has expired.", status: 410 };
  }

  const { data: interview, error: interviewError } =
    await admin
      .from("interviews")
      .select(
        "id, job_id, application_id, interviewer_id, start_at, end_at, status, meeting_url"
      )
      .eq("id", invitationToken.interview_id)
      .maybeSingle();

  if (interviewError) {
    throw new Error(interviewError.message);
  }

  if (!interview) {
    return { error: "The interview no longer exists.", status: 404 };
  }

  const [
    { data: candidate, error: candidateError },
    { data: job, error: jobError },
    { data: interviewer, error: interviewerError },
  ] = await Promise.all([
    admin
      .from("applications")
      .select("candidate_name")
      .eq("id", interview.application_id)
      .maybeSingle(),

    admin
      .from("jobs")
      .select("title")
      .eq("id", interview.job_id)
      .maybeSingle(),

    admin
      .from("interviewers")
      .select("name")
      .eq("id", interview.interviewer_id)
      .maybeSingle(),
  ]);

  if (candidateError || jobError || interviewerError) {
    throw new Error(
      candidateError?.message ||
      jobError?.message ||
      interviewerError?.message ||
      "Unable to load interview details."
    );
  }

  return {
    invitation: {
      candidateName: candidate?.candidate_name || "Candidate",
      jobTitle: job?.title || "Interview",
      interviewerName: interviewer?.name || "Interviewer",
      startAt: interview.start_at,
      endAt: interview.end_at,
      status: interview.status,
      response: invitationToken.candidate_response,
      expiresAt: invitationToken.expires_at,
      // Only reveal the meeting URL after acceptance.
      meetingUrl:
        interview.status === "confirmed"
          ? interview.meeting_url
          : null,
      canRespond:
        !invitationToken.used_at &&
        !invitationToken.candidate_response &&
        interview.status === "proposed",
    },
  };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  await connection();

  try {
    const { token } = await context.params;
    const result = await loadInvitation(token);

    if ("error" in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        invitation: result.invitation,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Load candidate invitation error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load this invitation.",
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
    const { token } = await context.params;

    if (!validToken(token)) {
      return NextResponse.json(
        { success: false, error: "Invalid invitation link." },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();

if (
  !body ||
  typeof body !== "object" ||
  Array.isArray(body)
) {
  return NextResponse.json(
    { success: false, error: "Invalid request." },
    { status: 400 }
  );
}

const actionValue = (body as Record<string, unknown>).action;

const allowedActions: CandidateResponse[] = [
  "accept",
  "decline",
  "request_reschedule",
];

if (
  typeof actionValue !== "string" ||
  !allowedActions.includes(actionValue as CandidateResponse)
) {
  return NextResponse.json(
    { success: false, error: "Invalid candidate response." },
    { status: 400 }
  );
}

const action: CandidateResponse =
  actionValue as CandidateResponse;
    if (
      action !== "accept" &&
      action !== "decline" &&
      action !== "request_reschedule"
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid candidate response." },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = createAdminClient();

    const { data: invitationToken, error: tokenError } =
      await admin
        .from("invitation_tokens")
        .select(
          "id, interview_id, expires_at, used_at, candidate_response"
        )
        .eq("token_hash", tokenHash)
        .maybeSingle();

    if (tokenError) {
      throw new Error(tokenError.message);
    }

    if (!invitationToken) {
      return NextResponse.json(
        { success: false, error: "Invitation not found." },
        { status: 404 }
      );
    }

    if (
      new Date(invitationToken.expires_at).getTime() <=
      Date.now()
    ) {
      return NextResponse.json(
        { success: false, error: "This invitation has expired." },
        { status: 410 }
      );
    }

    if (
      invitationToken.used_at ||
      invitationToken.candidate_response
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A response has already been submitted for this invitation.",
        },
        { status: 409 }
      );
    }

    const statusByAction: Record<CandidateResponse, string> = {
  accept: "confirmed",
  decline: "declined",
  request_reschedule: "reschedule_requested",
}; 
    const now = new Date().toISOString();

    // Consume the one-time token first.

    const { data: consumedToken, error: consumeError } =
      await admin
        .from("invitation_tokens")
        .update({
          candidate_response: action,
          responded_at: now,
          used_at: now,
        })
        .eq("id", invitationToken.id)
        .is("used_at", null)
        .is("candidate_response", null)
        .select("id")
        .maybeSingle();

    if (consumeError) {
      throw new Error(consumeError.message);
    }

    if (!consumedToken) {
      return NextResponse.json(
        {
          success: false,
          error: "This invitation has already been answered.",
        },
        { status: 409 }
      );
    }

    // Update the interview status.

    const { error: interviewUpdateError } = await admin
      .from("interviews")
      .update({
        status: statusByAction[action],
        updated_at: now,
      })
      .eq("id", invitationToken.interview_id)
      .eq("status", "proposed");

    if (interviewUpdateError) {
      // Restore the token so the candidate can retry.

      await admin
        .from("invitation_tokens")
        .update({
          candidate_response: null,
          responded_at: null,
          used_at: null,
        })
        .eq("id", invitationToken.id);

      throw new Error(interviewUpdateError.message);
    }

    return NextResponse.json({
      success: true,
      message:
        action === "accept"
          ? "Interview accepted."
          : action === "decline"
            ? "Interview declined."
            : "Reschedule request submitted.",
      status: statusByAction[action],
    });
  } catch (error) {
    console.error("Candidate invitation response error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit your response.",
      },
      { status: 500 }
    );
  }
}