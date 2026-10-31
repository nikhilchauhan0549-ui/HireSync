
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

type RecordData = Record<string, unknown>;

type InterviewFeedback = {
  id: string;
  interviewId: string;
  interviewerId: string;
  interviewerName: string;
  interviewerEmail: string | null;
  interviewStartAt: string | null;
  interviewEndAt: string | null;
  interviewStatus: string;
  technicalScore: number | null;
  communicationScore: number | null;
  problemSolvingScore: number | null;
  roleFitScore: number | null;
  overallScore: number | null;
  recommendation: string;
  strengths: string | null;
  concerns: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Candidate = {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string | null;
  phone: string | null;
  processingStatus: string;
  reviewStatus: string;
  decision: string;
  decisionNote: string | null;
  createdAt: string;
  profile: RecordData | null;
  extractionId?: string | null;
  assessment: {
    id: string;
    totalScore: number | null;
    status: string;
    modelProvider: string | null;
    modelName: string | null;
    createdAt: string;
    criteria: RecordData[];
  } | null;
  evidence: RecordData[];
  interviewFeedback: InterviewFeedback[];
};

type Job = {
  id: string;
  title: string;
  status: string;
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleDateString();
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

function formatScore(value: number | null): string {
  if (value === null || !Number.isFinite(Number(value))) {
    return "Not scored";
  }

  return `${Number(value).toFixed(1)} / 100`;
}

function formatRecommendation(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function readResponse(response: Response) {
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || "The request could not be completed."
    );
  }

  return data;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/candidates", {
        cache: "no-store",
      });

      const data = await readResponse(response);

      setCandidates(
        (data.candidates || []).map((candidate: Candidate) => ({
          ...candidate,
          interviewFeedback: candidate.interviewFeedback || [],
          evidence: candidate.evidence || [],
        }))
      );

      setJobs(data.jobs || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load candidates."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return candidates.filter((candidate) => {
      const matchesJob =
        jobFilter === "all" ||
        candidate.jobId === jobFilter;

      const matchesDecision =
        decisionFilter === "all" ||
        candidate.decision === decisionFilter;

      const matchesSearch =
        !query ||
        candidate.name.toLowerCase().includes(query) ||
        (candidate.email || "").toLowerCase().includes(query) ||
        candidate.jobTitle.toLowerCase().includes(query);

      return matchesJob && matchesDecision && matchesSearch;
    });
  }, [candidates, jobFilter, decisionFilter, search]);

  async function saveDecision(
    event: FormEvent<HTMLFormElement>,
    candidate: Candidate
  ) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const decision = String(
      formData.get("decision") || "pending_review"
    );

    const decisionNote = String(
      formData.get("decisionNote") || ""
    );

    setSavingId(candidate.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "decision",
          applicationId: candidate.id,
          decision,
          decisionNote,
        }),
      });

      await readResponse(response);

      setMessage(`Decision saved for ${candidate.name}.`);

      await loadCandidates();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save candidate decision."
      );
    } finally {
      setSavingId("");
    }
  }

  async function reviewEvidence(
    candidate: Candidate,
    evidenceId: string,
    reviewStatus: string
  ) {
    setSavingId(evidenceId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "evidence",
          applicationId: candidate.id,
          evidenceId,
          reviewStatus,
        }),
      });

      await readResponse(response);

      setMessage("Evidence review saved.");

      await loadCandidates();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to review evidence."
      );
    } finally {
      setSavingId("");
    }
  }

  const pendingCount = candidates.filter(
    (item) => item.decision === "pending_review"
  ).length;

  const shortlistedCount = candidates.filter(
    (item) => item.decision === "shortlisted"
  ).length;

  const reviewedEvidenceCount = candidates.reduce(
    (total, candidate) =>
      total +
      candidate.evidence.filter(
        (item) =>
          item.review_status === "accepted" ||
          item.review_status === "rejected"
      ).length,
    0
  );

  const interviewFeedbackCount = candidates.reduce(
    (total, candidate) =>
      total + candidate.interviewFeedback.length,
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-900">
      <div className="mx-auto max-w-7xl space-y-7">

        {/* Page header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              HireSync Recruitment
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Candidate management
            </h1>

            <p className="mt-2 text-gray-600">
              Review candidate profiles, evidence, AI assessments,
              interview feedback and hiring decisions.
            </p>
          </div>

          <a
            href="/candidates/upload"
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Upload resume
          </a>
        </header>

        {/* Notifications */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {message}
          </div>
        )}

        {/* Dashboard metrics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm font-medium text-gray-500">
              Total candidates
            </p>
            <p className="mt-2 text-3xl font-bold">
              {candidates.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm font-medium text-gray-500">
              Pending review
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-700">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm font-medium text-gray-500">
              Shortlisted
            </p>
            <p className="mt-2 text-3xl font-bold text-green-700">
              {shortlistedCount}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm font-medium text-gray-500">
              Evidence reviewed
            </p>
            <p className="mt-2 text-3xl font-bold">
              {reviewedEvidenceCount}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm font-medium text-gray-500">
              Interview reviews
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {interviewFeedbackCount}
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search candidate, email or job..."
            className="min-w-56 flex-1 rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder:text-gray-500"
          />

          <select
            value={jobFilter}
            onChange={(event) => setJobFilter(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
          >
            <option value="all">All jobs</option>

            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>

          <select
            value={decisionFilter}
            onChange={(event) =>
              setDecisionFilter(event.target.value)
            }
            className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
          >
            <option value="all">All decisions</option>
            <option value="pending_review">Pending review</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="not_shortlisted">
              Not shortlisted
            </option>
          </select>

          <button
            type="button"
            onClick={() => void loadCandidates()}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </section>

        {/* Loading and empty states */}
        {loading && (
          <p className="py-8 text-center text-gray-600">
            Loading candidate records...
          </p>
        )}

        {!loading && filteredCandidates.length === 0 && (
          <section className="rounded-xl border bg-white p-10 text-center">
            <h2 className="text-xl font-semibold">
              No candidates found
            </h2>
            <p className="mt-2 text-gray-600">
              Upload a resume or change your filters.
            </p>
          </section>
        )}

        {/* Candidate list */}
        {!loading && (
          <section className="space-y-4">
            {filteredCandidates.map((candidate) => {
              const profile = candidate.profile || {};

              const skills = arrayValue(profile.skills);
              const work = arrayValue(profile.work_experience);
              const education = arrayValue(profile.education);
              const evidence = candidate.evidence || [];
              const feedback = candidate.interviewFeedback || [];

              return (
                <article
                  key={candidate.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  <details>
                    {/* Candidate summary */}
                    <summary className="cursor-pointer list-none p-5 hover:bg-gray-50">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-lg font-bold text-gray-900">
                            {candidate.name}
                          </h2>

                          <p className="mt-1 text-sm text-gray-600">
                            {candidate.email || "No email extracted"}
                            {" · "}
                            {candidate.jobTitle}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Added: {formatDate(candidate.createdAt)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {candidate.assessment ? (
                            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
                              {candidate.assessment.totalScore === null
                                ? "Score unavailable"
                                : `${Number(candidate.assessment.totalScore).toFixed(2)} / 100`}
                            </span>
                          ) : (
                            <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
                              Not assessed
                            </span>
                          )}

                          <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700">
                            {candidate.decision.replaceAll("_", " ")}
                          </span>

                          {feedback.length > 0 && (
                            <span className="rounded-full bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800">
                              {feedback.length} interview reviews
                            </span>
                          )}

                          <span className="text-sm font-semibold text-blue-700">
                            View profile ↓
                          </span>
                        </div>
                      </div>
                    </summary>

                    <div className="space-y-6 border-t border-gray-200 p-5">

                      {/* Candidate details */}
                      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500">
                            Phone
                          </p>
                          <p className="mt-1 font-medium">
                            {candidate.phone || "Not available"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-500">
                            Current role
                          </p>
                          <p className="mt-1 font-medium">
                            {textValue(profile.current_role) ||
                              "Not available"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-500">
                            Calculated experience
                          </p>
                          <p className="mt-1 font-medium">
                            {Number(
                              profile.total_experience_years || 0
                            ).toFixed(2)} years
                          </p>
                        </div>
                      </section>

                      {/* Professional summary */}
                      <section>
                        <h3 className="font-bold">
                          Professional summary
                        </h3>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {textValue(profile.professional_summary) ||
                            "No summary available."}
                        </p>
                      </section>

                      {/* Skills */}
                      <section>
                        <h3 className="font-bold">Skills</h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {skills.length > 0 ? (
                            skills.map((skill, index) => (
                              <span
                                key={`${String(skill)}-${index}`}
                                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
                              >
                                {String(skill)}
                              </span>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">
                              No skills extracted.
                            </p>
                          )}
                        </div>
                      </section>

                      {/* Work experience */}
                      <section>
                        <h3 className="font-bold">
                          Work experience
                        </h3>

                        <div className="mt-3 space-y-3">
                          {work.length > 0 ? (
                            work.map((item, index) => {
                              const row = item as RecordData;

                              return (
                                <div
                                  key={index}
                                  className="rounded-lg border border-gray-200 p-4"
                                >
                                  <p className="font-semibold">
                                    {textValue(row.job_title)}
                                  </p>

                                  <p className="mt-1 text-sm text-gray-600">
                                    {textValue(row.company)}
                                    {" · "}
                                    {textValue(row.start_date)}
                                    {" – "}
                                    {textValue(row.end_date)}
                                  </p>

                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                                    {textValue(row.description)}
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-gray-500">
                              No employment details available.
                            </p>
                          )}
                        </div>
                      </section>

                      {/* Education */}
                      <section>
                        <h3 className="font-bold">Education</h3>

                        <div className="mt-3 space-y-2">
                          {education.length > 0 ? (
                            education.map((item, index) => {
                              const row = item as RecordData;

                              return (
                                <div
                                  key={index}
                                  className="rounded-lg border border-gray-200 p-3"
                                >
                                  <p className="font-medium">
                                    {textValue(row.degree)}
                                    {" — "}
                                    {textValue(row.field_of_study)}
                                  </p>

                                  <p className="mt-1 text-sm text-gray-600">
                                    {textValue(row.institution)}
                                    {" · "}
                                    {textValue(row.graduation_year)}
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-gray-500">
                              No education details available.
                            </p>
                          )}
                        </div>
                      </section>

                      {/* AI assessment */}
                      <section>
                        <h3 className="font-bold">
                          AI assessment
                        </h3>

                        {candidate.assessment ? (
                          <div className="mt-3 space-y-3">
                            <div className="rounded-lg bg-gray-50 p-4">
                              <div className="flex flex-wrap justify-between gap-3">
                                <p className="font-semibold">
                                  Overall score
                                </p>

                                <p className="text-2xl font-bold">
                                  {candidate.assessment.totalScore === null
                                    ? "Unavailable"
                                    : `${Number(candidate.assessment.totalScore).toFixed(2)} / 100`}
                                </p>
                              </div>

                              <p className="mt-2 text-sm text-gray-600">
                                Status: {candidate.assessment.status}
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                Model:{" "}
                                {candidate.assessment.modelName || "Unknown"}
                              </p>
                            </div>

                            {candidate.assessment.criteria.map(
                              (criterion, index) => (
                                <div
                                  key={String(criterion.id || index)}
                                  className="rounded-lg border border-gray-200 p-4"
                                >
                                  <div className="flex flex-wrap justify-between gap-2">
                                    <p className="font-semibold">
                                      {textValue(criterion.label)}
                                    </p>

                                    <p className="font-bold">
                                      {Number(
                                        criterion.score || 0
                                      ).toFixed(2)}
                                      /100
                                    </p>
                                  </div>

                                  <p className="mt-1 text-xs text-gray-500">
                                    Weight:{" "}
                                    {Number(
                                      criterion.weight || 0
                                    ).toFixed(2)}%
                                    {" · "}
                                    Evidence:{" "}
                                    {textValue(criterion.evidence_status)}
                                  </p>

                                  <p className="mt-2 text-sm leading-6 text-gray-700">
                                    {textValue(criterion.explanation)}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-gray-500">
                            No assessment has been saved for this candidate.
                          </p>
                        )}
                      </section>

                      {/* Interview feedback history */}
                      <section className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-gray-900">
                              Interview feedback history
                            </h3>

                            <p className="mt-1 text-sm text-gray-600">
                              Interviewer assessments and recommendations
                              for this candidate.
                            </p>
                          </div>

                          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                            {feedback.length} reviews
                          </span>
                        </div>

                        {feedback.length > 0 ? (
                          <div className="mt-4 space-y-4">
                            {feedback.map((item) => (
                              <article
                                key={item.id}
                                className="rounded-lg border border-gray-200 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <h4 className="font-bold text-gray-900">
                                      {item.interviewerName}
                                    </h4>

                                    <p className="mt-1 text-sm text-gray-500">
                                      {item.interviewerEmail ||
                                        "No email available"}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-500">
                                      Interview:{" "}
                                      {item.interviewStartAt
                                        ? formatDateTime(
                                            item.interviewStartAt
                                          )
                                        : formatDateTime(item.createdAt)}
                                    </p>
                                  </div>

                                  <div className="text-right">
                                    <p className="text-xs font-medium uppercase text-gray-500">
                                      Overall score
                                    </p>

                                    <p className="mt-1 text-2xl font-bold text-blue-700">
                                      {formatScore(item.overallScore)}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                  {[
                                    {
                                      label: "Technical",
                                      score: item.technicalScore,
                                    },
                                    {
                                      label: "Communication",
                                      score: item.communicationScore,
                                    },
                                    {
                                      label: "Problem solving",
                                      score: item.problemSolvingScore,
                                    },
                                    {
                                      label: "Role fit",
                                      score: item.roleFitScore,
                                    },
                                  ].map((scoreItem) => (
                                    <div
                                      key={scoreItem.label}
                                      className="rounded-lg bg-gray-50 p-3"
                                    >
                                      <p className="text-xs text-gray-500">
                                        {scoreItem.label}
                                      </p>

                                      <p className="mt-1 font-bold text-gray-900">
                                        {formatScore(scoreItem.score)}
                                      </p>
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-4">
                                  <p className="text-xs font-medium text-gray-500">
                                    Interview recommendation
                                  </p>

                                  <span className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                                    {formatRecommendation(
                                      item.recommendation
                                    )}
                                  </span>
                                </div>

                                {item.strengths && (
                                  <div className="mt-4">
                                    <p className="text-sm font-semibold text-green-800">
                                      Strengths
                                    </p>

                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                                      {item.strengths}
                                    </p>
                                  </div>
                                )}

                                {item.concerns && (
                                  <div className="mt-4">
                                    <p className="text-sm font-semibold text-amber-800">
                                      Concerns
                                    </p>

                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                                      {item.concerns}
                                    </p>
                                  </div>
                                )}

                                {item.notes && (
                                  <div className="mt-4">
                                    <p className="text-sm font-semibold text-gray-800">
                                      Interviewer notes
                                    </p>

                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                                      {item.notes}
                                    </p>
                                  </div>
                                )}

                                <p className="mt-4 border-t pt-3 text-xs capitalize text-gray-500">
                                  Interview status:{" "}
                                  {item.interviewStatus.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-5 text-center">
                            <p className="font-medium text-gray-700">
                              No interview feedback yet
                            </p>

                            <p className="mt-1 text-sm text-gray-500">
                              Feedback submitted by interviewers will
                              appear here.
                            </p>
                          </div>
                        )}
                      </section>

                      {/* Resume evidence review */}
                      <section>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="font-bold">
                            Resume evidence review
                          </h3>

                          <span className="text-xs text-gray-500">
                            {evidence.length} records
                          </span>
                        </div>

                        <div className="mt-3 space-y-3">
                          {evidence.length > 0 ? (
                            evidence.map((item) => {
                              const evidenceId = String(item.id);
                              const section = textValue(item.section_name);

                              const isVisual = section.startsWith(
                                "AI_OCR_UNVERIFIED"
                              );

                              return (
                                <div
                                  key={evidenceId}
                                  className="rounded-lg border border-gray-200 p-4"
                                >
                                  <div className="flex flex-wrap justify-between gap-2">
                                    <p className="font-semibold">
                                      {textValue(item.claim_key)}
                                    </p>

                                    <span className="text-xs text-gray-500">
                                      {textValue(item.review_status)}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-sm font-medium text-gray-800">
                                    {textValue(item.claim_text)}
                                  </p>

                                  <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-700">
                                    {textValue(item.source_excerpt)}
                                  </blockquote>

                                  <p className="mt-2 text-xs text-gray-500">
                                    Page:{" "}
                                    {String(item.page_number ?? "Unknown")}
                                    {" · "}
                                    Section: {section}
                                    {" · "}
                                    Confidence:{" "}
                                    {Number(item.confidence || 0).toFixed(2)}
                                  </p>

                                  {isVisual && (
                                    <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                                      Visually transcribed evidence.
                                      Verify it against the original
                                      resume before accepting it.
                                    </p>
                                  )}

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={savingId === evidenceId}
                                      onClick={() =>
                                        void reviewEvidence(
                                          candidate,
                                          evidenceId,
                                          "accepted"
                                        )
                                      }
                                      className="rounded-lg border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                                    >
                                      Accept evidence
                                    </button>

                                    <button
                                      type="button"
                                      disabled={savingId === evidenceId}
                                      onClick={() =>
                                        void reviewEvidence(
                                          candidate,
                                          evidenceId,
                                          "rejected"
                                        )
                                      }
                                      className="rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Reject evidence
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-gray-500">
                              No evidence records available.
                            </p>
                          )}
                        </div>
                      </section>

                      {/* Human hiring decision */}
                      <section className="rounded-xl border border-gray-200 p-5">
                        <h3 className="font-bold">
                          Human hiring decision
                        </h3>

                        <p className="mt-1 text-sm text-gray-600">
                          AI scores are decision support only.
                          The final decision belongs to the reviewer.
                        </p>

                        <form
                          className="mt-4 space-y-3"
                          onSubmit={(event) =>
                            void saveDecision(event, candidate)
                          }
                        >
                          <label className="block space-y-1">
                            <span className="text-sm font-medium">
                              Decision
                            </span>

                            <select
                              name="decision"
                              defaultValue={
                                candidate.decision || "pending_review"
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                            >
                              <option value="pending_review">
                                Pending review
                              </option>

                              <option value="shortlisted">
                                Shortlisted
                              </option>

                              <option value="not_shortlisted">
                                Not shortlisted
                              </option>
                            </select>
                          </label>

                          <label className="block space-y-1">
                            <span className="text-sm font-medium">
                              Reviewer notes
                            </span>

                            <textarea
                              name="decisionNote"
                              rows={3}
                              defaultValue={candidate.decisionNote || ""}
                              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                              placeholder="Document the reason for your decision..."
                            />
                          </label>

                          <button
                            type="submit"
                            disabled={savingId === candidate.id}
                            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingId === candidate.id
                              ? "Saving..."
                              : "Save human decision"}
                          </button>
                        </form>
                      </section>
                    </div>
                  </details>
                </article>
              );
            })}
          </section>
        )}

        {/* Footer navigation */}
        <footer className="flex flex-wrap gap-4 border-t border-gray-200 pt-5 text-sm">
          <a
            href="/interviews"
            className="font-semibold text-blue-700 hover:underline"
          >
            Interview scheduling
          </a>

          <a
            href="/interviews/rooms"
            className="font-semibold text-blue-700 hover:underline"
          >
            Interview rooms
          </a>

          <a
            href="/jobs"
            className="font-semibold text-blue-700 hover:underline"
          >
            Jobs
          </a>

          <a
            href="/"
            className="font-semibold text-blue-700 hover:underline"
          >
            Overview
          </a>
        </footer>
      </div>
    </main>
  );
}
