"use client";

import { useCallback, useEffect, useState } from "react";

type EmailRecord = {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  provider: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  created_at: string;
  candidateName: string;
  interviewerName: string;
  jobTitle: string;
  interviewStart: string | null;
  interviewStatus: string;
};

async function readResponse(response: Response) {
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/emails", {
        cache: "no-store",
      });

      const data = await readResponse(response);
      setEmails(data.emails || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load emails."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmails();
  }, [loadEmails]);

  async function sendEmail(email: EmailRecord) {
    const confirmed = window.confirm(
      `Send "${email.subject}" to ${email.recipient}?`
    );

    if (!confirmed) return;

    setSendingId(email.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/emails/${encodeURIComponent(email.id)}/send`,
        { method: "POST" }
      );

      const data = await readResponse(response);

      setMessage(data.message || "Email send request completed.");
      await loadEmails();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send this email."
      );

      await loadEmails();
    } finally {
      setSendingId("");
    }
  }

  const draftCount = emails.filter(
    (item) => item.status === "draft" || item.status === "approved"
  ).length;

  const sentCount = emails.filter(
    (item) => item.status === "sent"
  ).length;

  const failedCount = emails.filter(
    (item) => item.status === "failed"
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              HireSync Recruitment
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Email management
            </h1>
            <p className="mt-2 text-gray-600">
              Review candidate invitations and manage email delivery.
            </p>
          </div>

          <a
            href="/interviews"
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700"
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

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">Draft / ready to send</p>
            <p className="mt-2 text-3xl font-bold">{draftCount}</p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">Sent</p>
            <p className="mt-2 text-3xl font-bold text-green-700">
              {sentCount}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">Failed</p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {failedCount}
            </p>
          </div>
        </section>

        <section className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Invitation emails</h2>
          <button
            type="button"
            onClick={() => void loadEmails()}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            Refresh
          </button>
        </section>

        {loading && (
          <p className="text-sm text-gray-600">Loading email records...</p>
        )}

        {!loading && emails.length === 0 && (
          <section className="rounded-xl border bg-white p-8 text-center">
            <h2 className="font-semibold">No invitation emails yet</h2>
            <p className="mt-2 text-sm text-gray-600">
              Emails are created when an interview is scheduled and the candidate has a valid email address.
            </p>
          </section>
        )}

        <section className="space-y-4">
          {emails.map((email) => (
            <article
              key={email.id}
              className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{email.subject}</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    To: {email.recipient}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Candidate: {email.candidateName}
                    {" · "}
                    Interviewer: {email.interviewerName}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Job: {email.jobTitle}
                  </p>
                  {email.interviewStart && (
                    <p className="mt-1 text-xs text-gray-500">
                      Interview: {new Date(email.interviewStart).toLocaleString()}
                    </p>
                  )}
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold capitalize">
                  {email.status}
                </span>
              </div>

              <details>
                <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                  Preview email
                </summary>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-800">
                  {email.body}
                </pre>
              </details>

              {email.failure_reason && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  Previous error: {email.failure_reason}
                </p>
              )}

              {email.status !== "sent" &&
                email.status !== "queued" && (
                  <button
                    type="button"
                    onClick={() => void sendEmail(email)}
                    disabled={sendingId === email.id}
                    className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sendingId === email.id
                      ? "Sending..."
                      : email.status === "failed"
                        ? "Retry email"
                        : "Approve and send email"}
                  </button>
                )}

              {email.status === "sent" && (
                <p className="text-sm text-green-700">
                  Accepted by the email provider
                  {email.sent_at
                    ? ` on ${new Date(email.sent_at).toLocaleString()}`
                    : "."}
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}