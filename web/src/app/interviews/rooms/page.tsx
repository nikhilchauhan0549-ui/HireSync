"use client";

import { useCallback, useEffect, useState } from "react";

type Interview = {
  id: string;
  application_id: string;
  job_id: string;
  interviewer_id: string;
  start_at: string;
  end_at: string;
  status: string;
  meeting_url: string | null;
};

type RecordItem = {
  id: string;
  name?: string | null;
  title?: string | null;
  candidate_name?: string | null;
};

type DashboardData = {
  interviews: Interview[];
  applications: RecordItem[];
  interviewers: RecordItem[];
  jobs: RecordItem[];
};

export default function InterviewRoomsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/interviews", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load interviews.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load interviews."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const interviews = (data?.interviews || []).filter(
    (item) =>
      item.meeting_url &&
      (item.status === "confirmed" || item.status === "completed")
  );

  function lookup(
    items: RecordItem[] | undefined,
    id: string,
    field: keyof RecordItem
  ) {
    const item = items?.find((record) => record.id === id);
    return item?.[field] || "Unknown";
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-700">HireSync</p>
            <h1 className="mt-2 text-3xl font-bold">Interview rooms</h1>
            <p className="mt-2 text-gray-600">
              Find and join confirmed candidate video interviews.
            </p>
          </div>

          <a
            href="/interviews"
            className="rounded-lg border bg-white px-4 py-3 font-semibold text-gray-700"
          >
            Back to scheduling
          </a>
        </header>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-sm text-gray-600">Loading interview rooms...</p>
        )}

        {!loading && interviews.length === 0 && (
          <section className="rounded-xl border bg-white p-8 text-center">
            <h2 className="font-bold">No confirmed video meetings</h2>
            <p className="mt-2 text-sm text-gray-600">
              Confirmed interviews with meeting links will appear here.
            </p>
          </section>
        )}

        <section className="space-y-4">
          {interviews.map((item) => (
            <article
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5"
            >
              <div>
                <h2 className="font-bold">
                  {lookup(data?.applications, item.application_id, "candidate_name")}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {lookup(data?.jobs, item.job_id, "title")}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Interviewer:{" "}
                  {lookup(data?.interviewers, item.interviewer_id, "name")}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  {new Date(item.start_at).toLocaleString()} –{" "}
                  {new Date(item.end_at).toLocaleTimeString()}
                </p>
                <p className="mt-1 text-xs capitalize text-gray-500">
                  Status: {item.status}
                </p>
              </div>

              <a
                href={`/interviews/${encodeURIComponent(item.id)}/room`}
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Join interview
              </a>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}