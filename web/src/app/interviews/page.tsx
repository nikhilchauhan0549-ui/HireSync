
"use client";

import { useEffect, useState, type FormEvent } from "react";

type Job = {
  id: string;
  title: string;
  timezone: string | null;
  status: string;
};

type Application = {
  id: string;
  job_id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  processing_status: string;
};

type Interviewer = {
  id: string;
  job_id: string;
  name: string;
  email: string;
};

type Availability = {
  id: string;
  interviewer_id: string;
  start_at: string;
  end_at: string;
};

type Interview = {
  id: string;
  job_id: string;
  application_id: string;
  interviewer_id: string;
  start_at: string;
  end_at: string;
  status: string;
  meeting_url: string | null;
};

type DashboardData = {
  jobs: Job[];
  applications: Application[];
  interviewers: Interviewer[];
  availability: Availability[];
  interviews: Interview[];
};

type CreatedSchedule = {
  interview: Interview;
  invitationUrl: string;
  emailDraftSaved: boolean;
  emailDraftWarning: string | null;
};

type RescheduleResult = {
  interview: Interview;
  invitationUrl: string;
  emailDraftSaved: boolean;
  warning: string | null;
};

const emptyData: DashboardData = {
  jobs: [],
  applications: [],
  interviewers: [],
  availability: [],
  interviews: [],
};

const ACTIVE_STATUSES = [
  "proposed",
  "confirmed",
  "reschedule_requested",
];

const DURATION_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

async function readResponse(response: Response) {
  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function localDateTimeToISO(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Choose a valid date and time.");
  }

  return date.toISOString();
}

function toLocalInputValue(date: Date): string {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}



function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

function isManageable(status: string): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function statusClass(status: string): string {
  if (status === "confirmed") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "proposed") {
    return "bg-blue-100 text-blue-800";
  }

  if (status === "reschedule_requested") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "cancelled" || status === "declined") {
    return "bg-red-100 text-red-800";
  }

  if (status === "completed") {
    return "bg-gray-200 text-gray-800";
  }

  return "bg-gray-100 text-gray-700";
}

function getEndTime(startValue: string, duration: number): Date {
  const start = new Date(startValue);

  if (!Number.isFinite(start.getTime())) {
    throw new Error("Choose a valid interview start time.");
  }

  return new Date(start.getTime() + duration * 60 * 1000);
}

function isFutureDate(value: string): boolean {
  const date = new Date(value);

  return (
    Number.isFinite(date.getTime()) &&
    date.getTime() > Date.now() + 5 * 60 * 1000
  );
}

function durationFromInterview(interview: Interview): string {
  const start = new Date(interview.start_at).getTime();
  const end = new Date(interview.end_at).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "45";
  }

  const minutes = Math.round((end - start) / 60000);

  const closest = DURATION_OPTIONS.reduce((best, option) => {
    const currentDistance = Math.abs(Number(option.value) - minutes);
    const bestDistance = Math.abs(Number(best.value) - minutes);

    return currentDistance < bestDistance ? option : best;
  });

  return closest.value;
}

export default function InterviewsPage() {
  const [data, setData] = useState<DashboardData>(emptyData);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingActionId, setSavingActionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [scheduleJobId, setScheduleJobId] = useState("");
  const [scheduleApplicationId, setScheduleApplicationId] = useState("");
  const [scheduleInterviewerId, setScheduleInterviewerId] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("45");

  const [createdSchedule, setCreatedSchedule] =
    useState<CreatedSchedule | null>(null);

  const [editingInterviewId, setEditingInterviewId] = useState("");
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleDuration, setRescheduleDuration] = useState("45");

  const [rescheduleResult, setRescheduleResult] =
    useState<RescheduleResult | null>(null);

  const [interviewerJobId, setInterviewerJobId] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerEmail, setInterviewerEmail] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/interviews", {
        cache: "no-store",
      });

      const result = await readResponse(response);
      const jobs: Job[] = result.jobs || [];

      setData({
        jobs,
        applications: result.applications || [],
        interviewers: result.interviewers || [],
        availability: result.availability || [],
        interviews: result.interviews || [],
      });

      setScheduleJobId((current) =>
        current && jobs.some((job) => job.id === current)
          ? current
          : jobs[0]?.id || ""
      );

      setInterviewerJobId((current) =>
        current && jobs.some((job) => job.id === current)
          ? current
          : jobs[0]?.id || ""
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load interview data."
      );
    } finally {
      setLoading(false);
    }
  }
