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
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: interviewer, error: interviewerError } =
      await admin
        .from("interviewers")
        .select("id, job_id")
        .eq("id", id)
        .maybeSingle();

    if (interviewerError || !interviewer) {
      return NextResponse.json(
        { error: "Interviewer not found." },
        { status: 404 }
      );
    }

    const { data: job } = await admin
      .from("jobs")
      .select("id")
      .eq("id", interviewer.job_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
      );
    }

    const { data, error } = await admin
      .from("interviewer_availability")
      .select("id, interviewer_id, start_at, end_at")
      .eq("interviewer_id", id)
      .gte("end_at", new Date().toISOString())
      .order("start_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      availability: data || [],
    });
  } catch (error) {
    console.error("Load availability error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load availability.",
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
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    const now = new Date();

    if (
      !Number.isFinite(startAt.getTime()) ||
      !Number.isFinite(endAt.getTime()) ||
      endAt <= startAt ||
      startAt <= now
    ) {
      return NextResponse.json(
        {
          error: "Enter a valid future availability period.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: interviewer, error: interviewerError } =
      await admin
        .from("interviewers")
        .select("id, job_id")
        .eq("id", id)
        .maybeSingle();

    if (interviewerError || !interviewer) {
      return NextResponse.json(
        { error: "Interviewer not found." },
        { status: 404 }
      );
    }

    const { data: job } = await admin
      .from("jobs")
      .select("id")
      .eq("id", interviewer.job_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (!job) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
      );
    }

    // Prevent overlapping availability records.

    const { data: overlap, error: overlapError } =
      await admin
        .from("interviewer_availability")
        .select("id")
        .eq("interviewer_id", id)
        .lt("start_at", endAt.toISOString())
        .gt("end_at", startAt.toISOString())
        .limit(1)
        .maybeSingle();

    if (overlapError) {
      throw new Error(overlapError.message);
    }

    if (overlap) {
      return NextResponse.json(
        {
          error: "This availability overlaps an existing slot.",
        },
        { status: 409 }
      );
    }

    const { data: availability, error } = await admin
      .from("interviewer_availability")
      .insert({
        interviewer_id: id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (error || !availability) {
      throw new Error(
        error?.message || "Unable to save availability."
      );
    }

    return NextResponse.json(
      {
        success: true,
        availability,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create availability error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save availability.",
      },
      { status: 500 }
    );
  }
}