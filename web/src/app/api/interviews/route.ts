import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ACTIVE_STATUSES = [
  "proposed",
  "confirmed",
  "reschedule_requested",
];

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    const { data: jobs, error: jobsError } = await admin
      .from("jobs")
      .select("id, title, timezone, status")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (jobsError) {
      throw new Error(jobsError.message);
    }

    const jobIds = (jobs || []).map((job) => job.id);

    if (jobIds.length === 0) {
      return NextResponse.json({
        success: true,
        jobs: [],
        applications: [],
        interviewers: [],
        availability: [],
        interviews: [],
      });
    }

    const [
      applicationsResult,
      interviewersResult,
      interviewsResult,
    ] = await Promise.all([
      admin
        .from("applications")
        .select(
          "id, job_id, candidate_name, candidate_email, processing_status"
        )
        .in("job_id", jobIds)
        .eq("processing_status", "processed")
        .order("created_at", { ascending: false }),

      admin
        .from("interviewers")
        .select("id, job_id, name, email")
        .in("job_id", jobIds)
        .order("name", { ascending: true }),

      admin
        .from("interviews")
        .select(
          "id, job_id, application_id, interviewer_id, start_at, end_at, status, meeting_url, created_at"
        )
        .in("job_id", jobIds)
        .order("start_at", { ascending: true }),
    ]);

    if (applicationsResult.error) {
      throw new Error(applicationsResult.error.message);
    }

    if (interviewersResult.error) {
      throw new Error(interviewersResult.error.message);
    }

    if (interviewsResult.error) {
      throw new Error(interviewsResult.error.message);
    }

    const interviewerIds = (
      interviewersResult.data || []
    ).map((item) => item.id);

    let availability: {
      id: string;
      interviewer_id: string;
      start_at: string;
      end_at: string;
    }[] = [];

    if (interviewerIds.length > 0) {
      const { data, error } = await admin
        .from("interviewer_availability")
        .select("id, interviewer_id, start_at, end_at")
        .in("interviewer_id", interviewerIds)
        .gte("end_at", new Date().toISOString())
        .order("start_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      availability = data || [];
    }

    return NextResponse.json(
      {
        success: true,
        jobs: jobs || [],
        applications: applicationsResult.data || [],
        interviewers: interviewersResult.data || [],
        availability,
        interviews: interviewsResult.data || [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Load scheduling data error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load scheduling data.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await connection();

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const jobId = String(body.jobId || "").trim();
    const applicationId = String(
      body.applicationId || ""
    ).trim();
    const interviewerId = String(
      body.interviewerId || ""
    ).trim();

    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    const now = new Date();

    if (
      !jobId ||
      !applicationId ||
      !interviewerId ||
      !Number.isFinite(startAt.getTime()) ||
      !Number.isFinite(endAt.getTime()) ||
      startAt <= now ||
      endAt <= startAt
    ) {
      return NextResponse.json(
        {
          error: "Select a candidate and interviewer and enter a valid future time.",
        },
        { status: 400 }
      );
    }

    const durationMinutes =
      (endAt.getTime() - startAt.getTime()) / 60000;

    if (durationMinutes < 15 || durationMinutes > 240) {
      return NextResponse.json(
        {
          error: "Interview duration must be between 15 minutes and 4 hours.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify job ownership.

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, title, status")
      .eq("id", jobId)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found or access denied." },
        { status: 404 }
      );
    }

    if (job.status === "archived") {
      return NextResponse.json(
        { error: "Cannot schedule interviews for an archived job." },
        { status: 409 }
      );
    }

    // Verify candidate belongs to this job.

    const { data: application, error: applicationError } =
      await admin
        .from("applications")
        .select("id, job_id, candidate_name, candidate_email, processing_status")
        .eq("id", applicationId)
        .eq("job_id", jobId)
        .maybeSingle();

    if (applicationError || !application) {
      return NextResponse.json(
        { error: "Candidate not found for this job." },
        { status: 404 }
      );
    }

    if (application.processing_status !== "processed") {
      return NextResponse.json(
        { error: "Candidate resume processing is not complete." },
        { status: 409 }
      );
    }

    // Verify interviewer belongs to the same job.

    const { data: interviewer, error: interviewerError } =
      await admin
        .from("interviewers")
        .select("id, job_id, name, email")
        .eq("id", interviewerId)
        .eq("job_id", jobId)
        .maybeSingle();

    if (interviewerError || !interviewer) {
      return NextResponse.json(
        { error: "Interviewer not found for this job." },
        { status: 404 }
      );
    }

    const startISO = startAt.toISOString();
    const endISO = endAt.toISOString();

    // Check that the entire interview falls inside
    // an availability period.

    const { data: available, error: availabilityError } =
      await admin
        .from("interviewer_availability")
        .select("id")
        .eq("interviewer_id", interviewerId)
        .lte("start_at", startISO)
        .gte("end_at", endISO)
        .limit(1)
        .maybeSingle();

    if (availabilityError) {
      throw new Error(availabilityError.message);
    }

    if (!available) {
      return NextResponse.json(
        {
          error: "The interviewer is not available for the entire selected time.",
        },
        { status: 409 }
      );
    }

    // Check interviewer conflicts.

    const { data: interviewerConflict, error: interviewerConflictError } =
      await admin
        .from("interviews")
        .select("id")
        .eq("interviewer_id", interviewerId)
        .in("status", ACTIVE_STATUSES)
        .lt("start_at", endISO)
        .gt("end_at", startISO)
        .limit(1)
        .maybeSingle();

    if (interviewerConflictError) {
      throw new Error(interviewerConflictError.message);
    }

    if (interviewerConflict) {
      return NextResponse.json(
        { error: "This interviewer already has an overlapping interview." },
        { status: 409 }
      );
    }

    // Check candidate conflicts.

    const { data: candidateConflict, error: candidateConflictError } =
      await admin
        .from("interviews")
        .select("id")
        .eq("application_id", applicationId)
        .in("status", ACTIVE_STATUSES)
        .lt("start_at", endISO)
        .gt("end_at", startISO)
        .limit(1)
        .maybeSingle();

    if (candidateConflictError) {
      throw new Error(candidateConflictError.message);
    }

    if (candidateConflict) {
      return NextResponse.json(
        { error: "This candidate already has an overlapping interview." },
        { status: 409 }
      );
    }

    // Create a unique Jitsi room.
    // meet.jit.si is the development default.
    // Configure JITSI_DOMAIN for your own Jitsi deployment.

    const configuredDomain =
      process.env.JITSI_DOMAIN || "meet.jit.si";

    const domain = configuredDomain
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");

    if (!/^[a-z0-9.-]+$/i.test(domain)) {
      throw new Error("JITSI_DOMAIN is invalid.");
    }

    const roomName = `hiresync-${randomUUID()}`;
    const meetingUrl = `https://${domain}/${roomName}`;

    const { data: interview, error: insertError } =
      await admin
        .from("interviews")
        .insert({
          job_id: jobId,
          application_id: applicationId,
          interviewer_id: interviewerId,
          start_at: startISO,
          end_at: endISO,
          status: "proposed",
          meeting_url: meetingUrl,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();

    if (insertError || !interview) {
      throw new Error(
        insertError?.message || "Unable to create interview."
      );
    }

    // Create a single-use candidate invitation token.
    // The plain token is returned only once to the HR user.
    // Supabase stores only its SHA-256 hash.

    const rawToken = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const tokenId = randomUUID();

    const expiresAt = new Date(
      endAt.getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: tokenError } = await admin
      .from("invitation_tokens")
      .insert({
        id: tokenId,
        interview_id: interview.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: now.toISOString(),
      });

    if (tokenError) {
      await admin
        .from("interviews")
        .delete()
        .eq("id", interview.id);

      throw new Error(
        `Unable to create candidate invitation: ${tokenError.message}`
      );
    }

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");

    const invitationUrl =
      `${appUrl}/invite/${rawToken}`;

    let emailDraftSaved = false;
    let emailDraftWarning: string | null = null;

    const recipient = String(
      application.candidate_email || ""
    )
      .trim()
      .toLowerCase();

    if (validEmail(recipient)) {
      const subject = `Interview invitation: ${job.title}`;

      const bodyText = [
        `Hello ${application.candidate_name || "Candidate"},`,
        "",
        `We would like to invite you to an interview for ${job.title}.`,
        "",
        `Scheduled start: ${startAt.toLocaleString()}`,
        `Scheduled end: ${endAt.toLocaleString()}`,
        `Interviewer: ${interviewer.name}`,
        "",
        "Please use the secure invitation link below to accept, decline or request a different time:",
        invitationUrl,
        "",
        "The video meeting link will be available through your invitation after confirmation.",
        "",
        "Regards,",
        "HireSync",
      ].join("\n");

      const { error: emailError } = await admin
        .from("emails")
        .insert({
          id: randomUUID(),
          interview_id: interview.id,
          recipient,
          subject,
          body: bodyText,
          status: "draft",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

      if (emailError) {
        emailDraftWarning =
          `Interview is scheduled, but email draft creation failed: ${emailError.message}`;
      } else {
        emailDraftSaved = true;
      }
    } else {
      emailDraftWarning =
        "The candidate has no valid email address. The invitation link is available for manual sharing.";
    }

    return NextResponse.json(
      {
        success: true,
        interview,
        invitationUrl,
        emailDraftSaved,
        emailDraftWarning,
        message:
          "Interview scheduled. Candidate invitation token created.",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Schedule interview error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to schedule interview.",
      },
      { status: 500 }
    );
  }
}