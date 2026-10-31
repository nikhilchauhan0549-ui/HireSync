"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";

type CriterionResult = {
  key: string;
  label: string;
  score: number;
  weight: number;
  weighted_contribution: number;
  explanation: string;
  evidence_ids: string[];
  evidence_status: string;
};

type AssessmentResult = {
  assessmentId: string;
  applicationId: string;
  totalScore: number;
  status: string;
  criteria: CriterionResult[];
  modelProvider: string;
  modelName: string;
};

function AssessmentContent() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;

  const [processing, setProcessing] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] =
    useState<AssessmentResult | null>(null);

  async function reprocessResume() {
    setProcessing(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/reprocess`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Resume reprocessing failed."
        );
      }

      setMessage(
        `Resume reprocessed successfully. ${data.evidenceCount} evidence records saved. Calculated experience: ${data.experienceYears} years.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected reprocessing error."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function runAssessment() {
    setAssessing(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/assess`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Assessment could not be completed."
        );
      }

      setResult(data.assessment);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected assessment error."
      );
    } finally {
      setAssessing(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <a
            href="/candidates/upload"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to resume upload
          </a>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Candidate assessment
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Reprocess the saved resume to improve its evidence
            records, then assess the candidate against the job
            rubric.
          </p>
        </div>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Application ID
            </p>

            <p className="mt-1 break-all text-sm text-gray-800">
              {applicationId}
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            First reprocess the original resume. This updates
            the extracted profile and replaces old evidence
            records. It does not require another upload.
          </div>

          <button
            type="button"
            onClick={reprocessResume}
            disabled={processing || assessing}
            className="w-full rounded-lg border border-blue-600 px-5 py-3 font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing
              ? "Reprocessing saved resume..."
              : "1. Reprocess saved resume"}
          </button>

          <button
            type="button"
            onClick={runAssessment}
            disabled={processing || assessing}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {assessing
              ? "Assessing candidate..."
              : "2. Run candidate assessment"}
          </button>

          <p className="text-xs leading-5 text-gray-500">
            Run the reprocessing action first. The assessment
            action uses the latest saved extraction and evidence.
          </p>
        </section>

        {processing && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Gemini is reading the original stored resume and
            collecting employment, skill and education evidence.
          </p>
        )}

        {assessing && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Gemini is evaluating the rubric criteria and
            calculating the weighted score.
          </p>
        )}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <strong>Operation failed</strong>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        )}

        {result && (
          <>
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <p className="text-sm font-medium text-gray-500">
                Overall assessment score
              </p>

              <p className="mt-2 text-5xl font-bold text-gray-900">
                {result.totalScore.toFixed(2)}
                <span className="text-xl text-gray-500">
                  {" "}/ 100
                </span>
              </p>

              <p className="mt-3 text-sm">
                Status: <strong>{result.status}</strong>
              </p>

              {result.status === "needs_review" && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Human review is required because some
                  criteria have insufficient or conflicting
                  evidence.
                </p>
              )}

              <p className="mt-3 text-xs text-gray-500">
                Model: {result.modelName}
              </p>

              <p className="mt-1 break-all text-xs text-gray-500">
                Assessment ID: {result.assessmentId}
              </p>
            </section>

            <h2 className="text-xl font-bold text-gray-900">
              Scoring breakdown
            </h2>

            {result.criteria.map((item) => (
              <article
                key={item.key}
                className="mb-4 rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {item.label}
                    </h3>

                    <p className="text-sm text-gray-500">
                      Weight: {item.weight.toFixed(2)}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {item.score.toFixed(2)}/100
                    </p>

                    <p className="text-xs text-gray-500">
                      Contribution:{" "}
                      {item.weighted_contribution.toFixed(2)}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-gray-700">
                  {item.explanation}
                </p>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>
                    Evidence: {item.evidence_status}
                  </span>

                  <span>
                    Linked records: {item.evidence_ids.length}
                  </span>
                </div>
              </article>
            ))}

            <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
              AI assessment is decision support only. Final
              hiring decisions must be made by a human reviewer.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function CandidateAssessmentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 p-10">
          <p className="text-gray-600">
            Loading candidate assessment...
          </p>
        </main>
      }
    >
      <AssessmentContent />
    </Suspense>
  );
}