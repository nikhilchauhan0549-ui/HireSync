"use client";

import { useEffect, useState } from "react";

/* ---------- data ---------- */

const navigation = [
  { label: "Overview", icon: "grid", badge: null },
  { label: "Jobs", icon: "briefcase", badge: "8" },
  { label: "Candidates", icon: "users", badge: "124" },
  { label: "Interviews", icon: "calendar", badge: "12" },
  { label: "Email workflows", icon: "mail", badge: null },
];

const metrics = [
  { label: "Active jobs", value: 8, note: "Across all departments", trend: "+2 this month", spark: [3, 4, 4, 5, 6, 6, 8] },
  { label: "Candidates", value: 124, note: "In your hiring pipeline", trend: "+18 this week", spark: [40, 52, 61, 70, 88, 101, 124] },
  { label: "Interviews", value: 12, note: "Scheduled this week", trend: "5 roles", spark: [4, 6, 5, 8, 7, 10, 12] },
  { label: "Offers pending", value: 3, note: "Awaiting a decision", trend: "1 due today", spark: [1, 1, 2, 2, 3, 2, 3] },
];

const pipeline = [
  { stage: "Applied", count: 124, color: "#d6cfc4" },
  { stage: "Screened", count: 71, color: "#e9b98f" },
  { stage: "Interview", count: 28, color: "#e8895a" },
  { stage: "Offer", count: 3, color: "#c2410c" },
];

const candidates = [
  { name: "Aarav Sharma", initials: "AS", role: "Frontend Developer", score: 92, status: "Shortlisted" },
  { name: "Priya Mehta", initials: "PM", role: "Backend Developer", score: 88, status: "Interview" },
  { name: "Rohan Verma", initials: "RV", role: "Product Designer", score: 84, status: "Shortlisted" },
  { name: "Ananya Gupta", initials: "AG", role: "Frontend Developer", score: 78, status: "Under review" },
];

const interviews = [
  { name: "Priya Mehta", role: "Backend Developer", time: "10:30 AM", type: "Technical round", done: true },
  { name: "Aarav Sharma", role: "Frontend Developer", time: "12:00 PM", type: "HR round", done: false },
  { name: "Rohan Verma", role: "Product Designer", time: "02:30 PM", type: "Portfolio review", done: false },
];

const filters = ["All", "Shortlisted", "Interview", "Under review"];

/* ---------- small pieces ---------- */

const iconPaths: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  briefcase: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.6-3.3 3.1-5 6.5-5s5.9 1.7 6.5 5M16 4.5a3.2 3.2 0 010 6M18 15c2 .5 3.2 2 3.5 5",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  mail: "M3 6h18v12H3zM3 7l9 7 9-7",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  bell: "M6 17V11a6 6 0 0112 0v6l1.5 2h-15zM10 21h4",
};

function Icon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={iconPaths[name]} />
    </svg>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 96;
  const h = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 8)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-24" aria-hidden>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#sg)" opacity="0.5" />
      <path d={line} fill="none" stroke="#c2410c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="#c2410c" />
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8895a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#e8895a" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{String(n).padStart(2, "0")}</>;
}

