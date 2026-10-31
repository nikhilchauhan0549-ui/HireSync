
import { randomUUID } from "node:crypto";
import { connection, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  _request: Request,
  context: RouteContext
) {
  await connection();

  try {
    // 1. Authenticate the interviewer.
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

    // 2. Find the interview.
    const { data: interview, error: interviewError } = await admin
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
      return NextResponse.json(
        { success: false, error: "Interview not found." },
        { status: 404 }
      );
    }

    // 3. Verify that the signed-in user owns the job.
    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, title, created_by, timezone")
      .eq("id", interview.job_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError) {
      throw new Error(jobError.message);
    }

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    // 4. Only send details for confirmed or completed interviews.
    if (!["confirmed", "completed"].includes(interview.status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Meeting details can only be sent for confirmed interviews.",
        },
        { status: 400 }
      );
    }

    if (!interview.meeting_url) {
      return NextResponse.json(
        { success: false, error: "No video meeting link exists." },
        { status: 400 }
      );
    }

    // 5. Validate and extract the Jitsi room ID.
    const meetingUrl = new URL(interview.meeting_url);

    if (
      meetingUrl.protocol !== "https:" ||
      !meetingUrl.hostname.endsWith("jit.si")
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid Jitsi meeting link." },
        { status: 400 }
      );
    }

    const roomId = meetingUrl.pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent)
      .join("/");

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: "Meeting room ID is missing." },
        { status: 400 }
      );
    }

    // 6. Get the candidate's saved email.
    const { data: candidate, error: candidateError } = await admin
      .from("applications")
      .select("id, candidate_name, candidate_email")
      .eq("id", interview.application_id)
      .maybeSingle();

    if (candidateError) {
      throw new Error(candidateError.message);
    }

    if (!candidate || !candidate.candidate_email) {
      return NextResponse.json(
        {
          success: false,
          error: "The candidate does not have an email address saved.",
        },
        { status: 400 }
      );
    }

    const recipient = candidate.candidate_email.trim();

    if (!validEmail(recipient)) {
      return NextResponse.json(
        { success: false, error: "Candidate email address is invalid." },
        { status: 400 }
      );
    }

    // 7. Get the interviewer.
    const { data: interviewer, error: interviewerError } = await admin
      .from("interviewers")
      .select("name")
      .eq("id", interview.interviewer_id)
      .maybeSingle();

    if (interviewerError) {
      throw new Error(interviewerError.message);
    }

    const candidateName = candidate.candidate_name || "Candidate";
    const interviewerName = interviewer?.name || "Your interviewer";

    const subject = `Video interview details: ${job.title}`;

    // 8. Prevent repeat emails when an email is already sent or queued.
    const { data: existingEmails, error: existingError } = await admin
      .from("emails")
      .select("id, status")
      .eq("interview_id", interview.id)
      .eq("recipient", recipient)
      .eq("subject", subject)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existing = existingEmails?.[0];

    if (existing?.status === "sent") {
      return NextResponse.json({
        success: true,
        alreadySent: true,
        message:
          "Meeting details have already been sent to this candidate.",
      });
    }

    if (existing?.status === "queued") {
      return NextResponse.json(
        {
          success: false,
          error: "This meeting email is already being sent.",
        },
        { status: 409 }
      );
    }

    // Reuse an existing draft rather than creating another one.
    if (existing?.status === "draft") {
      return NextResponse.json({
        success: true,
        emailId: existing.id,
        alreadySent: false,
        message: "Meeting email draft is ready.",
      });
    }

    // 9. Format the scheduled time.
    const timezone = job.timezone || "Asia/Kolkata";

    let scheduledTime: string;

    try {
      scheduledTime = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: timezone,
      }).format(new Date(interview.start_at));
    } catch {
      scheduledTime = new Date(interview.start_at).toLocaleString("en-IN");
    }

    // 10. Prepare the email body.
    const bodyText = [
      `Hello ${candidateName},`,
      "",
      "Your video interview details are ready.",
      "",
      `Position: ${job.title}`,
      `Interviewer: ${interviewerName}`,
      `Interview date and time: ${scheduledTime}`,
      `Time zone: ${timezone}`,
      "",
      `Meeting room ID: ${roomId}`,
      `Join video interview: ${interview.meeting_url}`,
      "",
      "Please open the meeting link at the scheduled time.",
      "Allow access to your camera and microphone when prompted.",
      "",
      "We look forward to meeting you.",
      "",
      "Regards,",
      "HireSync Recruitment Team",
    ].join("\n");

    // 11. Save the draft in the existing emails table.
    const now = new Date().toISOString();

    const { data: savedEmail, error: insertError } = await admin
      .from("emails")
      .insert({
        id: randomUUID(),
        interview_id: interview.id,
        recipient,
        subject,
        body: bodyText,
        status: "draft",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json(
      {
        success: true,
        emailId: savedEmail.id,
        alreadySent: false,
        message: "Meeting email prepared successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Meeting email preparation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare meeting email.",
      },
      { status: 500 }
    );
  }
}
