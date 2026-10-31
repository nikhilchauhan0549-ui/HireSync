"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ---------- types ---------- */

type Job = {
  id: string;
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
  status: "draft" | "active" | "archived";
  created_at: string;
};

type JobsResponse = {
  jobs?: Job[];
  error?: string;
};

type StatusFilter = "all" | Job["status"];
type SortKey = "newest" | "oldest" | "title";

/* ---------- helpers ---------- */

const statusStyles: Record<Job["status"], string> = {
  active: "bg-emerald-100/70 text-emerald-800 before:bg-emerald-500",
  draft: "bg-amber-100/70 text-amber-800 before:bg-amber-500",
  archived: "bg-stone-200/70 text-stone-700 before:bg-stone-400",
};

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function windowInfo(start: string, end: string) {
  const s = new Date(`${start?.slice(0, 10)}T00:00:00`).getTime();
  const e = new Date(`${end?.slice(0, 10)}T00:00:00`).getTime();
  const now = Date.now();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return { pct: 0, label: "Dates not set" };
  const day = 86_400_000;
  if (now < s) return { pct: 0, label: `Starts in ${Math.ceil((s - now) / day)}d` };
  if (now > e + day) return { pct: 100, label: "Window closed" };
  const left = Math.max(Math.ceil((e - now) / day), 0);
  return { pct: Math.round(((now - s) / (e - s)) * 100), label: left === 0 ? "Last day" : `${left}d left` };
}

/* ---------- small pieces ---------- */

const iconPaths: Record<string, string> = {
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  briefcase: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  retry: "M20 12a8 8 0 11-2.3-5.7M20 4v5h-5",
  close: "M6 6l12 12M18 6L6 18",
};

function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={iconPaths[name]} />
    </svg>
  );
}

