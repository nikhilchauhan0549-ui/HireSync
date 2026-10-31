"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

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

type Application = {
  id: string;
  candidate_name: string | null;
  candidate_email: string | null;
};

type Interviewer = {
  id: string;
  name: string;
};

type SavedFeedback = {
  id: string;
  technical_score: number;
  communication_score: number;
  problem_solving_score: number;
  role_fit_score: number;
  overall_score: number;
  recommendation: string;
  strengths: string;
  concerns: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

const ratingFields = [
  {
    key: "technicalScore",
    label: "Technical knowledge",
    description: "Technical skills and job-related knowledge.",
  },
  {
    key: "communicationScore",
    label: "Communication",
    description: "Clarity, listening and communication.",
  },
  {
    key: "problemSolvingScore",
    label: "Problem solving",
    description: "Reasoning, approach and problem-solving ability.",
  },
  {
    key: "roleFitScore",
    label: "Role alignment",
    description: "Suitability for the responsibilities of this role.",
  },
] as const;

type ScoreKey =
  (typeof ratingFields)[number]["key"];

type Scores = Record<ScoreKey, number>;

const initialScores: Scores = {
  technicalScore: 50,
  communicationScore: 50,
  problemSolvingScore: 50,
  roleFitScore: 50,
};

async function readResponse(response: Response) {
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || "The request could not be completed."
    );
  }

  return data;
}

