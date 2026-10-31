"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useParams } from "next/navigation";
import JitsiMeeting from "@/components/JitsiMeeting";

type Invitation = {
  candidateName: string;
  jobTitle: string;
  interviewerName: string;
  startAt: string;
  endAt: string;
  status: string;
  response: string | null;
  expiresAt: string;
  meetingUrl: string | null;
  canRespond: boolean;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function InvitationContent() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [invitation, setInvitation] =
    useState<Invitation | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadInvitation = useCallback(async () => {
    const response = await fetch(
      `/api/invitations/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "Unable to load your invitation."
      );
    }

    setInvitation(data.invitation);
  }, [token]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(
          `/api/invitations/${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Unable to load your invitation."
          );
        }

        if (active) {
          setInvitation(data.invitation);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this invitation."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  async function respond(action: string) {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/invitations/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to submit your response."
        );
      }

      setMessage(data.message);
      await loadInvitation();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your response."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold text-blue-700">
            HireSync Interview
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Interview invitation
          </h1>

          <p className="mt-2 text-gray-600">
            Review the details and respond to your interview invitation.
          </p>
        </header>

        {loading && (
          <section className="rounded-xl border bg-white p-6">
            Loading invitation...
          </section>
        )}

        {error && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
            <h2 className="font-semibold">
              Unable to continue
            </h2>
            <p className="mt-2 text-sm">{error}</p>
          </section>
        )}

        {message && (
          <section className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
            {message}
          </section>
        )}

        {invitation && (
          <>
            <section className="grid gap-5 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-gray-500">Candidate</p>
                <p className="mt-1 font-semibold">
                  {invitation.candidateName}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Position</p>
                <p className="mt-1 font-semibold">
                  {invitation.jobTitle}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Interviewer</p>
                <p className="mt-1 font-semibold">
                  {invitation.interviewerName}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Start time</p>
                <p className="mt-1 font-semibold">
                  {formatDate(invitation.startAt)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">End time</p>
                <p className="mt-1 font-semibold">
                  {formatDate(invitation.endAt)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="mt-1 font-semibold capitalize">
                  {invitation.status.replaceAll("_", " ")}
                </p>
              </div>
            </section>

            {invitation.canRespond && (
              <section className="space-y-4 rounded-xl border bg-white p-6">
                <h2 className="text-lg font-bold">
                  Respond to invitation
                </h2>

                <p className="text-sm leading-6 text-gray-600">
                  Select one response. This invitation permits
                  one response.
                </p>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => respond("accept")}
                  className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Accept interview"}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    respond("request_reschedule")
                  }
                  className="w-full rounded-lg border border-blue-600 px-5 py-3 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  Request another time
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => respond("decline")}
                  className="w-full rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Decline invitation
                </button>
              </section>
            )}

            {invitation.status === "confirmed" &&
              invitation.meetingUrl && (
                <section className="space-y-4 rounded-xl border border-green-200 bg-white p-5 sm:p-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Your interview is confirmed
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      You can join the video interview here.
                      Please allow camera and microphone access.
                    </p>
                  </div>

                  <JitsiMeeting
                    meetingUrl={invitation.meetingUrl}
                    displayName={invitation.candidateName}
                  />
                </section>
              )}

            {invitation.status === "declined" && (
              <section className="rounded-xl border bg-white p-5 text-gray-700">
                This interview invitation has been declined.
              </section>
            )}

            {invitation.status === "reschedule_requested" && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                Your request for a different interview time has
                been received. The hiring team will follow up.
              </section>
            )}

            <p className="text-center text-xs text-gray-500">
              Invitation expires: {formatDate(invitation.expiresAt)}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function CandidateInvitationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 p-10 text-gray-600">
          Loading invitation...
        </main>
      }
    >
      <InvitationContent />
    </Suspense>
  );
}