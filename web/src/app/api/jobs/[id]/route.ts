
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type JobRecord = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  interview_duration_minutes: number;
  buffer_minutes: number;
  interview_capacity: number;
  date_start: string;
  date_end: string;
  timezone: string;
  working_hours: unknown;
  breaks: unknown;
  status: "draft" | "active" | "archived";
  created_at: string;
};

const editableFields = [
  "title",
  "description",
  "required_skills",
  "preferred_skills",
  "interview_duration_minutes",
  "buffer_minutes",
  "interview_capacity",
  "date_start",
  "date_end",
  "timezone",
  "working_hours",
  "breaks",
  "status",
] as const;

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isValidDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function normalizeSkills(value: unknown): string[] | null {
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

function normalizeWindows(value: unknown) {
  if (!Array.isArray(value) || value.length > 42) {
    return null;
  }

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  const result = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;

    const window = item as Record<string, unknown>;

    if (
      !Number.isInteger(window.day_of_week) ||
      Number(window.day_of_week) < 0 ||
      Number(window.day_of_week) > 6 ||
      typeof window.start !== "string" ||
      typeof window.end !== "string" ||
      !timePattern.test(window.start) ||
      !timePattern.test(window.end) ||
      window.start >= window.end
    ) {
      return null;
    }

    result.push({
      day_of_week: Number(window.day_of_week),
      start: window.start,
      end: window.end,
    });
  }

  return result;
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

async function authenticate() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { supabase, user };
}

/* GET /api/jobs/[id] */

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: "Invalid job ID." },
        { status: 400 }
      );
    }

    const auth = await authenticate();

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data, error } = await auth.supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .eq("created_by", auth.user.id)
      .maybeSingle();

    if (error) {
      console.error("Job retrieval error:", error.message);

      return NextResponse.json(
        { error: "Unable to retrieve job." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Job not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ job: data });
  } catch (error) {
    console.error("Job GET error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

/* PATCH /api/jobs/[id] */

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: "Invalid job ID." },
        { status: 400 }
      );
    }

    const auth = await authenticate();

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid job update." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const keys = Object.keys(input);

    if (keys.length === 0) {
      return NextResponse.json(
        { error: "No update fields provided." },
        { status: 400 }
      );
    }

    if (
      keys.some(
        (key) => !(editableFields as readonly string[]).includes(key)
      )
    ) {
      return NextResponse.json(
        { error: "One or more fields cannot be modified." },
        { status: 400 }
      );
    }

    // Retrieve the existing job and verify ownership.

    const { data: existing, error: fetchError } =
      await auth.supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .eq("created_by", auth.user.id)
        .maybeSingle();

    if (fetchError) {
      console.error("Job ownership check failed:", fetchError.message);

      return NextResponse.json(
        { error: "Unable to retrieve job." },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Job not found." },
        { status: 404 }
      );
    }

    const candidate = {
      ...existing,
      ...input,
    } as JobRecord;

    // Validate all editable fields after merging the changes.

    const title =
      typeof candidate.title === "string"
        ? candidate.title.trim()
        : "";

    if (title.length < 3 || title.length > 120) {
      return NextResponse.json(
        { error: "Job title must contain 3–120 characters." },
        { status: 400 }
      );
    }

    if (
      typeof candidate.description !== "string" ||
      candidate.description.length > 10000
    ) {
      return NextResponse.json(
        { error: "Invalid job description." },
        { status: 400 }
      );
    }

    const requiredSkills = normalizeSkills(candidate.required_skills);
    const preferredSkills = normalizeSkills(candidate.preferred_skills);

    if (!requiredSkills || !preferredSkills) {
      return NextResponse.json(
        { error: "Invalid skills list." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(candidate.interview_duration_minutes) ||
      candidate.interview_duration_minutes < 15 ||
      candidate.interview_duration_minutes > 480
    ) {
      return NextResponse.json(
        { error: "Interview duration must be 15–480 minutes." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(candidate.buffer_minutes) ||
      candidate.buffer_minutes < 0 ||
      candidate.buffer_minutes > 240
    ) {
      return NextResponse.json(
        { error: "Invalid interview buffer." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(candidate.interview_capacity) ||
      candidate.interview_capacity < 1 ||
      candidate.interview_capacity > 500
    ) {
      return NextResponse.json(
        { error: "Invalid interview capacity." },
        { status: 400 }
      );
    }

    if (
      !isValidDate(candidate.date_start) ||
      !isValidDate(candidate.date_end) ||
      candidate.date_end < candidate.date_start
    ) {
      return NextResponse.json(
        { error: "Invalid interview date range." },
        { status: 400 }
      );
    }

    if (!isValidTimezone(candidate.timezone)) {
      return NextResponse.json(
        { error: "Invalid timezone." },
        { status: 400 }
      );
    }

    const workingHours = normalizeWindows(candidate.working_hours);
    const breaks = normalizeWindows(candidate.breaks);

    if (!workingHours || !breaks) {
      return NextResponse.json(
        { error: "Invalid working hours or breaks." },
        { status: 400 }
      );
    }

    if (
      !["draft", "active", "archived"].includes(candidate.status)
    ) {
      return NextResponse.json(
        { error: "Invalid job status." },
        { status: 400 }
      );
    }

    // Only update fields explicitly supplied by the client.
    // The owner ID is deliberately never editable.

    const normalized: Record<string, unknown> = {
      title,
      description: candidate.description.trim(),
      required_skills: requiredSkills,
      preferred_skills: preferredSkills,
      interview_duration_minutes: candidate.interview_duration_minutes,
      buffer_minutes: candidate.buffer_minutes,
      interview_capacity: candidate.interview_capacity,
      date_start: candidate.date_start,
      date_end: candidate.date_end,
      timezone: candidate.timezone,
      working_hours: workingHours,
      breaks,
      status: candidate.status,
    };

    const updates: Record<string, unknown> = {};

    for (const key of keys) {
      updates[key] = normalized[key];
    }

    const { data, error } = await auth.supabase
      .from("jobs")
      .update(updates)
      .eq("id", id)
      .eq("created_by", auth.user.id)
      .select("*")
      .single();

    if (error) {
      console.error("Job update failed:", error.message);

      return NextResponse.json(
        { error: "Unable to update job." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        candidate.status === "archived"
          ? "Job archived successfully."
          : "Job updated successfully.",
      job: data,
    });
  } catch (error) {
    console.error("Job PATCH error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

