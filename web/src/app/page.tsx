
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type DashboardData = {
  metrics: {
    totalJobs: number;
    activeJobs: number;
    totalCandidates: number;
    shortlisted: number;
    interviewsNextSevenDays: number;
  };
  pipeline: {
    pendingReview: number;
    shortlisted: number;
    notShortlisted: number;
  };
  recentCandidates: {
    id: string;
    name: string;
    email: string | null;
    jobTitle: string;
    score: number | null;
    status: string;
    createdAt: string;
  }[];
  upcomingInterviews: {
    id: string;
    candidateName: string;
    jobTitle: string;
    startAt: string;
    endAt: string;
    status: string;
    meetingUrl: string | null;
  }[];
  recentJobs: {
    id: string;
    title: string;
    status: string;
    created_at: string;
  }[];
};

const navigation = [
  {
    label: "Overview",
    href: "/",
    icon: "grid",
    count: null,
  },
  {
    label: "Jobs",
    href: "/jobs",
    icon: "briefcase",
    count: "jobs",
  },
  {
    label: "Candidates",
    href: "/candidates",
    icon: "users",
    count: "candidates",
  },
  {
    label: "Interviews",
    href: "/interviews",
    icon: "calendar",
    count: "interviews",
  },
  {
    label: "Interview rooms",
    href: "/interviews/rooms",
    icon: "video",
    count: null,
  },
  {
    label: "Email workflows",
    href: "/emails",
    icon: "mail",
    count: null,
  },
];

const iconPaths: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  briefcase:
    "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  users:
    "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.6-3.3 3.1-5 6.5-5s5.9 1.7 6.5 5M16 4.5a3.2 3.2 0 010 6M18 15c2 .5 3.2 2 3.5 5",
  calendar:
    "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  mail:
    "M3 6h18v12H3zM3 7l9 7 9-7",
  video:
    "M15 10l6-4v12l-6-4M3 7h12v10H3z",
  arrow:
    "M5 12h14M13 6l6 6-6 6",
  refresh:
    "M20 7v5h-5M4 17v-5h5M5.5 9A7 7 0 0118 6l2 6M4 12l2 6a7 7 0 0012.5-1",
  briefArrow:
    "M7 17L17 7M7 7h10v10",
  clock:
    "M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

