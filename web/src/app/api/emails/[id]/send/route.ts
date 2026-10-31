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

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
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

    const admin = createAdminClient();

    const { data: email, error: emailError } = await admin
      .from("emails")
      .select(
        "id, interview_id, recipient, subject, body, status"
      )
      .eq("id", id)
      .maybeSingle();

    if (emailError) throw new Error(emailError.message);

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email draft not found." },
        { status: 404 }
      );
    }

    const { data: interview, error: interviewError } =
      await admin
        .from("interviews")
        .select("id, job_id")
        .eq("id", email.interview_id)
        .maybeSingle();

    if (interviewError) {
      throw new Error(interviewError.message);
    }

    if (!interview) {
      return NextResponse.json(
        { success: false, error: "Related interview not found." },
        { status: 404 }
      );
    }

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id")
      .eq("id", interview.job_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    if (email.status === "sent") {
      return NextResponse.json(
        { success: false, error: "This email has already been sent." },
        { status: 409 }
      );
    }

    if (email.status === "queued") {
      return NextResponse.json(
        { success: false, error: "This email is already being processed." },
        { status: 409 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
      return NextResponse.json(
        {
          success: false,
          error: "Configure RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local before sending email.",
        },
        { status: 503 }
      );
    }

    if (!validEmail(email.recipient)) {
      return NextResponse.json(
        { success: false, error: "The recipient email address is invalid." },
        { status: 400 }
      );
    }

    // Reserve this email before calling the provider,
    // preventing two concurrent send attempts.

    const now = new Date().toISOString();

    const { data: reserved, error: reserveError } = await admin
      .from("emails")
      .update({
        status: "queued",
        approved_by: user.id,
        approved_at: now,
        updated_at: now,
        failure_reason: null,
      })
      .eq("id", id)
      .in("status", ["draft", "approved", "failed"])
      .select("id")
      .maybeSingle();

    if (reserveError) throw new Error(reserveError.message);

    if (!reserved) {
      return NextResponse.json(
        {
          success: false,
          error: "This email is already being processed or has been sent.",
        },
        { status: 409 }
      );
    }

    let providerResponse: Response;

    try {
      providerResponse = await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `hiresync-email-${id}`,
          },
          body: JSON.stringify({
            from,
            to: [email.recipient],
            subject: email.subject,
            text: email.body,
          }),
        }
      );
    } catch (providerError) {
      const reason =
        providerError instanceof Error
          ? providerError.message
          : "Email provider connection failed.";

      await admin
        .from("emails")
        .update({
          status: "failed",
          failure_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      throw new Error(reason);
    }

    const providerData: unknown = await providerResponse
      .json()
      .catch(() => ({}));

    const providerResult =
      providerData &&
      typeof providerData === "object"
        ? providerData as Record<string, unknown>
        : {};

    if (!providerResponse.ok || typeof providerResult.id !== "string") {
      const reason =
        typeof providerResult.message === "string"
          ? providerResult.message
          : "Email provider rejected the message.";

      await admin
        .from("emails")
        .update({
          status: "failed",
          provider: "resend",
          failure_reason: reason.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json(
        { success: false, error: reason },
        { status: 502 }
      );
    }

    const sentAt = new Date().toISOString();

    const { error: saveError } = await admin
      .from("emails")
      .update({
        status: "sent",
        provider: "resend",
        provider_message_id: providerResult.id,
        sent_at: sentAt,
        failure_reason: null,
        updated_at: sentAt,
      })
      .eq("id", id);

    if (saveError) {
      console.error(
        "Email sent but database update failed:",
        saveError.message
      );

      return NextResponse.json(
        {
          success: true,
          message: "Email was accepted by Resend, but its database status needs reconciliation.",
          providerMessageId: providerResult.id,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email accepted by Resend for delivery.",
      provider: "resend",
      providerMessageId: providerResult.id,
      sentAt,
    });
  } catch (error) {
    console.error("Send email error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send email.",
      },
      { status: 500 }
    );
  }
}