function CountUp({ to, loading }: { to: number; loading: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (loading) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / 800, 1);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, loading]);
  if (loading) return <span className="inline-block h-10 w-14 animate-pulse rounded-lg bg-stone-200/70 align-middle" />;
  return <>{String(n).padStart(2, "0")}</>;
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-stone-100" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-5">
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-48 animate-pulse rounded bg-stone-200/70" />
            <div className="h-3 w-28 animate-pulse rounded bg-stone-100" />
          </div>
          <div className="hidden h-6 w-56 animate-pulse rounded bg-stone-100 md:block" />
          <div className="hidden h-4 w-20 animate-pulse rounded bg-stone-100 lg:block" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-stone-100" />
        </div>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/jobs", { method: "GET", cache: "no-store" });
      const result: JobsResponse = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to retrieve jobs.");
      setJobs(result.jobs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while loading jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const counts = useMemo(
    () => ({
      all: jobs.length,
      active: jobs.filter((j) => j.status === "active").length,
      draft: jobs.filter((j) => j.status === "draft").length,
      archived: jobs.filter((j) => j.status === "archived").length,
    }),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = jobs.filter((job) => {
      const matchesSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        (job.required_skills ?? []).some((s) => s.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === "newest" ? -diff : diff;
    });
  }, [jobs, search, statusFilter, sort]);

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "draft", label: "Draft" },
    { key: "archived", label: "Archived" },
  ];

  const stats = [
    { label: "Total jobs", value: counts.all, note: "In your workspace" },
    { label: "Active jobs", value: counts.active, note: "Open for interviews" },
    { label: "Draft jobs", value: counts.draft, note: "Waiting to be published" },
  ];

  return (
    <main className="jb min-h-screen bg-[#f6f3ee] text-stone-900 antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;0,900;1,700&family=Roboto:wght@400;500;700&display=swap');
        .jb { font-family: 'Roboto', system-ui, sans-serif; }
        .jb .display { font-family: 'Lato', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.01em; }
        @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .rise { opacity: 0; animation: rise .55s cubic-bezier(.2,.7,.2,1) forwards; animation-delay: calc(var(--i, 0) * 60ms); }
        .bar { transform-origin: left; animation: grow .9s cubic-bezier(.2,.7,.2,1) .2s both; }
        .lift { transition: transform .25s cubic-bezier(.2,.7,.2,1), box-shadow .25s ease, border-color .25s ease; }
        .lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -14px rgba(60,35,15,.25); border-color: #e3d9cb; }
        @media (prefers-reduced-motion: reduce) { .rise, .bar { animation: none; opacity: 1; } .lift { transition: none; } }
      `}</style>

      {/* top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-stone-200/70 bg-[#f6f3ee]/80 px-5 py-4 backdrop-blur-md sm:px-10">
        <nav className="flex items-center gap-2 text-[13px] text-stone-600">
          <Link href="/" className="transition-colors hover:text-orange-700">
            HireSync
          </Link>
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-800">Jobs</span>
        </nav>

        <Link
          href="/jobs/new"
          className="group inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-[15px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,.5)] transition duration-200 hover:-translate-y-0.5 hover:bg-orange-700 active:translate-y-0"
        >
          <Icon name="plus" className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          Create job
        </Link>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-10">
        {/* hero */}
        <div className="rise relative overflow-hidden rounded-3xl bg-[#1b1714] p-7 text-stone-100 sm:p-10" style={{ ["--i" as string]: 0 }}>
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-orange-600/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-48 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative max-w-xl">
            <p className="text-[15px] text-stone-300">Job management</p>
            <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">
              Every open role, <span className="italic text-orange-300">in one place.</span>
            </h1>
            <p className="mt-4 text-stone-300">Manage your organization&apos;s positions, interview windows and the skills you&apos;re hiring for.</p>
          </div>
        </div>

        {/* stats */}
        <section className="grid gap-4 sm:grid-cols-3">
          {stats.map((m, i) => (
            <div key={m.label} className="rise lift rounded-2xl border border-stone-200/80 bg-white p-5" style={{ ["--i" as string]: i + 1 }}>
              <p className="text-[15px] text-stone-600">{m.label}</p>
              <p className="display mt-3 text-5xl font-medium tabular-nums text-stone-900">
                <CountUp to={m.value} loading={loading} />
              </p>
              <p className="mt-4 border-t border-stone-100 pt-3 text-[13px] text-stone-600">{m.note}</p>
            </div>
          ))}
        </section>

        {/* listing */}
        <section className="rise overflow-hidden rounded-2xl border border-stone-200/80 bg-white" style={{ ["--i" as string]: 4 }}>
          <div className="flex flex-col gap-5 px-6 pb-4 pt-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="display text-xl font-medium">All positions</h2>
              <p className="mt-1 text-[13px] text-stone-600">Jobs saved in your HireSync workspace.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600" />
                <input
                  type="search"
                  placeholder="Search jobs or skills…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-w-0 rounded-full border border-stone-200 bg-stone-50/70 py-2 pl-9 pr-4 text-[15px] outline-none transition placeholder:text-stone-600 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100 sm:w-64"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort jobs"
                className="rounded-full border border-stone-200 bg-stone-50/70 px-4 py-2 text-[15px] text-stone-700 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>

          {/* status pills */}
          <div className="flex flex-wrap gap-2 px-6 pb-4" role="tablist" aria-label="Filter jobs by status">
            {tabs.map((t) => {
              const on = statusFilter === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setStatusFilter(t.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition duration-200 ${
                    on ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200/70"
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-white/15 text-white" : "bg-white text-stone-600"}`}>
                    {loading ? "–" : counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mx-6 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-[15px] text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void loadJobs()}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-700 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-red-800"
              >
                <Icon name="retry" className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <SkeletonRows />
          ) : !error && filteredJobs.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700">
                <Icon name="briefcase" className="h-6 w-6" />
              </div>
              <h3 className="display mt-5 text-lg font-medium">{jobs.length === 0 ? "No jobs yet" : "No matching jobs"}</h3>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-6 text-stone-600">
                {jobs.length === 0
                  ? "Your recruitment positions will appear here once you create your first job."
                  : "Try a different search term or status filter."}
              </p>
              {jobs.length > 0 && (search || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-4 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-900 hover:bg-stone-900 hover:text-white"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
            </div>
          ) : !error ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[15px]">
                <thead className="text-xs uppercase tracking-[0.12em] text-stone-600">
                  <tr className="border-y border-stone-100">
                    <th className="px-6 py-3 font-medium">Position</th>
                    <th className="px-6 py-3 font-medium">Required skills</th>
                    <th className="px-6 py-3 font-medium">Interview</th>
                    <th className="px-6 py-3 font-medium">Interview period</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredJobs.map((job, i) => {
                    const skills = job.required_skills ?? [];
                    const win = windowInfo(job.date_start, job.date_end);
                    return (
                      <tr
                        key={job.id}
                        className="rise group border-b border-stone-100 transition-colors duration-200 last:border-0 hover:bg-orange-50/40"
                        style={{ ["--i" as string]: Math.min(i, 8) + 5 }}
                      >
                        <td className="min-w-56 px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 text-orange-800 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                              <Icon name="briefcase" className="h-[18px] w-[18px]" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-stone-900">{job.title}</p>
                              <p className="mt-0.5 text-[13px] text-stone-600">Created {formatDate(job.created_at)}</p>
                            </div>
                          </div>
                        </td>

                        <td className="min-w-52 px-6 py-5">
                          <div className="flex max-w-72 flex-wrap gap-1.5">
                            {skills.slice(0, 4).map((skill) => (
                              <span key={skill} className="rounded-md bg-stone-100 px-2 py-1 text-[13px] text-stone-700 transition-colors group-hover:bg-white">
                                {skill}
                              </span>
                            ))}
                            {skills.length > 4 && (
                              <span className="rounded-md bg-orange-50 px-2 py-1 text-[13px] font-medium text-orange-700" title={skills.slice(4).join(", ")}>
                                +{skills.length - 4}
                              </span>
                            )}
                            {skills.length === 0 && <span className="text-[13px] text-stone-600">None listed</span>}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-6 py-5">
                          <div className="flex items-center gap-1.5 text-stone-700">
                            <Icon name="clock" className="h-3.5 w-3.5 text-stone-600" />
                            <span className="font-medium tabular-nums">{job.interview_duration_minutes} min</span>
                          </div>
                          <p className="mt-1 text-[13px] text-stone-600">Capacity {job.interview_capacity}</p>
                        </td>

                        <td className="min-w-48 whitespace-nowrap px-6 py-5">
                          <p className="text-stone-700">
                            {formatDate(job.date_start)}
                            <span className="mx-1.5 text-stone-300">→</span>
                            {formatDate(job.date_end)}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1 w-24 overflow-hidden rounded-full bg-stone-200/80">
                              <div className="bar h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-700" style={{ width: `${win.pct}%` }} />
                            </div>
                            <span className="text-xs text-stone-600">{win.label}</span>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium before:h-1.5 before:w-1.5 before:rounded-full ${statusStyles[job.status]}`}
                          >
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!loading && !error && jobs.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/50 px-6 py-4 text-[13px] text-stone-600">
              <p>
                Showing <span className="font-semibold text-stone-700">{filteredJobs.length}</span> of {jobs.length} jobs
              </p>
              <p>{counts.archived} archived</p>
            </div>
          )}
        </section>

        <p className="pb-2 text-center text-[13px] text-stone-600">HireSync · Hiring, handled.</p>
      </div>
    </main>
  );
}