export default function InterviewFeedbackPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);

  const [selectedId, setSelectedId] = useState("");
  const [feedback, setFeedback] =
    useState<SavedFeedback | null>(null);

  const [scores, setScores] =
    useState<Scores>(initialScores);

  const [recommendation, setRecommendation] =
    useState("mixed");

  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const eligibleInterviews = useMemo(
    () =>
      interviews.filter(
        (item) =>
          item.status === "confirmed" ||
          item.status === "completed"
      ),
    [interviews]
  );

  const selectedInterview = eligibleInterviews.find(
    (item) => item.id === selectedId
  );

  const candidate = applications.find(
    (item) =>
      item.id === selectedInterview?.application_id
  );

  const interviewer = interviewers.find(
    (item) =>
      item.id === selectedInterview?.interviewer_id
  );

  const overallPreview = Number(
    (
      (
        scores.technicalScore +
        scores.communicationScore +
        scores.problemSolvingScore +
        scores.roleFitScore
      ) / 4
    ).toFixed(2)
  );

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/interviews", {
        cache: "no-store",
      });

      const data = await readResponse(response);

      setInterviews(data.interviews || []);
      setApplications(data.applications || []);
      setInterviewers(data.interviewers || []);

      const available = (
        data.interviews as Interview[]
      ).filter(
        (item) =>
          item.status === "confirmed" ||
          item.status === "completed"
      );

      if (available.length > 0) {
        setSelectedId((current) =>
          available.some((item) => item.id === current)
            ? current
            : available[0].id
        );
      } else {
        setSelectedId("");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load interviews."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFeedback = useCallback(
    async (interviewId: string) => {
      if (!interviewId) {
        setFeedback(null);
        return;
      }

      setLoadingFeedback(true);
      setError("");

      try {
        const response = await fetch(
          `/api/interviews/${encodeURIComponent(interviewId)}/feedback`,
          { cache: "no-store" }
        );

        const data = await readResponse(response);

        const previous: SavedFeedback | null =
          data.feedback?.[0] || null;

        setFeedback(previous);

        if (previous) {
          setScores({
            technicalScore: Number(previous.technical_score),
            communicationScore: Number(
              previous.communication_score
            ),
            problemSolvingScore: Number(
              previous.problem_solving_score
            ),
            roleFitScore: Number(previous.role_fit_score),
          });

          setRecommendation(previous.recommendation);
          setStrengths(previous.strengths || "");
          setConcerns(previous.concerns || "");
          setNotes(previous.notes || "");
        } else {
          setScores(initialScores);
          setRecommendation("mixed");
          setStrengths("");
          setConcerns("");
          setNotes("");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load feedback history."
        );
      } finally {
        setLoadingFeedback(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadInterviews();
  }, [loadInterviews]);

  useEffect(() => {
    if (selectedId) {
      void loadFeedback(selectedId);
    }
  }, [selectedId, loadFeedback]);

  async function saveFeedback(event: FormEvent) {
    event.preventDefault();

    if (!selectedInterview) {
      setError("Select an eligible interview first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/interviews/${encodeURIComponent(selectedInterview.id)}/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...scores,
            recommendation,
            strengths,
            concerns,
            notes,
          }),
        }
      );

      const data = await readResponse(response);

      setMessage(
        `Feedback saved. Overall score: ${Number(
          data.overallScore
        ).toFixed(2)}/100.`
      );

      await loadFeedback(selectedInterview.id);
      await loadInterviews();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save feedback."
      );
    } finally {
      setSaving(false);
    }
  }

  function updateScore(key: ScoreKey, value: number) {
    setScores((current) => ({
      ...current,
      [key]: Math.min(100, Math.max(0, value)),
    }));
  }

  function getCandidateName(applicationId: string) {
    return (
      applications.find((item) => item.id === applicationId)
        ?.candidate_name || "Unnamed candidate"
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-900">
      <div className="mx-auto max-w-4xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              HireSync Recruitment
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Interview feedback
            </h1>

            <p className="mt-2 text-gray-600">
              Record interviewer ratings, observations and recommendations.
            </p>
          </div>

          <a
            href="/interviews"
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to interviews
          </a>
        </header>

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

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              Select an interview
            </h2>

            <button
              type="button"
              onClick={() => void loadInterviews()}
              disabled={loading}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-gray-500">
              Loading interviews...
            </p>
          ) : eligibleInterviews.length === 0 ? (
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              No confirmed or completed interviews are available
              for feedback yet. The candidate must accept an interview
              invitation before feedback can be recorded.
            </div>
          ) : (
            <select
              value={selectedId}
              onChange={(event) =>
                setSelectedId(event.target.value)
              }
              className="mt-4 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
            >
              {eligibleInterviews.map((item) => (
                <option key={item.id} value={item.id}>
                  {getCandidateName(item.application_id)}
                  {" — "}
                  {new Date(item.start_at).toLocaleString()}
                  {" — "}
                  {item.status}
                </option>
              ))}
            </select>
          )}

          {selectedInterview && (
            <div className="mt-5 grid gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-500">Candidate</p>
                <p className="mt-1 font-semibold">
                  {candidate?.candidate_name ||
                    "Unnamed candidate"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Interviewer</p>
                <p className="mt-1 font-semibold">
                  {interviewer?.name || "Interviewer"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Interview status</p>
                <p className="mt-1 font-semibold capitalize">
                  {selectedInterview.status}
                </p>
              </div>
            </div>
          )}
        </section>

        {selectedInterview && (
          <form
            onSubmit={saveFeedback}
            className="space-y-6"
          >
            <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
              <div>
                <h2 className="text-xl font-bold">
                  Interview ratings
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  Rate each area from 0 to 100. All four categories
                  contribute equally to the overall rating.
                </p>
              </div>

              {ratingFields.map((field) => (
                <div
                  key={field.key}
                  className="space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label
                        htmlFor={field.key}
                        className="font-semibold text-gray-900"
                      >
                        {field.label}
                      </label>

                      <p className="text-xs text-gray-500">
                        {field.description}
                      </p>
                    </div>

                    <span className="text-xl font-bold tabular-nums">
                      {scores[field.key]}
                    </span>
                  </div>

                  <input
                    id={field.key}
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={scores[field.key]}
                    onChange={(event) =>
                      updateScore(
                        field.key,
                        Number(event.target.value)
                      )
                    }
                    className="w-full accent-blue-600"
                  />

                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0 — Not demonstrated</span>
                    <span>100 — Excellent</span>
                  </div>
                </div>
              ))}

              <div className="rounded-xl bg-blue-50 p-5">
                <p className="text-sm font-medium text-blue-900">
                  Calculated overall score
                </p>

                <p className="mt-1 text-4xl font-bold text-blue-900">
                  {overallPreview.toFixed(2)}
                  <span className="text-lg font-medium"> / 100</span>
                </p>

                <p className="mt-2 text-xs text-blue-800">
                  The server recalculates this score when saving.
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-bold">
                Recommendation
              </h2>

              <label className="block space-y-2">
                <span className="text-sm font-semibold">
                  Interview recommendation
                </span>

                <select
                  value={recommendation}
                  onChange={(event) =>
                    setRecommendation(event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                >
                  <option value="strong_yes">
                    Strong yes
                  </option>
                  <option value="yes">
                    Yes
                  </option>
                  <option value="mixed">
                    Mixed / Further evaluation
                  </option>
                  <option value="no">
                    No
                  </option>
                  <option value="strong_no">
                    Strong no
                  </option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold">
                  Candidate strengths
                </span>

                <textarea
                  value={strengths}
                  onChange={(event) =>
                    setStrengths(event.target.value)
                  }
                  rows={3}
                  maxLength={5000}
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                  placeholder="What did the candidate demonstrate well?"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold">
                  Concerns or development areas
                </span>

                <textarea
                  value={concerns}
                  onChange={(event) =>
                    setConcerns(event.target.value)
                  }
                  rows={3}
                  maxLength={5000}
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                  placeholder="What needs further evaluation?"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold">
                  Interview notes
                </span>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  rows={5}
                  maxLength={10000}
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                  placeholder="Record relevant, job-related interview observations..."
                />
              </label>

              <button
                type="submit"
                disabled={saving || loadingFeedback}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {saving
                  ? "Saving feedback..."
                  : feedback
                    ? "Update interview feedback"
                    : "Save interview feedback"}
              </button>
            </section>
          </form>
        )}

        {feedback && (
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="font-bold">
              Previously saved feedback
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Last updated:{" "}
              {new Date(feedback.updated_at).toLocaleString()}
            </p>

            <p className="mt-2 text-sm">
              Recommendation:{" "}
              <strong>
                {feedback.recommendation.replaceAll("_", " ")}
              </strong>
            </p>
          </section>
        )}
      </div>
    </main>
  );
}