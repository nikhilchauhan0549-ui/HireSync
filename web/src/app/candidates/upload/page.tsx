
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

type Job = {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
};

type ResumeCandidate = {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  professional_summary: string;
  total_experience_years: number;
  current_role: string;
  skills: string[];
  work_experience: {
    job_title: string;
    company: string;
    start_date: string;
    end_date: string;
    description: string;
  }[];
  education: {
    degree: string;
    institution: string;
    field_of_study: string;
    graduation_year: string;
  }[];
  evidence: {
    claim_text: string;
    source_excerpt: string;
    page_number: number;
    section_name: string;
    confidence: number;
  }[];
};

type UploadResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  applicationId?: string;
  processingStatus?: string;
  candidate?: ResumeCandidate;
};

export default function CandidateUploadPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");

  const [jobId, setJobId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load jobs from the existing Jobs API.

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      try {
        const response = await fetch("/api/jobs", {
          cache: "no-store",
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load jobs.");
        }

        if (!cancelled) {
          const availableJobs = (payload.jobs ?? []).filter(
            (job: Job) => job.status !== "archived"
          );

          setJobs(availableJobs);
        }
      } catch (err) {
        if (!cancelled) {
          setJobsError(
            err instanceof Error
              ? err.message
              : "Unable to load jobs."
          );
        }
      } finally {
        if (!cancelled) {
          setJobsLoading(false);
        }
      }
    }

    void loadJobs();

    return () => {
      cancelled = true;
    };
  }, []);

  // Submit only the selected job and resume.
  // Gemini extracts candidate details automatically.

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setResult(null);

    if (!jobId) {
      setError("Please select a job.");
      return;
    }

    if (!file) {
      setError("Please select a PDF or DOCX resume.");
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isDocx = lowerName.endsWith(".docx");

    if (!isPdf && !isDocx) {
      setError("Only PDF and DOCX resumes are supported.");
      return;
    }

    if (file.size === 0 || file.size > 12 * 1024 * 1024) {
      setError("The resume must be greater than 0 bytes and no larger than 12 MB.");
      return;
    }

    const formData = new FormData();

    formData.append("jobId", jobId);
    formData.append("file", file);

    setSubmitting(true);

    try {
      const response = await fetch("/api/applications/upload", {
        method: "POST",
        body: formData,
      });

      const payload: UploadResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Resume processing failed."
        );
      }

      setResult(payload);
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected upload error."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const candidate = result?.candidate;

  return (
    <main className="min-h-screen bg-[#f5f2ed] px-5 py-8 text-[#29241f] sm:px-8">
      <div className="mx-auto max-w-5xl">

        {/* Breadcrumb navigation */}

        <nav className="mb-8 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/" className="hover:text-orange-800">
            HireSync
          </Link>

          <span>/</span>
          <span>Candidates</span>
          <span>/</span>

          <span className="font-semibold text-stone-800">
            Upload resume
          </span>
        </nav>

        {/* Page heading */}

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a45e38]">
            CANDIDATE MANAGEMENT
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Upload candidate resume
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
            Select a job opening and upload the candidate's resume.
            HireSync will securely store the document and use Gemini
            to extract the candidate profile automatically.
          </p>
        </div>

        {/* Errors */}

        {jobsError && (
          <div className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {jobsError}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">

          {/* Upload form */}

          <section className="border border-[#e6dfd5] bg-white p-6 sm:p-8">

            <h2 className="text-xl font-bold">
              Resume submission
            </h2>

            <p className="mt-2 text-sm leading-6 text-stone-500">
              You only need to select the job and upload the resume.
              Gemini will extract the candidate's details.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-6">

              {/* Job selector */}

              <div>
                <label
                  htmlFor="jobId"
                  className="mb-2 block text-sm font-semibold"
                >
                  Job position *
                </label>

                <select
                  id="jobId"
                  required
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  disabled={jobsLoading || submitting}
                  className="w-full border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-stone-100"
                >
                  <option value="">
                    {jobsLoading
                      ? "Loading positions..."
                      : "Select a job"}
                  </option>

                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} ({job.status})
                    </option>
                  ))}
                </select>

                {!jobsLoading &&
                  jobs.length === 0 &&
                  !jobsError && (
                    <p className="mt-2 text-sm text-amber-700">
                      No available jobs. Create a job before uploading candidates.
                    </p>
                  )}
              </div>

              {/* Resume upload */}

              <div>
                <label
                  htmlFor="resume"
                  className="mb-2 block text-sm font-semibold"
                >
                  Candidate resume *
                </label>

                <input
                  ref={fileInputRef}
                  id="resume"
                  type="file"
                  required
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={submitting}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError("");
                    setResult(null);
                  }}
                  className="block w-full border border-dashed border-stone-300 bg-[#faf9f6] p-4 text-sm file:mr-4 file:border-0 file:bg-[#29231e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />

                <p className="mt-2 text-xs text-stone-500">
                  PDF or DOCX · Maximum size 12 MB.
                </p>

                {file && (
                  <p className="mt-2 text-sm font-medium text-emerald-700">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              {/* Submit */}

              <button
                type="submit"
                disabled={
                  submitting ||
                  jobsLoading ||
                  jobs.length === 0
                }
                className="w-full bg-[#29231e] px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#a9532e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Uploading and processing..."
                  : "Upload and analyse resume"}
              </button>

              {submitting && (
                <p className="text-center text-sm leading-6 text-stone-500">
                  Gemini is processing the resume. Please keep this page open.
                </p>
              )}

            </form>
          </section>

          {/* Information panel */}

          <aside className="space-y-5">

            <div className="border border-[#e6dfd5] bg-white p-6">
              <h2 className="text-lg font-bold">
                Processing workflow
              </h2>

              <ol className="mt-5 space-y-5">
                {[
                  [
                    "01",
                    "Validate resume",
                    "Check file format and size.",
                  ],
                  [
                    "02",
                    "Secure storage",
                    "Save the original resume privately.",
                  ],
                  [
                    "03",
                    "AI extraction",
                    "Gemini extracts candidate details and technical skills.",
                  ],
                  [
                    "04",
                    "Save results",
                    "Store extracted facts and supporting evidence in Supabase.",
                  ],
                ].map(([number, title, description]) => (
                  <li key={number} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#f6eee7] text-sm font-bold text-[#a45e38]">
                      {number}
                    </span>

                    <div>
                      <p className="text-sm font-bold">
                        {title}
                      </p>

                      <p className="mt-1 text-sm leading-5 text-stone-500">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Data protection */}

            <div className="border border-[#dce6dc] bg-[#f0f6ef] p-5">
              <p className="text-sm font-bold text-[#316346]">
                Candidate data protection
              </p>

              <p className="mt-2 text-sm leading-6 text-[#55735d]">
                Original resumes are saved in your private Supabase
                Storage bucket. AI extraction is advisory. Hiring
                decisions remain with the HR reviewer.
              </p>
            </div>

          </aside>
        </div>

        {/* Successful extraction result */}

        {result?.success && candidate && (
          <section className="mt-8 border border-emerald-200 bg-white p-6 sm:p-8">

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-emerald-700">
                  Resume processed successfully
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {candidate.full_name || "Candidate"}
                </h2>
              </div>

              <span className="bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
                Processed
              </span>
            </div>

            {/* Candidate profile */}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <div>
                <p className="text-xs font-semibold uppercase text-stone-500">
                  Email
                </p>

                <p className="mt-1 text-sm">
                  {candidate.email || "Not found"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-stone-500">
                  Phone
                </p>

                <p className="mt-1 text-sm">
                  {candidate.phone || "Not found"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-stone-500">
                  Location
                </p>

                <p className="mt-1 text-sm">
                  {candidate.location || "Not found"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-stone-500">
                  Current role
                </p>

                <p className="mt-1 text-sm">
                  {candidate.current_role || "Not identified"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-stone-500">
                  Experience
                </p>

                <p className="mt-1 text-sm">
                  {candidate.total_experience_years} years
                </p>
              </div>
            </div>

            {/* Extracted skills */}

            <div className="mt-6">
              <h3 className="font-bold">
                Extracted technical skills
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {candidate.skills.length > 0 ? (
                  candidate.skills.map((skill, index) => (
                    <span
                      key={`${skill}-${index}`}
                      className="bg-[#f5eee7] px-3 py-2 text-sm text-[#85502f]"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">
                    No skills identified.
                  </p>
                )}
              </div>
            </div>

            {/* Professional summary */}

            <div className="mt-6">
              <h3 className="font-bold">
                Professional summary
              </h3>

              <p className="mt-2 text-sm leading-7 text-stone-600">
                {candidate.professional_summary ||
                  "No summary available."}
              </p>
            </div>

            {/* Experience */}

            <div className="mt-6">
              <h3 className="font-bold">
                Work experience
              </h3>

              {candidate.work_experience.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {candidate.work_experience.map((item, index) => (
                    <div
                      key={index}
                      className="border-l-2 border-[#c66a37] pl-4"
                    >
                      <p className="text-sm font-bold">
                        {item.job_title || "Position not identified"}
                      </p>

                      <p className="mt-1 text-sm text-stone-500">
                        {item.company || "Company not identified"}
                      </p>

                      <p className="mt-1 text-xs text-stone-500">
                        {item.start_date || "Unknown"} – {item.end_date || "Unknown"}
                      </p>

                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-stone-500">
                  No work experience details identified.
                </p>
              )}
            </div>

            {/* Education */}

            <div className="mt-6">
              <h3 className="font-bold">
                Education
              </h3>

              {candidate.education.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {candidate.education.map((item, index) => (
                    <div key={index}>
                      <p className="text-sm font-semibold">
                        {item.degree || "Degree not identified"}
                      </p>

                      <p className="mt-1 text-sm text-stone-500">
                        {item.institution || "Institution not identified"}
                      </p>

                      <p className="mt-1 text-xs text-stone-500">
                        {item.field_of_study}
                        {item.graduation_year
                          ? ` · ${item.graduation_year}`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-stone-500">
                  No education details identified.
                </p>
              )}
            </div>

            {/* Evidence */}

            <div className="mt-6">
              <h3 className="font-bold">
                Supporting resume evidence
              </h3>

              {candidate.evidence.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {candidate.evidence.map((item, index) => (
                    <div
                      key={index}
                      className="border border-stone-200 bg-[#faf9f6] p-4"
                    >
                      <p className="text-sm font-semibold">
                        {item.claim_text}
                      </p>

                      <blockquote className="mt-2 border-l-2 border-[#c66a37] pl-3 text-sm leading-6 text-stone-600">
                        {item.source_excerpt}
                      </blockquote>

                      <p className="mt-2 text-xs text-stone-500">
                        {item.section_name || "Resume"}
                        {item.page_number > 0
                          ? ` · Page ${item.page_number}`
                          : ""}
                        {" · "}
                        Confidence: {Math.round(item.confidence * 100)}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-stone-500">
                  No supporting excerpts were returned.
                </p>
              )}
            </div>

            {/* Reference */}

            <p className="mt-6 border-t border-stone-100 pt-4 text-xs text-stone-500">
              Application reference: {result.applicationId}
              <br />
              This is an AI-extracted profile, not a hiring decision or assessment score.
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex bg-[#29231e] px-5 py-3 text-sm font-bold text-white hover:bg-[#a9532e]"
            >
              Return to Overview
            </Link>

          </section>
        )}
      </div>
    </main>
  );
}