const statusStyles: Record<string, string> = {
  Shortlisted: "bg-emerald-100/70 text-emerald-800 before:bg-emerald-500",
  Interview: "bg-sky-100/70 text-sky-800 before:bg-sky-500",
  "Under review": "bg-amber-100/70 text-amber-800 before:bg-amber-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium before:h-1.5 before:w-1.5 before:rounded-full ${
        statusStyles[status] ?? "bg-stone-100 text-stone-600 before:bg-stone-400"
      }`}
    >
      {status}
    </span>
  );
}

function MatchMeter({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-200/80">
        <div className="bar h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-700" style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 text-sm font-semibold tabular-nums text-stone-800">{score}</span>
    </div>
  );
}

/* ---------- page ---------- */

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [filter, setFilter] = useState("All");
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  const visible = filter === "All" ? candidates : candidates.filter((c) => c.status === filter);
  const total = pipeline[0].count;

  return (
    <main className="hs min-h-screen bg-[#f6f3ee] text-stone-900 antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        .hs { font-family: 'Inter', system-ui, sans-serif; }
        .hs .display { font-family: 'Fraunces', Georgia, serif; letter-spacing: -0.02em; }
        @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(232,137,90,.55); } 100% { box-shadow: 0 0 0 10px rgba(232,137,90,0); } }
        .rise { opacity: 0; animation: rise .6s cubic-bezier(.2,.7,.2,1) forwards; animation-delay: calc(var(--i, 0) * 70ms); }
        .bar { transform-origin: left; animation: grow .9s cubic-bezier(.2,.7,.2,1) .25s both; }
        .live { animation: pulse-ring 1.8s ease-out infinite; }
        .lift { transition: transform .25s cubic-bezier(.2,.7,.2,1), box-shadow .25s ease, border-color .25s ease; }
        .lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -14px rgba(60,35,15,.25); border-color: #e3d9cb; }
        @media (prefers-reduced-motion: reduce) { .rise, .bar, .live { animation: none; opacity: 1; } .lift { transition: none; } }
      `}</style>

      <div className="flex min-h-screen">
        {/* sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#1b1714] text-stone-300 lg:flex">
          <div className="flex items-center gap-3 px-6 pb-6 pt-7">
            <div className="display flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-700 text-xl font-semibold text-white">
              H
            </div>
            <div>
              <h1 className="display text-lg font-semibold text-stone-50">HireSync</h1>
              <p className="text-[11px] text-stone-500">Recruit. Schedule. Hire.</p>
            </div>
          </div>

          <nav className="mt-4 flex-1 space-y-1 px-3">
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-stone-600">Workspace</p>
            {navigation.map((item) => {
              const on = active === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActive(item.label)}
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ${
                    on ? "bg-white/[0.07] text-white" : "text-stone-400 hover:bg-white/[0.04] hover:text-stone-100"
                  }`}
                >
                  <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-orange-500 transition-all duration-300 ${on ? "opacity-100" : "scale-y-0 opacity-0"}`} />
                  <Icon name={item.icon} className={`h-[18px] w-[18px] transition-colors ${on ? "text-orange-400" : "text-stone-500 group-hover:text-stone-300"}`} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] tabular-nums text-stone-400">{item.badge}</span>}
                </button>
              );
            })}
          </nav>

          <div className="m-4 flex items-center gap-3 rounded-xl border border-white/[0.06] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-sm font-semibold text-orange-300">HR</div>
            <div>
              <p className="text-sm font-medium text-stone-100">HR Admin</p>
              <p className="text-xs text-stone-500">Administrator</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {/* header */}
          <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/70 bg-[#f6f3ee]/80 px-5 py-4 backdrop-blur-md sm:px-10">
            <div className="relative w-full max-w-xs">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                placeholder="Search candidates, jobs…"
                className="w-full rounded-full border border-stone-200 bg-white/70 py-2 pl-9 pr-4 text-sm outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Notifications" className="relative rounded-full border border-stone-200 bg-white/70 p-2.5 text-stone-600 transition hover:bg-white hover:text-stone-900">
                <Icon name="bell" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-[#f6f3ee]" />
              </button>
              <button
                type="button"
                className="group inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,.5)] transition duration-200 hover:-translate-y-0.5 hover:bg-orange-700 active:translate-y-0"
              >
                <Icon name="plus" className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                Create job
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-10">
            {/* hero */}
            <div className="rise relative overflow-hidden rounded-3xl bg-[#1b1714] p-7 text-stone-100 sm:p-10" style={{ ["--i" as string]: 0 }}>
              <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-orange-600/30 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="relative flex flex-wrap items-end justify-between gap-8">
                <div className="max-w-xl">
                  <p className="text-sm text-stone-400">Friday, 30 October</p>
                  <h2 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">
                    {greeting}, <span className="italic text-orange-300">HR Admin.</span>
                  </h2>
                  <p className="mt-4 text-stone-400">
                    Three interviews today and one offer due for a decision. Your pipeline grew by 18 candidates this week.
                  </p>
                </div>
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 pr-6 backdrop-blur">
                  <span className="live relative flex h-3 w-3 rounded-full bg-orange-400" />
                  <div>
                    <p className="text-xs uppercase tracking-wider text-stone-500">Up next</p>
                    <p className="font-medium">Aarav Sharma · HR round</p>
                    <p className="text-sm text-stone-400">12:00 PM · Frontend Developer</p>
                  </div>
                </div>
              </div>
            </div>

            {/* metrics */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((m, i) => (
                <div key={m.label} className="rise lift rounded-2xl border border-stone-200/80 bg-white p-5" style={{ ["--i" as string]: i + 1 }}>
                  <p className="text-sm text-stone-500">{m.label}</p>
                  <div className="mt-3 flex items-end justify-between">
                    <p className="display text-5xl font-medium tabular-nums text-stone-900">
                      <CountUp to={m.value} />
                    </p>
                    <Sparkline data={m.spark} />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
                    <span className="text-stone-500">{m.note}</span>
                    <span className="font-medium text-orange-700">{m.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* pipeline */}
            <div className="rise rounded-2xl border border-stone-200/80 bg-white p-6" style={{ ["--i" as string]: 5 }}>
              <div className="flex items-baseline justify-between">
                <h3 className="display text-xl font-medium">Hiring pipeline</h3>
                <p className="text-xs text-stone-500">Conversion from applied to offer: {((pipeline[3].count / total) * 100).toFixed(1)}%</p>
              </div>
              <div className="mt-5 flex h-3 gap-1 overflow-hidden rounded-full">
                {pipeline.map((p) => (
                  <div key={p.stage} className="bar rounded-full" style={{ width: `${Math.max((p.count / total) * 100, 4)}%`, background: p.color }} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {pipeline.map((p) => (
                  <div key={p.stage} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-sm text-stone-600">{p.stage}</span>
                    <span className="ml-auto text-sm font-semibold tabular-nums">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              {/* candidates */}
              <div className="rise overflow-hidden rounded-2xl border border-stone-200/80 bg-white xl:col-span-2" style={{ ["--i" as string]: 6 }}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-6">
                  <div>
                    <h3 className="display text-xl font-medium">Recent candidates</h3>
                    <p className="mt-1 text-xs text-stone-500">Latest activity across your hiring pipeline</p>
                  </div>
                  <button type="button" className="group inline-flex items-center gap-1.5 text-sm font-medium text-orange-700">
                    View all
                    <Icon name="arrow" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 px-6 pb-4">
                  {filters.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition duration-200 ${
                        filter === f ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-[0.12em] text-stone-400">
                      <tr className="border-y border-stone-100">
                        <th className="px-6 py-3 font-medium">Candidate</th>
                        <th className="px-6 py-3 font-medium">Position</th>
                        <th className="px-6 py-3 font-medium">Match</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((c) => (
                        <tr key={c.name} className="group border-b border-stone-100 last:border-0 transition-colors duration-200 hover:bg-orange-50/40">
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-amber-100 text-xs font-semibold text-orange-800 transition-transform duration-300 group-hover:scale-110">
                                {c.initials}
                              </div>
                              <span className="font-medium text-stone-800">{c.name}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-stone-600">{c.role}</td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <MatchMeter score={c.score} />
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <StatusBadge status={c.status} />
                          </td>
                        </tr>
                      ))}
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-stone-400">
                            No candidates in this stage yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* interviews */}
              <div className="rise rounded-2xl border border-stone-200/80 bg-white" style={{ ["--i" as string]: 7 }}>
                <div className="px-6 pb-4 pt-6">
                  <h3 className="display text-xl font-medium">Today&apos;s interviews</h3>
                  <p className="mt-1 text-xs text-stone-500">Your next scheduled conversations</p>
                </div>

                <ol className="relative px-6 pb-2">
                  <span className="absolute bottom-6 left-[34px] top-2 w-px bg-stone-200" />
                  {interviews.map((it, i) => (
                    <li key={it.name} className="relative flex gap-4 pb-6">
                      <span
                        className={`relative z-[1] mt-1 h-5 w-5 shrink-0 rounded-full border-4 border-white ring-1 ${
                          it.done ? "bg-stone-300 ring-stone-200" : i === 1 ? "live bg-orange-500 ring-orange-300" : "bg-orange-200 ring-orange-200"
                        }`}
                      />
                      <div className="min-w-0 flex-1 rounded-xl p-3 -m-3 transition-colors duration-200 hover:bg-stone-50">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-semibold ${it.done ? "text-stone-400 line-through decoration-stone-300" : ""}`}>{it.name}</p>
                          <span className="text-xs font-semibold tabular-nums text-orange-700">{it.time}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500">{it.role}</p>
                        <span className="mt-2 inline-block rounded-md bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">{it.type}</span>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="border-t border-stone-100 p-4">
                  <button type="button" className="w-full rounded-xl border border-stone-200 py-2.5 text-sm font-medium text-stone-700 transition duration-200 hover:border-stone-900 hover:bg-stone-900 hover:text-white">
                    View interview schedule
                  </button>
                </div>
              </div>
            </div>

            <p className="pb-2 text-center text-xs text-stone-400">HireSync · Hiring, handled.</p>
          </div>
        </section>
      </div>
    </main>
  );
}