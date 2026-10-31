
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TimeWindow = {
  day_of_week: number;
  start: string;
  end: string;
};

type JobStatus = "draft" | "active" | "archived";

function isValidDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function normalizeSkills(value: unknown): string[] | null {
  if (value === undefined) return [];

  if (
    !Array.isArray(value) ||
    value.length > 30 ||
    !value.every(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0 &&
        item.trim().length <= 80
    )
  ) {
    return null;
  }

  return [...new Set(value.map((item: string) => item.trim()))];
}

function validateTimeWindows(value: unknown): TimeWindow[] | null {
  if (value === undefined) return [];

  if (!Array.isArray(value) || value.length > 42) {
    return null;
  }

  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;

  const windows: TimeWindow[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;

    const window = item as Record<string, unknown>;

    if (
      !Number.isInteger(window.day_of_week) ||
      Number(window.day_of_week) < 0 ||
      Number(window.day_of_week) > 6 ||
      typeof window.start !== "string" ||
      typeof window.end !== "string" ||
      !validTime.test(window.start) ||
      !validTime.test(window.end) ||
      window.start >= window.end
    ) {
      return null;
    }

    windows.push({
      day_of_week: Number(window.day_of_week),
      start: window.start,
      end: window.end,
    });
  }

  return windows;
}

function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 100) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    });

    return true;
  } catch {
    return false;
  }
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase: null,
      user: null,
    };
  }

  return {
    supabase,
    user,
  };
}

// GET /api/jobs
// Retrieve jobs belonging to the authenticated HR user.

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    if (!supabase || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        title,
        description,
        required_skills,
        preferred_skills,
        interview_duration_minutes,
        buffer_minutes,
        interview_capacity,
        date_start,
        date_end,
        timezone,
        working_hours,
        breaks,
        status,
        created_at,
        updated_at
      `)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Job retrieval failed:", error.message);

      return NextResponse.json(
        { error: "Unable to retrieve jobs." },
        { status: 500 }
      );
    }

    return NextResponse.json({ jobs: data });
  } catch (error) {
    console.error("Jobs GET error:", error);

    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}

// POST /api/jobs
// Create a new job for the authenticated HR user.

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    if (!supabase || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return NextResponse.json(
        { error: "Invalid job details." },
        { status: 400 }
      );
    }

    const body = payload as Record<string, unknown>;

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (title.length < 3 || title.length > 120) {
      return NextResponse.json(
        { error: "Job title must contain between 3 and 120 characters." },
        { status: 400 }
      );
    }

    if (description.length > 10000) {
      return NextResponse.json(
        { error: "Job description is too long." },
        { status: 400 }
      );
    }

    const requiredSkills = normalizeSkills(body.required_skills);
    const preferredSkills = normalizeSkills(body.preferred_skills);

    if (!requiredSkills || !preferredSkills) {
      return NextResponse.json(
        { error: "Skills must be an array of valid skill names." },
        { status: 400 }
      );
    }

    const duration = body.interview_duration_minutes;
    const buffer = body.buffer_minutes ?? 0;
    const capacity = body.interview_capacity;

    if (
      !Number.isInteger(duration) ||
      Number(duration) < 15 ||
      Number(duration) > 480
    ) {
      return NextResponse.json(
        { error: "Interview duration must be between 15 and 480 minutes." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(buffer) ||
      Number(buffer) < 0 ||
      Number(buffer) > 240
    ) {
      return NextResponse.json(
        { error: "Buffer time must be between 0 and 240 minutes." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(capacity) ||
      Number(capacity) < 1 ||
      Number(capacity) > 500
    ) {
      return NextResponse.json(
        { error: "Interview capacity must be between 1 and 500." },
        { status: 400 }
      );
    }

    const dateStart = body.date_start;
    const dateEnd = body.date_end;
    const timezone = body.timezone;

    if (
      !isValidDate(dateStart) ||
      !isValidDate(dateEnd) ||
      dateEnd < dateStart
    ) {
      return NextResponse.json(
        { error: "Please provide a valid interview date range." },
        { status: 400 }
      );
    }

    if (!isValidTimezone(timezone)) {
      return NextResponse.json(
        { error: "Please provide a valid timezone." },
        { status: 400 }
      );
    }

    const workingHours = validateTimeWindows(body.working_hours);
    const breaks = validateTimeWindows(body.breaks);

    if (!workingHours || !breaks) {
      return NextResponse.json(
        { error: "Working hours or break schedules are invalid." },
        { status: 400 }
      );
    }

    const status: JobStatus =
      body.status === undefined ? "draft" : body.status as JobStatus;

    if (!["draft", "active", "archived"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid job status." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        created_by: user.id,
        title,
        description,
        required_skills: requiredSkills,
        preferred_skills: preferredSkills,
        interview_duration_minutes: Number(duration),
        buffer_minutes: Number(buffer),
        interview_capacity: Number(capacity),
        date_start: dateStart,
        date_end: dateEnd,
        timezone,
        working_hours: workingHours,
        breaks,
        status,
      })
      .select()
      .single();

    if (error) {
      console.error("Job creation failed:", error.message);

      return NextResponse.json(
        { error: "Unable to create job." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Job created successfully.",
        job: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Jobs POST error:", error);

    return NextResponse.json(
      { error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
