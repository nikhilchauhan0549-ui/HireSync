
import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  randomBytes,
} from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ACTIVE_STATUSES = [
  "proposed",
  "confirmed",
  "reschedule_requested",
];

const RESCHEDULABLE_STATUSES = [
  "proposed",
  "confirmed",
  "reschedule_requested",
];

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  await connection();

  try {
    // 1. Authenticate the HR user.

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Please sign in.", 401);
    }

    // 2. Validate the interview ID.

    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return errorResponse("Invalid interview ID.", 400);
    }

    // 3. Validate request body.

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return errorResponse("Invalid request body.", 400);
    }

    const payload = body as Record<string, unknown>;
    const action = payload.action;

    if (action !== "cancel" && action !== "reschedule") {
      return errorResponse(
        "Action must be cancel or reschedule.",
        400
      );
    }

    const admin = createAdminClient();

    // 4. Load the interview.

    const { data: interview, error: interviewError } =
      await admin
        .from("interviews")
        .select(
          "id, job_id, application_id, interviewer_id, start_at, end_at, status, meeting_url"
        )
        .eq("id", id)
        .maybeSingle();

    if (interviewError) {
      throw new Error(interviewError.message);
    }

    if (!interview) {
      return errorResponse("Interview not found.", 404);
    }

    // 5. Verify that the signed-in HR user owns the job.

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, title, status, created_by")
      .eq("id", interview.job_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError) {
      throw new Error(jobError.message);
    }

    if (!job) {
      return errorResponse("Access denied.", 403);
    }

    if (action === "cancel") {
      if (interview.status === "cancelled") {
        return NextResponse.json({
          success: true,
          message: "This interview is already cancelled.",
          interview,
        });
      }

      if (!RESCHEDULABLE_STATUSES.includes(interview.status)) {
        return errorResponse(
          "Only proposed, confirmed or reschedule-requested interviews can be cancelled.",
          409
        );
      }

      const now = new Date().toISOString();

      // 6. Mark the interview as cancelled.

      const { data: cancelledInterview, error: cancelError } =
        await admin
          .from("interviews")
          .update({
            status: "cancelled",
            updated_at: now,
          })
          .eq("id", id)
          .select()
          .single();

      if (cancelError || !cancelledInterview) {
        throw new Error(
          cancelError?.message || "Unable to cancel interview."
        );
      }

      // 7. Invalidate any unused candidate invitation tokens.

      const { error: tokenError } = await admin
        .from("invitation_tokens")
        .update({
          used_at: now,
        })
        .eq("interview_id", id)
        .is("used_at", null);

      if (tokenError) {
        console.error(
          "Interview cancelled but invitation token invalidation failed:",
          tokenError.message
        );

        return NextResponse.json({
          success: true,
          interview: cancelledInterview,
          warning:
            "Interview was cancelled, but an unused invitation token could not be invalidated.",
          message: "Interview cancelled.",
        });
      }

      return NextResponse.json(
        {
          success: true,
          interview: cancelledInterview,
          message:
            "Interview cancelled. Unused invitation links have been invalidated.",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // RESCHEDULE WORKFLOW

    // 8. Validate the requested new time.

    if (!RESCHEDULABLE_STATUSES.includes(interview.status)) {
      return errorResponse(
        "Only proposed, confirmed or reschedule-requested interviews can be rescheduled.",
        409
      );
    }

    const startAt =
      typeof payload.startAt === "string"
        ? new Date(payload.startAt)
        : new Date("invalid");

    const endAt =
      typeof payload.endAt === "string"
        ? new Date(payload.endAt)
        : new Date("invalid");

    const now = new Date();

    if (
      !Number.isFinite(startAt.getTime()) ||
      !Number.isFinite(endAt.getTime()) ||
      startAt <= now ||
      endAt <= startAt
    ) {
      return errorResponse(
        "Enter a valid future interview start and end time.",
        400
      );
    }

    const durationMinutes =
      (endAt.getTime() - startAt.getTime()) / 60000;

    if (durationMinutes < 15 || durationMinutes > 240) {
      return errorResponse(
        "Interview duration must be between 15 minutes and 4 hours.",
        400
      );
    }

    if (job.status === "archived") {
      return errorResponse(
        "Cannot reschedule an interview for an archived job.",
        409
      );
    }

    const startISO = startAt.toISOString();
    const endISO = endAt.toISOString();

    // 9. Verify candidate and interviewer details.

    const [
      applicationResult,
      interviewerResult,
    ] = await Promise.all([
      admin
        .from("applications")
        .select(
          "id, job_id, candidate_name, candidate_email, processing_status"
        )
        .eq("id", interview.application_id)
        .eq("job_id", interview.job_id)
        .maybeSingle(),

      admin
        .from("interviewers")
        .select("id, job_id, name, email")
        .eq("id", interview.interviewer_id)
        .eq("job_id", interview.job_id)
        .maybeSingle(),
    ]);

    if (applicationResult.error) {
      throw new Error(applicationResult.error.message);
    }

    if (interviewerResult.error) {
      throw new Error(interviewerResult.error.message);
    }

    const application = applicationResult.data;
    const interviewer = interviewerResult.data;

    if (!application) {
      return errorResponse("Candidate not found.", 404);
    }

    if (!interviewer) {
      return errorResponse("Interviewer not found.", 404);
    }

    if (application.processing_status !== "processed") {
      return errorResponse(
        "Candidate resume processing is not complete.",
        409
      );
    }

    // 10. Verify interviewer availability.

    const { data: available, error: availabilityError } =
      await admin
        .from("interviewer_availability")
        .select("id")
        .eq("interviewer_id", interview.interviewer_id)
        .lte("start_at", startISO)
        .gte("end_at", endISO)
        .limit(1)
        .maybeSingle();

    if (availabilityError) {
      throw new Error(availabilityError.message);
    }

    if (!available) {
      return errorResponse(
        "The interviewer is not available for the entire selected time.",
        409
      );
    }

    // 11. Prevent overlapping interviewer appointments.
    // Exclude the current interview from the conflict check.

    const { data: interviewerConflict, error: interviewerConflictError } =
      await admin
        .from("interviews")
        .select("id")
        .eq("interviewer_id", interview.interviewer_id)
        .neq("id", id)
        .in("status", ACTIVE_STATUSES)
        .lt("start_at", endISO)
        .gt("end_at", startISO)
        .limit(1)
        .maybeSingle();

    if (interviewerConflictError) {
      throw new Error(interviewerConflictError.message);
    }

    if (interviewerConflict) {
      return errorResponse(
        "This interviewer already has an overlapping interview.",
        409
      );
    }

    // 12. Prevent overlapping candidate appointments.

    const { data: candidateConflict, error: candidateConflictError } =
      await admin
        .from("interviews")
        .select("id")
        .eq("application_id", interview.application_id)
        .neq("id", id)
        .in("status", ACTIVE_STATUSES)
        .lt("start_at", endISO)
        .gt("end_at", startISO)
        .limit(1)
        .maybeSingle();

    if (candidateConflictError) {
      throw new Error(candidateConflictError.message);
    }

    if (candidateConflict) {
      return errorResponse(
        "This candidate already has an overlapping interview.",
        409
      );
    }

    // 13. Update the existing interview record.
    // Keep the same interview ID and meeting room.
    // Require a fresh candidate acceptance.

    const { data: updatedInterview, error: updateError } =
      await admin
        .from("interviews")
        .update({
          start_at: startISO,
          end_at: endISO,
          status: "proposed",
          updated_at: now.toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

    if (updateError || !updatedInterview) {
      throw new Error(
        updateError?.message || "Unable to update interview."
      );
    }

    // 14. Create a fresh single-use invitation token.

    const rawToken = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(
      endAt.getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: tokenInsertError } = await admin
      .from("invitation_tokens")
      .insert({
        interview_id: id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: now.toISOString(),
      });

    if (tokenInsertError) {
      // Roll back the time change if the invitation cannot be created.

      const { error: rollbackError } = await admin
        .from("interviews")
        .update({
          start_at: interview.start_at,
          end_at: interview.end_at,
          status: interview.status,
          updated_at: now.toISOString(),
        })
        .eq("id", id);

      if (rollbackError) {
        console.error(
          "Interview reschedule rollback failed:",
          rollbackError.message
        );
      }

      throw new Error(
        `Unable to create revised candidate invitation: ${tokenInsertError.message}`
      );
    }

    // 15. Invalidate previous unused invitation tokens.

    let warning: string | null = null;

    const { error: revokeError } = await admin
      .from("invitation_tokens")
      .update({
        used_at: now.toISOString(),
      })
      .eq("interview_id", id)
      .neq("token_hash", tokenHash)
      .is("used_at", null);

    if (revokeError) {
      console.error(
        "Unable to invalidate earlier interview invitation tokens:",
        revokeError.message
      );

      warning =
        "The interview was rescheduled, but some previous unused invitation tokens may remain valid.";
    }

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");

    const invitationUrl =
      `${appUrl}/invite/${rawToken}`;

    // 16. Add a new email draft, when the candidate has a valid email.

    const recipient = String(
      application.candidate_email || ""
    )
      .trim()
      .toLowerCase();

    let emailDraftSaved = false;

    if (validEmail(recipient)) {
      const subject =
        `Rescheduled interview: ${job.title}`;

      const emailBody = [
        `Hello ${application.candidate_name || "Candidate"},`,
        "",
        `Your interview for ${job.title} has been rescheduled.`,
        "",
        `New start: ${startAt.toISOString()}`,
        `New end: ${endAt.toISOString()}`,
        `Interviewer: ${interviewer.name}`,
        "",
        "Please review and accept the revised invitation using this link:",
        invitationUrl,
        "",
        "The video meeting link will be available after you accept.",
        "",
        "Regards,",
        "HireSync",
      ].join("\n");

      const { error: emailError } = await admin
        .from("emails")
        .insert({
          interview_id: id,
          recipient,
          subject,
          body: emailBody,
          status: "draft",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

      if (emailError) {
        console.error(
          "Rescheduled interview email draft error:",
          emailError.message
        );

        warning = warning
          ? `${warning} Email draft creation also failed.`
          : "Interview rescheduled, but the email draft could not be created.";
      } else {
        emailDraftSaved = true;
      }
    } else {
      warning = warning
        ? `${warning} Candidate email is missing or invalid.`
        : "Candidate email is missing or invalid. Share the new invitation link manually.";
    }

    // 17. Return revised interview and invitation details.

    return NextResponse.json(
      {
        success: true,
        message:
          "Interview rescheduled. The candidate must accept the revised invitation.",
        interview: updatedInterview,
        invitationUrl,
        emailDraftSaved,
        warning,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Interview management error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update interview.",
      },
      { status: 500 }
    );
  }
}
