
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import JitsiMeeting from "@/components/JitsiMeeting";

type Meeting = {
  id: string;
  jobTitle: string;
  candidateName: string;
  interviewerName: string;
  startAt: string;
  endAt: string;
  status: string;
  meetingUrl: string | null;
  displayName: string;
};

type ApiResult = {
  success?: boolean;
  error?: string;
  message?: string;
  alreadySent?: boolean;
  emailId?: string;
};

export default function InterviewRoomPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 p-8 text-white">
          Preparing interview room...
        </main>
      }
    >
      <InterviewRoomContent />
    </Suspense>
  );
}

function InterviewRoomContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [callEnded, setCallEnded] = useState(false);

  const [sendingMeetingEmail, setSendingMeetingEmail] = useState(false);
  const [meetingEmailMessage, setMeetingEmailMessage] = useState("");
  const [meetingEmailError, setMeetingEmailError] = useState("");

  const loadMeeting = useCallback(async () => {
    setLoading(true);
    setError("");
    setMeetingEmailMessage("");
    setMeetingEmailError("");

    try {
      const response = await fetch(
        `/api/interviews/${encodeURIComponent(id)}/room`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error || "Unable to load this interview room."
        );
      }

      const room: Meeting = result.meeting;

      if (!room?.meetingUrl) {
        throw new Error("No video meeting link was found.");
      }

      setMeeting(room);
      setCallEnded(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open the video meeting."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadMeeting();
  }, [loadMeeting]);

  const handleLeave = useCallback(() => {
    setCallEnded(true);
  }, []);

  async function sendMeetingDetails() {
    if (!meeting || !meeting.meetingUrl) {
      setMeetingEmailError("The meeting link is not available.");
      return;
    }

    if (sendingMeetingEmail) return;

    setSendingMeetingEmail(true);
    setMeetingEmailMessage("");
    setMeetingEmailError("");

    try {
      // Step 1: Prepare the meeting-details email.
      const prepareResponse = await fetch(
        `/api/interviews/${encodeURIComponent(id)}/meeting-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const prepared =
        (await prepareResponse.json()) as ApiResult;

      if (!prepareResponse.ok || prepared.success !== true) {
        throw new Error(
          prepared.error || "Unable to prepare the meeting email."
        );
      }

      // The server prevents sending the same meeting email twice.
      if (prepared.alreadySent) {
        setMeetingEmailMessage(
          prepared.message ||
            "Meeting details have already been sent to this candidate."
        );
        return;
      }

      if (!prepared.emailId) {
        throw new Error("The meeting email record was not created.");
      }

      // Step 2: Send using the existing Resend email endpoint.
      const sendResponse = await fetch(
        `/api/emails/${encodeURIComponent(prepared.emailId)}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const sent = (await sendResponse.json()) as ApiResult;

      if (!sendResponse.ok || sent.success !== true) {
        throw new Error(
          sent.error || "Unable to send the meeting email."
        );
      }

      setMeetingEmailMessage(
        sent.message ||
          `Meeting details were accepted by Resend for ${meeting.candidateName}.`
      );
    } catch (err) {
      setMeetingEmailError(
        err instanceof Error
          ? err.message
          : "Unable to send meeting details."
      );
    } finally {
      setSendingMeetingEmail(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">
              HireSync · Live interview
            </p>

            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Interview room
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Your video interview is hosted through Jitsi Meet.
            </p>
          </div>

          <a
            href="/interviews"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Back to interviews
          </a>
        </header>

        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />

            <p className="mt-4 text-sm text-slate-300">
              Preparing your video room...
            </p>
          </div>
        )}

        {/* Room loading error */}
        {error && (
          <section
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-950/40 p-6"
          >
            <h2 className="font-bold text-red-300">
              Unable to open interview room
            </h2>

            <p className="mt-2 text-sm text-red-200">{error}</p>

            <button
              type="button"
              onClick={() => void loadMeeting()}
              className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
            >
              Try again
            </button>
          </section>
        )}

        {!loading && !error && meeting && (
          <>
            {/* Interview information */}
            <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Candidate</p>
                <p className="mt-1 font-semibold">
                  {meeting.candidateName}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Interviewer</p>
                <p className="mt-1 font-semibold">
                  {meeting.interviewerName}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Position</p>
                <p className="mt-1 font-semibold">
                  {meeting.jobTitle}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Interview time
                </p>
                <p className="mt-1 text-sm font-medium">
                  {new Date(meeting.startAt).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className="mt-1 font-semibold capitalize text-emerald-400">
                  {meeting.status}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Meeting provider
                </p>
                <p className="mt-1 font-semibold">Jitsi Meet</p>
              </div>
            </section>

            {/* Video conference */}
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-5 py-4">
                <div>
                  <h2 className="font-semibold">
                    Live video conference
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Allow camera and microphone access when prompted.
                  </p>
                </div>

                <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                  Meeting available
                </span>
              </div>

              {/* Jitsi component */}
              <div className="p-2 sm:p-4">
                {meeting.meetingUrl ? (
                  <JitsiMeeting
                    meetingUrl={meeting.meetingUrl}
                    displayName={
                      meeting.displayName || "HireSync Participant"
                    }
                    onLeave={handleLeave}
                  />
                ) : (
                  <p className="rounded-xl bg-red-950/40 p-4 text-sm text-red-300">
                    No video meeting link is available for this interview.
                  </p>
                )}
              </div>

              {/* Send meeting email */}
              <div className="border-t border-white/10 bg-slate-900 p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="max-w-xl">
                    <h3 className="font-semibold text-white">
                      Send meeting details to candidate
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Email the candidate their Jitsi room ID, meeting
                      link, interview date, time and interviewer details.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void sendMeetingDetails()}
                    disabled={sendingMeetingEmail}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingMeetingEmail ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Sending email...
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">✉</span>
                        Send meeting details
                      </>
                    )}
                  </button>
                </div>

                {meetingEmailMessage && (
                  <div
                    role="status"
                    className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-sm text-emerald-300"
                  >
                    ✓ {meetingEmailMessage}
                  </div>
                )}

                {meetingEmailError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300"
                  >
                    {meetingEmailError}
                  </div>
                )}
              </div>
            </section>

            {/* Call ended message */}
            {callEnded && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-200">
                You have left the video call. The interview record remains
                available in HireSync.
              </div>
            )}

            {/* Additional meeting actions */}
            <div className="flex flex-wrap gap-3">
              {meeting.meetingUrl && (
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Open meeting separately
                </a>
              )}

              <button
                type="button"
                onClick={() => void loadMeeting()}
                disabled={loading}
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Reload room
              </button>

              <a
                href="/emails"
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                View email history
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