function Icon({
  name,
  className = "h-[18px] w-[18px]",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={iconPaths[name] || iconPaths.grid} />
    </svg>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value || 0);
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
}

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function getStatusStyle(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "shortlisted" || normalized === "active") {
    return "bg-emerald-50 text-emerald-800";
  }

  if (
    normalized === "interview" ||
    normalized === "confirmed"
  ) {
    return "bg-sky-50 text-sky-800";
  }

  if (
    normalized === "under review" ||
    normalized === "proposed" ||
    normalized === "pending_review"
  ) {
    return "bg-amber-50 text-amber-800";
  }

  if (
    normalized === "not shortlisted" ||
    normalized === "failed" ||
    normalized === "processing failed"
  ) {
    return "bg-rose-50 text-rose-800";
  }

  return "bg-stone-100 text-stone-700";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  accent,
}: {
  label: string;
  value: number;
  note: string;
  icon: string;
  accent: string;
}) {
  return (
    <div className="group rounded-2xl border border-stone-200 bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-stone-900/5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">{label}</p>

        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}
        >
          <Icon name={icon} />
        </span>
      </div>

      <p className="mt-5 text-4xl font-bold tracking-tight text-stone-900 tabular-nums">
        {formatNumber(value)}
      </p>

      <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">
        {note}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/70 px-5 py-10 text-center">
      <p className="font-semibold text-stone-800">{title}</p>
      <p className="mt-2 text-sm text-stone-500">{description}</p>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [greeting, setGreeting] = useState("Welcome");

  const loadDashboard = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/dashboard", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load dashboard information."
        );
      }

      if (!result.metrics || !result.pipeline) {
        throw new Error("Dashboard data is incomplete.");
      }

      setData(result as DashboardData);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while loading the dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setGreeting(getGreeting());
    void loadDashboard();
  }, [loadDashboard]);

  const metrics = data?.metrics;
  const pipeline = data?.pipeline;

  const totalCandidates = metrics?.totalCandidates || 0;

  const classifiedCandidates =
    (pipeline?.pendingReview || 0) +
    (pipeline?.shortlisted || 0) +
    (pipeline?.notShortlisted || 0);

  const otherCandidates = Math.max(
    0,
    totalCandidates - classifiedCandidates
  );

  const pipelineStages = [
    {
      label: "Pending review",
      count: pipeline?.pendingReview || 0,
      color: "#e7a34b",
    },
    {
      label: "Shortlisted",
      count: pipeline?.shortlisted || 0,
      color: "#279a70",
    },
    {
      label: "Not shortlisted",
      count: pipeline?.notShortlisted || 0,
      color: "#bf786c",
    },
    {
      label: "Processing / other",
      count: otherCandidates,
      color: "#a8a29e",
    },
  ];

  const nextInterview = data?.upcomingInterviews?.[0];

  return (
    <main className="min-h-screen bg-[#f6f3ee] text-stone-900 antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');

        .hs {
          font-family: 'DM Sans', system-ui, sans-serif;
        }

        .hs .display {
          font-family: 'Manrope', system-ui, sans-serif;
          letter-spacing: -0.04em;
        }

        @keyframes entrance {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hs-enter {
          animation: entrance .5s ease both;
        }

        @media (prefers-reduced-motion: reduce) {
          .hs-enter {
            animation: none;
          }
        }
      `}</style>

      <div className="hs flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#1b1714] text-stone-300 lg:flex">
          <Link
            href="/"
            className="flex items-center gap-3 px-6 pb-7 pt-7"
          >
            <div className="display flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-700 text-xl font-extrabold text-white shadow-lg shadow-orange-950/30">
              H
            </div>

            <div>
              <h1 className="display text-xl font-extrabold text-white">
                HireSync
              </h1>
              <p className="text-xs text-stone-400">
                Recruit. Schedule. Hire.
              </p>
            </div>
          </Link>

          <div className="px-6 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
            Workspace
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = item.label === "Overview";

              let badge: number | null = null;

              if (item.count === "jobs") {
                badge = metrics?.activeJobs ?? null;
              } else if (item.count === "candidates") {
                badge = metrics?.totalCandidates ?? null;
              } else if (item.count === "interviews") {
                badge = metrics?.interviewsNextSevenDays ?? null;
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-stone-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-orange-500 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />

                  <Icon
                    name={item.icon}
                    className={`h-[19px] w-[19px] ${
                      isActive
                        ? "text-orange-400"
                        : "text-stone-500 group-hover:text-stone-200"
                    }`}
                  />

                  <span className="flex-1">{item.label}</span>

                  {badge !== null && badge > 0 && (
                    <span className="rounded-md bg-white/[0.07] px-2 py-0.5 text-[11px] text-stone-300">
                      {formatNumber(badge)}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="m-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold text-stone-200">
              Hiring workspace
            </p>

            <p className="mt-1 text-xs leading-5 text-stone-500">
              AI-powered candidate intelligence and interview management.
            </p>

            <Link
              href="/interviews/feedback"
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-orange-300 hover:text-orange-200"
            >
              Interview feedback
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#f6f3ee]/90 px-5 py-4 backdrop-blur-md sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Hiring workspace
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-800">
                  Overview
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadDashboard(true)}
                  disabled={loading || refreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
                >
                  <Icon
                    name="refresh"
                    className={`h-4 w-4 ${
                      refreshing ? "animate-spin" : ""
                    }`}
                  />
                  <span className="hidden sm:inline">
                    Refresh data
                  </span>
                  <span className="sm:hidden">Refresh</span>
                </button>

                <Link
                  href="/jobs"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1b1714] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-800"
                >
                  + Create job
                </Link>
              </div>
            </div>

            {/* Mobile navigation */}
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${
                    item.label === "Overview"
                      ? "bg-stone-900 text-white"
                      : "border border-stone-200 bg-white text-stone-700"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-7 px-5 py-7 sm:px-8 sm:py-9">
            {/* Hero */}
            <section className="hs-enter relative overflow-hidden rounded-3xl bg-[#1b1714] p-7 text-white shadow-xl shadow-stone-900/5 sm:p-9">
              <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-orange-600/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

              <div className="relative grid gap-8 xl:grid-cols-[1fr_auto] xl:items-end">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-orange-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Your recruitment command centre
                  </div>

                  <h2 className="display mt-5 text-4xl font-extrabold leading-[1.1] sm:text-5xl">
                    {greeting},{" "}
                    <span className="italic text-orange-300">
                      let's hire better.
                    </span>
                  </h2>

                  <p className="mt-4 max-w-xl text-sm leading-7 text-stone-300 sm:text-base">
                    Track your hiring pipeline, understand candidate
                    quality and manage interviews in one connected
                    workspace.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href="/candidates"
                      className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-400"
                    >
                      Explore candidates
                    </Link>

                    <Link
                      href="/interviews"
                      className="rounded-xl border border-white/20 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Manage interviews
                    </Link>
                  </div>
                </div>

                <div className="min-w-[250px] rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.17em] text-stone-400">
                    Next interview
                  </p>

                  {nextInterview ? (
                    <>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-200">
                          {getInitials(nextInterview.candidateName)}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {nextInterview.candidateName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-stone-400">
                            {nextInterview.jobTitle}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                        <div>
                          <p className="text-xs text-stone-400">
                            Scheduled
                          </p>
                          <p className="mt-1 text-sm font-semibold text-orange-200">
                            {formatDateTime(nextInterview.startAt)}
                          </p>
                        </div>

                        <Link
                          href="/interviews"
                          className="rounded-lg bg-white/10 p-2.5 text-white hover:bg-white/20"
                          aria-label="Open interviews"
                        >
                          <Icon name="briefArrow" />
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="mt-4">
                      <p className="font-semibold text-white">
                        No upcoming interviews
                      </p>
                      <p className="mt-2 text-xs leading-5 text-stone-400">
                        Interviews scheduled over the next seven days
                        will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Error */}
            {error && (
              <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
                <p className="font-semibold text-rose-900">
                  Dashboard data could not be loaded
                </p>

                <p className="mt-1 text-sm text-rose-800">{error}</p>

                <button
                  type="button"
                  onClick={() => void loadDashboard(true)}
                  className="mt-3 text-sm font-bold text-rose-900 underline"
                >
                  Try again
                </button>
              </section>
            )}

            {/* Metric cards */}
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="display text-xl font-extrabold">
                    Hiring at a glance
                  </h3>
                  <p className="mt-1 text-sm text-stone-500">
                    Current figures from your recruitment workspace.
                  </p>
                </div>

                {updatedAt && (
                  <p className="text-xs text-stone-400">
                    Updated at {updatedAt}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {loading && !data
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-40 animate-pulse rounded-2xl border border-stone-200 bg-white"
                      />
                    ))
                  : (
                    <>
                      <MetricCard
                        label="Active jobs"
                        value={metrics?.activeJobs || 0}
                        note={`${formatNumber(metrics?.totalJobs || 0)} total jobs in your workspace`}
                        icon="briefcase"
                        accent="bg-orange-50 text-orange-700"
                      />

                      <MetricCard
                        label="Total candidates"
                        value={metrics?.totalCandidates || 0}
                        note="Applications received across your workspace"
                        icon="users"
                        accent="bg-blue-50 text-blue-700"
                      />

                      <MetricCard
                        label="Shortlisted"
                        value={metrics?.shortlisted || 0}
                        note="Candidates selected for further consideration"
                        icon="grid"
                        accent="bg-emerald-50 text-emerald-700"
                      />

                      <MetricCard
                        label="Interviews next 7 days"
                        value={metrics?.interviewsNextSevenDays || 0}
                        note="Proposed, confirmed or reschedule requested"
                        icon="calendar"
                        accent="bg-violet-50 text-violet-700"
                      />
                    </>
                  )}
              </div>
            </section>

            {/* Pipeline */}
            <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="display text-xl font-extrabold">
                    Candidate decision pipeline
                  </h3>
                  <p className="mt-1 text-sm text-stone-500">
                    How applications are currently distributed.
                  </p>
                </div>

                <Link
                  href="/candidates"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-orange-800 hover:text-orange-600"
                >
                  View candidates
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-7">
                {loading && !data ? (
                  <div className="h-3 animate-pulse rounded-full bg-stone-100" />
                ) : (
                  <>
                    <div className="flex h-4 gap-1.5 overflow-hidden rounded-full bg-stone-100">
                      {pipelineStages.map((stage) => (
                        <div
                          key={stage.label}
                          title={`${stage.label}: ${stage.count}`}
                          style={{
                            width:
                              totalCandidates > 0
                                ? `${(stage.count / totalCandidates) * 100}%`
                                : "0%",
                            background: stage.color,
                          }}
                          className="min-w-0 rounded-full transition-all duration-500"
                        />
                      ))}
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {pipelineStages.map((stage) => {
                        const percentage =
                          totalCandidates > 0
                            ? (stage.count / totalCandidates) * 100
                            : 0;

                        return (
                          <div key={stage.label}>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ background: stage.color }}
                              />
                              <span className="text-sm text-stone-600">
                                {stage.label}
                              </span>
                            </div>

                            <div className="mt-2 flex items-baseline gap-2">
                              <span className="text-2xl font-bold tabular-nums">
                                {formatNumber(stage.count)}
                              </span>

                              <span className="text-xs text-stone-400">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Recent candidates and interviews */}
            <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
              {/* Recent candidates */}
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                  <div>
                    <h3 className="display text-xl font-extrabold">
                      Recent candidates
                    </h3>

                    <p className="mt-1 text-sm text-stone-500">
                      The latest applications received.
                    </p>
                  </div>

                  <Link
                    href="/candidates"
                    className="text-sm font-semibold text-orange-800 hover:text-orange-600"
                  >
                    View all →
                  </Link>
                </div>

                {loading && !data ? (
                  <div className="space-y-4 p-6">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="h-14 animate-pulse rounded-lg bg-stone-100"
                      />
                    ))}
                  </div>
                ) : data?.recentCandidates?.length ? (
                  <div className="divide-y divide-stone-100">
                    {data.recentCandidates.map((candidate) => (
                      <Link
                        key={candidate.id}
                        href="/candidates"
                        className="group flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition hover:bg-orange-50/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-amber-100 text-xs font-bold text-orange-900">
                            {getInitials(candidate.name)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-stone-900">
                              {candidate.name}
                            </p>

                            <p className="mt-1 truncate text-xs text-stone-500">
                              {candidate.jobTitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-stone-400">
                              AI score
                            </p>

                            <p className="mt-1 text-sm font-bold tabular-nums text-stone-800">
                              {candidate.score === null
                                ? "—"
                                : `${candidate.score.toFixed(1)}/100`}
                            </p>
                          </div>

                          <StatusBadge status={candidate.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState
                      title="No candidate applications yet"
                      description="Upload your first resume to start building your hiring pipeline."
                    />
                  </div>
                )}
              </div>

              {/* Upcoming interviews */}
              <div className="rounded-2xl border border-stone-200 bg-white">
                <div className="flex items-start justify-between gap-3 px-6 py-5">
                  <div>
                    <h3 className="display text-xl font-extrabold">
                      Upcoming interviews
                    </h3>

                    <p className="mt-1 text-sm text-stone-500">
                      Scheduled over the next seven days.
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-800">
                    <Icon name="calendar" className="h-5 w-5" />
                  </div>
                </div>

                {loading && !data ? (
                  <div className="space-y-3 p-6">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-20 animate-pulse rounded-xl bg-stone-100"
                      />
                    ))}
                  </div>
                ) : data?.upcomingInterviews?.length ? (
                  <div className="space-y-3 px-5 pb-5">
                    {data.upcomingInterviews.map((interview) => (
                      <div
                        key={interview.id}
                        className="rounded-xl border border-stone-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-700">
                              {getInitials(interview.candidateName)}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-stone-900">
                                {interview.candidateName}
                              </p>

                              <p className="mt-1 truncate text-xs text-stone-500">
                                {interview.jobTitle}
                              </p>
                            </div>
                          </div>

                          <StatusBadge status={interview.status} />
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
                          <div>
                            <p className="text-xs text-stone-500">
                              <span className="font-semibold text-stone-800">
                                {formatDate(interview.startAt)}
                              </span>
                            </p>

                            <p className="mt-1 text-xs text-stone-500">
                              {formatTime(interview.startAt)}
                              {" – "}
                              {formatTime(interview.endAt)}
                            </p>
                          </div>

                          {interview.status === "confirmed" &&
                          interview.meetingUrl ? (
                            <Link
                              href={`/interviews/${encodeURIComponent(interview.id)}/room`}
                              className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-800"
                            >
                              Join room
                            </Link>
                          ) : (
                            <Link
                              href="/interviews"
                              className="text-xs font-semibold text-orange-800 hover:underline"
                            >
                              Manage →
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 pb-5">
                    <EmptyState
                      title="No upcoming interviews"
                      description="Your scheduled candidate conversations will appear here."
                    />
                  </div>
                )}

                <div className="border-t border-stone-100 p-4">
                  <Link
                    href="/interviews"
                    className="block w-full rounded-xl border border-stone-200 py-3 text-center text-sm font-semibold text-stone-700 transition hover:border-stone-900 hover:bg-stone-900 hover:text-white"
                  >
                    Open interview schedule
                  </Link>
                </div>
              </div>
            </section>

            {/* Recent jobs */}
            <section className="rounded-2xl border border-stone-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                <div>
                  <h3 className="display text-xl font-extrabold">
                    Recent job openings
                  </h3>
                  <p className="mt-1 text-sm text-stone-500">
                    Your latest recruitment opportunities.
                  </p>
                </div>

                <Link
                  href="/jobs"
                  className="text-sm font-semibold text-orange-800 hover:text-orange-600"
                >
                  All jobs →
                </Link>
              </div>

              {loading && !data ? (
                <div className="space-y-3 p-6">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-12 animate-pulse rounded-lg bg-stone-100"
                    />
                  ))}
                </div>
              ) : data?.recentJobs?.length ? (
                <div className="divide-y divide-stone-100">
                  {data.recentJobs.map((job) => (
                    <Link
                      key={job.id}
                      href="/jobs"
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition hover:bg-orange-50/40"
                    >
                      <div>
                        <p className="text-sm font-semibold text-stone-900">
                          {job.title}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Created {formatDate(job.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusBadge status={job.status} />
                        <Icon
                          name="briefArrow"
                          className="h-4 w-4 text-stone-400"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-6 pb-6">
                  <EmptyState
                    title="No jobs created yet"
                    description="Create a job opening to start recruiting candidates."
                  />
                </div>
              )}
            </section>

            {/* Footer */}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5 pb-3 text-xs text-stone-500">
              <p>HireSync · Hiring, handled.</p>

              <p>
                {updatedAt
                  ? `Live workspace data · Updated ${updatedAt}`
                  : "Connected recruitment workspace"}
              </p>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