useEffect(() => {
  void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const activeJobs = data.jobs.filter(
    (job) => job.status !== "archived"
  );

  const scheduleCandidates = data.applications.filter(
    (item) => item.job_id === scheduleJobId
  );

  const scheduleInterviewers = data.interviewers.filter(
    (item) => item.job_id === scheduleJobId
  );

  function showMessage(value: string) {
    setMessage(value);
    setError("");
  }

  function candidateName(applicationId: string) {
    const item = data.applications.find(
      (candidate) => candidate.id === applicationId
    );

    return item?.candidate_name || "Candidate";
  }

  function candidateEmail(applicationId: string) {
    const item = data.applications.find(
      (candidate) => candidate.id === applicationId
    );

    return item?.candidate_email || "No candidate email";
  }

  function interviewerNameFor(id: string) {
    return (
      data.interviewers.find((item) => item.id === id)?.name ||
      "Interviewer"
    );
  }

  function jobTitle(jobId: string) {
    return (
      data.jobs.find((item) => item.id === jobId)?.title || "Job"
    );
  }

  function availabilityCovers(
    interviewerId: string,
    startAt: string,
    endAt: string
  ): boolean {
    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();

    return data.availability.some((slot) => {
      if (slot.interviewer_id !== interviewerId) return false;

      const slotStart = new Date(slot.start_at).getTime();
      const slotEnd = new Date(slot.end_at).getTime();

      return slotStart <= start && slotEnd >= end;
    });
  }

  async function ensureAvailability(
    interviewerId: string,
    startAt: string,
    endAt: string
  ) {
    // If an existing availability period already covers this booking,
    // there is nothing else to create.
    if (availabilityCovers(interviewerId, startAt, endAt)) {
      return;
    }

    // Automatically register the selected booking period as an
    // availability window. The scheduling API still checks existing
    // interview conflicts before it creates the interview.
    const response = await fetch(
      `/api/interviewers/${encodeURIComponent(interviewerId)}/availability`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startAt,
          endAt,
        }),
      }
    );

    await readResponse(response);
  }

  async function createInterviewer(event: FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/interviewers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: interviewerJobId,
          name: interviewerName,
          email: interviewerEmail,
        }),
      });

      await readResponse(response);

      setInterviewerName("");
      setInterviewerEmail("");

      showMessage("Interviewer added successfully.");

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add interviewer."
      );
    } finally {
      setSaving(false);
    }
  }

  async function scheduleInterview(event: FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");
    setCreatedSchedule(null);

    try {
      if (
        !scheduleJobId ||
        !scheduleApplicationId ||
        !scheduleInterviewerId ||
        !scheduleStart
      ) {
        throw new Error("Please complete all booking details.");
      }

      if (!isFutureDate(scheduleStart)) {
        throw new Error(
          "Choose a start time at least five minutes in the future."
        );
      }

      const duration = Number(scheduleDuration);

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Choose a valid interview duration.");
      }

      const startAt = localDateTimeToISO(scheduleStart);
      const endAt = getEndTime(scheduleStart, duration).toISOString();

      showMessage("Checking the selected time and preparing the booking...");

      // Make the selected time available automatically, rather than
      // asking the HR user to create a separate availability period.
      await ensureAvailability(
        scheduleInterviewerId,
        startAt,
        endAt
      );

      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: scheduleJobId,
          applicationId: scheduleApplicationId,
          interviewerId: scheduleInterviewerId,
          startAt,
          endAt,
        }),
      });

      const result = await readResponse(response);

      setCreatedSchedule(result);
      showMessage("Interview scheduled successfully.");

      setScheduleApplicationId("");
      setScheduleStart("");

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to schedule interview."
      );
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function cancelInterview(interview: Interview) {
    const confirmed = window.confirm(
      "Cancel this interview? Its unused candidate invitation link will also be invalidated."
    );

    if (!confirmed) return;

    setSavingActionId(interview.id);
    setError("");
    setMessage("");
    setRescheduleResult(null);

    try {
      const response = await fetch(
        `/api/interviews/${encodeURIComponent(interview.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "cancel",
          }),
        }
      );

      const result = await readResponse(response);

      setEditingInterviewId("");

      showMessage(
        result.message || "Interview cancelled successfully."
      );

      await refresh();

      if (result.warning) {
        setError(result.warning);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel interview."
      );
      setMessage("");
    } finally {
      setSavingActionId("");
    }
  }

  function openReschedule(interview: Interview) {
    setEditingInterviewId(interview.id);
    setRescheduleStart(toLocalInputValue(new Date(interview.start_at)));
    setRescheduleDuration(durationFromInterview(interview));

    setError("");
    setMessage("");
    setRescheduleResult(null);
  }

  async function submitReschedule(
    event: FormEvent<HTMLFormElement>,
    interview: Interview
  ) {
    event.preventDefault();

    setSavingActionId(interview.id);
    setError("");
    setMessage("");
    setRescheduleResult(null);

    try {
      if (!rescheduleStart) {
        throw new Error("Choose a new interview start time.");
      }

      if (!isFutureDate(rescheduleStart)) {
        throw new Error(
          "Choose a new start time at least five minutes in the future."
        );
      }

      const duration = Number(rescheduleDuration);
      const startAt = localDateTimeToISO(rescheduleStart);
      const endAt = getEndTime(rescheduleStart, duration).toISOString();

      await ensureAvailability(
        interview.interviewer_id,
        startAt,
        endAt
      );

      const response = await fetch(
        `/api/interviews/${encodeURIComponent(interview.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "reschedule",
            startAt,
            endAt,
          }),
        }
      );

      const result = await readResponse(response);

      setRescheduleResult({
        interview: result.interview,
        invitationUrl: result.invitationUrl,
        emailDraftSaved: result.emailDraftSaved,
        warning: result.warning || null,
      });

      setEditingInterviewId("");

      showMessage(
        result.message || "Interview rescheduled successfully."
      );

      await refresh();

      if (result.warning) {
        setError(result.warning);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reschedule interview."
      );
      setMessage("");
    } finally {
      setSavingActionId("");
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showMessage("Copied to clipboard.");
    } catch {
      setError(
        "Unable to copy automatically. Select and copy the link manually."
      );
    }
  }

  

  return (
    <main className="min-h-screen bg-[#f5f6fa] px-4 py-7 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        {/* Header */}
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                HIRESYNC · INTERVIEW MANAGEMENT
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Schedule interviews
                <span className="text-indigo-300"> without the hassle.</span>
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Choose your candidate, interviewer and a suitable time.
                HireSync takes care of the booking and invitation.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/interviews/rooms"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Video rooms
              </a>

              <a
                href="/interviews/feedback"
                className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-indigo-50"
              >
                Interview feedback
              </a>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
            <div>
              <p className="text-2xl font-bold">{data.interviews.length}</p>
              <p className="mt-1 text-xs text-slate-400">Total interviews</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {data.interviews.filter((item) => item.status === "confirmed").length}
              </p>
              <p className="mt-1 text-xs text-slate-400">Confirmed</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{data.interviewers.length}</p>
              <p className="mt-1 text-xs text-slate-400">Interviewers</p>
            </div>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <strong className="block">Something needs attention</strong>
            <span className="mt-1 block">{error}</span>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {message}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Loading your interview schedule...
          </div>
        )}

        {!loading && data.jobs.length === 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
              +
            </div>
            <h2 className="mt-4 text-xl font-bold">Create a job first</h2>
            <p className="mt-2 text-sm text-slate-500">
              Interview scheduling is linked to your recruitment jobs.
            </p>
            <a
              href="/jobs"
              className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Go to jobs
            </a>
          </section>
        )}

        {data.jobs.length > 0 && (
          <>
            {/* Quick scheduling form */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                      Quick booking
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">
                      New interview
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Four details. One simple booking.
                    </p>
                  </div>

                  <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                    Video link included
                  </span>
                </div>
              </div>

              <form onSubmit={scheduleInterview} className="space-y-6 p-5 sm:p-7">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      1. Select job
                    </span>
                    <select
                      required
                      value={scheduleJobId}
                      onChange={(event) => {
                        setScheduleJobId(event.target.value);
                        setScheduleApplicationId("");
                        setScheduleInterviewerId("");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="">Choose a job</option>
                      {activeJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      2. Select candidate
                    </span>
                    <select
                      required
                      value={scheduleApplicationId}
                      onChange={(event) =>
                        setScheduleApplicationId(event.target.value)
                      }
                      disabled={!scheduleJobId || scheduleCandidates.length === 0}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Choose a candidate</option>
                      {scheduleCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.candidate_name || "Unnamed candidate"}
                          {candidate.candidate_email
                            ? ` · ${candidate.candidate_email}`
                            : ""}
                        </option>
                      ))}
                    </select>
                    {scheduleApplicationId && (
                      <span className="block text-xs text-slate-500">
                        Invitation recipient:{" "}
                        {candidateEmail(scheduleApplicationId)}
                      </span>
                    )}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      3. Select interviewer
                    </span>
                    <select
                      required
                      value={scheduleInterviewerId}
                      onChange={(event) =>
                        setScheduleInterviewerId(event.target.value)
                      }
                      disabled={!scheduleJobId || scheduleInterviewers.length === 0}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Choose an interviewer</option>
                      {scheduleInterviewers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.email}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      4. Interview date and start time
                    </span>
                    <input
                      type="datetime-local"
                      required
                      
                      value={scheduleStart}
                      onChange={(event) => setScheduleStart(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                    <span className="block text-xs text-slate-500">
                      Your local time · Future dates only
                    </span>
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Interview duration
                    </span>
                    <select
                      value={scheduleDuration}
                      onChange={(event) =>
                        setScheduleDuration(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    >
                      {DURATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl bg-indigo-50 p-4">
                    <p className="text-sm font-semibold text-indigo-950">
                      What happens next?
                    </p>
                    <p className="mt-1 text-xs leading-5 text-indigo-800">
                      HireSync prepares the meeting link, checks existing
                      bookings, and saves an invitation email draft when the
                      candidate has a valid email address.
                    </p>
                  </div>
                </div>

                {scheduleJobId && scheduleCandidates.length === 0 && (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    No candidates are available for this job yet. Upload or
                    add a candidate first.
                  </p>
                )}

                {scheduleJobId && scheduleInterviewers.length === 0 && (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    No interviewer is registered for this job. Add one using
                    the interviewer management section below.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
                  <p className="max-w-lg text-xs leading-5 text-slate-500">
                    Select a time agreed with your interviewer. HireSync
                    checks existing interview bookings before saving.
                  </p>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      !scheduleJobId ||
                      !scheduleApplicationId ||
                      !scheduleInterviewerId ||
                      !scheduleStart
                    }
                    className="inline-flex min-w-48 items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Creating booking..." : "Schedule interview →"}
                  </button>
                </div>
              </form>
            </section>

            {/* Newly created booking */}
            {createdSchedule && (
              <section className="space-y-4 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
                    ✓
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Booking created
                    </p>
                    <h2 className="text-xl font-bold">Interview scheduled</h2>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p>
                    <strong>Status:</strong> Proposed — the candidate must
                    accept the invitation before the interview is confirmed.
                  </p>
                  <p className="mt-1">
                    <strong>Meeting:</strong>{" "}
                    {createdSchedule.interview.meeting_url
                      ? "Video meeting link created"
                      : "No meeting link returned"}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">
                    Candidate invitation link
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      readOnly
                      value={createdSchedule.invitationUrl}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(createdSchedule.invitationUrl)
                      }
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                    >
                      Copy invitation
                    </button>
                  </div>
                </div>

                {createdSchedule.interview.meeting_url && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">
                      Video meeting link
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        readOnly
                        value={createdSchedule.interview.meeting_url}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(createdSchedule.interview.meeting_url!)
                        }
                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                      >
                        Copy video link
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-sm text-slate-600">
                  {createdSchedule.emailDraftSaved
                    ? "Invitation email saved as a draft. Review and send it from the Emails page."
                    : createdSchedule.emailDraftWarning ||
                      "No email draft was created. You can share the invitation link manually."}
                </p>

                <a
                  href="/emails"
                  className="inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Open email drafts
                </a>
              </section>
            )}

            {/* Reschedule result */}
            {rescheduleResult && (
              <section className="space-y-4 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-7">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Updated interview
                </p>
                <h2 className="text-xl font-bold">
                  Revised invitation created
                </h2>
                <p className="text-sm text-slate-600">
                  New time: {formatDateTime(rescheduleResult.interview.start_at)}
                </p>
                <p className="text-sm text-amber-700">
                  The interview is proposed again. The candidate must accept
                  the revised invitation.
                </p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={rescheduleResult.invitationUrl}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(rescheduleResult.invitationUrl)
                    }
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    Copy new invitation
                  </button>
                </div>

                <p className="text-sm text-slate-600">
                  {rescheduleResult.emailDraftSaved
                    ? "Revised email draft saved. It has not been sent."
                    : "No revised email draft was saved. Share the invitation link manually."}
                </p>

                {rescheduleResult.warning && (
                  <p className="text-sm text-amber-700">
                    {rescheduleResult.warning}
                  </p>
                )}
              </section>
            )}

            {/* Interview list */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                    Your calendar
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    Scheduled interviews
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    View bookings, open video rooms or manage changes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  ↻ Refresh
                </button>
              </div>

              {data.interviews.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl">
                    ▣
                  </div>
                  <h3 className="mt-3 font-bold">No interviews yet</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Your scheduled candidate interviews will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {data.interviews.map((interview) => {
                    const editable = isManageable(interview.status);
                    const isEditing =
                      editingInterviewId === interview.id;
                    const isSaving =
                      savingActionId === interview.id;

                    return (
                      <article
                        key={interview.id}
                        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">
                              {candidateName(interview.application_id)}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">
                              {jobTitle(interview.job_id)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Interviewer:{" "}
                              {interviewerNameFor(interview.interviewer_id)}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {candidateEmail(interview.application_id)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusClass(interview.status)}`}
                          >
                            {interview.status.replaceAll("_", " ")}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 p-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Date and time
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {formatDateTime(interview.start_at)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Duration
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {Math.max(
                                0,
                                Math.round(
                                  (new Date(interview.end_at).getTime() -
                                    new Date(interview.start_at).getTime()) /
                                    60000
                                )
                              )}{" "}
                              minutes
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {interview.meeting_url && (
                            <a
                              href={`/interviews/${encodeURIComponent(interview.id)}/room`}
                              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                            >
                              Open video room
                            </a>
                          )}

                          {editable && (
                            <>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => openReschedule(interview)}
                                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                              >
                                Reschedule
                              </button>

                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => void cancelInterview(interview)}
                                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                {isSaving ? "Processing..." : "Cancel"}
                              </button>
                            </>
                          )}
                        </div>

                        {isEditing && (
                          <form
                            onSubmit={(event) =>
                              void submitReschedule(event, interview)
                            }
                            className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5"
                          >
                            <div>
                              <h4 className="font-bold text-slate-900">
                                Choose a new interview time
                              </h4>
                              <p className="mt-1 text-xs text-slate-600">
                                The candidate will receive a new invitation
                                link and must accept the revised time.
                              </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="space-y-2">
                                <span className="text-sm font-semibold">
                                  New date and start time
                                </span>
                                <input
                                  type="datetime-local"
                                  required
                                
                                  value={rescheduleStart}
                                  onChange={(event) =>
                                    setRescheduleStart(event.target.value)
                                  }
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                                />
                              </label>

                              <label className="space-y-2">
                                <span className="text-sm font-semibold">
                                  Duration
                                </span>
                                <select
                                  value={rescheduleDuration}
                                  onChange={(event) =>
                                    setRescheduleDuration(event.target.value)
                                  }
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                                >
                                  {DURATION_OPTIONS.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="submit"
                                disabled={isSaving}
                                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {isSaving ? "Updating..." : "Save new time"}
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => setEditingInterviewId("")}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Close
                              </button>
                            </div>
                          </form>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Interviewer management */}
            <details className="group rounded-3xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                    Settings
                  </p>
                  <h2 className="mt-1 text-lg font-bold">
                    Manage interviewers
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add interviewers for your jobs. You no longer need to
                    enter a separate availability period for every booking.
                  </p>
                </div>
                <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 group-open:rotate-180">
                 ⌄
                </span>
              </summary>

              <div className="border-t border-slate-100 p-5 sm:p-6">
                <form
                  onSubmit={createInterviewer}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Job
                    </span>
                    <select
                      required
                      value={interviewerJobId}
                      onChange={(event) =>
                        setInterviewerJobId(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    >
                      <option value="">Choose job</option>
                      {activeJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Interviewer name
                    </span>
                    <input
                      required
                      value={interviewerName}
                      onChange={(event) =>
                        setInterviewerName(event.target.value)
                      }
                      placeholder="Full name"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Interviewer email
                    </span>
                    <input
                      type="email"
                      required
                      value={interviewerEmail}
                      onChange={(event) =>
                        setInterviewerEmail(event.target.value)
                      }
                      placeholder="interviewer@company.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={saving || !interviewerJobId}
                      className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Add interviewer"}
                    </button>
                  </div>
                </form>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold text-slate-800">
                    Registered interviewers
                  </h3>

                  {data.interviewers.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">
                      No interviewers have been added yet.
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {data.interviewers.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {jobTitle(item.job_id)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
