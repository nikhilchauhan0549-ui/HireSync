import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
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

    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "A job ID is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found or access denied." },
        { status: 404 }
      );
    }

    const { data, error } = await admin
      .from("interviewers")
      .select("id, job_id, name, email, created_at")
      .eq("job_id", jobId)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      interviewers: data || [],
    });
  } catch (error) {
    console.error("Load interviewers error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load interviewers.",
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

    const jobId =
      typeof body.jobId === "string"
        ? body.jobId.trim()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!jobId || !name || !email) {
      return NextResponse.json(
        {
          error: "Job, interviewer name and email are required.",
        },
        { status: 400 }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Enter a valid interviewer email address." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, status")
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
        { error: "Cannot add interviewers to an archived job." },
        { status: 409 }
      );
    }

    const { data: interviewer, error } = await admin
      .from("interviewers")
      .insert({
        job_id: jobId,
        name,
        email,
        created_at: new Date().toISOString(),
      })
      .select("id, job_id, name, email, created_at")
      .single();

    if (error || !interviewer) {
      throw new Error(
        error?.message || "Unable to create interviewer."
      );
    }

    return NextResponse.json(
      {
        success: true,
        interviewer,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create interviewer error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create interviewer.",
      },
      { status: 500 }
    );
  }
}