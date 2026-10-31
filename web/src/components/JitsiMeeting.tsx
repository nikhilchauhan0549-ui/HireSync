
"use client";

import { useEffect, useRef, useState } from "react";

type JitsiOptions = {
  roomName: string;
  width: string;
  height: number;
  parentNode: HTMLElement;
  userInfo: {
    displayName: string;
  };
  configOverwrite: Record<string, unknown>;
};

type JitsiApi = {
  addListener(
    event: string,
    callback: (payload?: unknown) => void
  ): void;
  executeCommand(command: string, ...args: unknown[]): void;
  dispose(): void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: JitsiOptions
    ) => JitsiApi;
  }
}

let jitsiScriptPromise: Promise<void> | null = null;

function loadJitsiScript(): Promise<void> {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve();
  }

  if (!jitsiScriptPromise) {
    jitsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;

      script.onload = () => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
        } else {
          reject(new Error("Jitsi API did not initialize."));
        }
      };

      script.onerror = () => {
        jitsiScriptPromise = null;
        reject(new Error("Unable to load Jitsi."));
      };

      document.head.appendChild(script);
    });
  }

  return jitsiScriptPromise;
}

type Props = {
  meetingUrl: string;
  displayName: string;
  onLeave?: () => void;
};

export default function JitsiMeeting({
  meetingUrl,
  displayName,
  onLeave,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [status, setStatus] = useState("Preparing video meeting...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const meeting = new URL(meetingUrl);

        if (
          meeting.protocol !== "https:" ||
          meeting.pathname === "/"
        ) {
          throw new Error("The meeting URL is invalid.");
        }

        const roomName = meeting.pathname
          .split("/")
          .filter(Boolean)
          .map(decodeURIComponent)
          .join("/");

        await loadJitsiScript();

        if (cancelled || !containerRef.current) return;

        const Jitsi = window.JitsiMeetExternalAPI;

        if (!Jitsi) {
          throw new Error("Jitsi API is unavailable.");
        }

        const api = new Jitsi(meeting.hostname, {
          roomName,
          width: "100%",
          height: 650,
          parentNode: containerRef.current,
          userInfo: {
            displayName: displayName.slice(0, 100),
          },
          configOverwrite: {
            prejoinConfig: { enabled: true },
            startWithAudioMuted: true,
            startWithVideoMuted: false,
            disableDeepLinking: true,
          },
        });

        apiRef.current = api;

        api.addListener("videoConferenceJoined", () => {
          if (!cancelled) {
            setStatus("You are in the video interview.");
          }
        });

        api.addListener("videoConferenceLeft", () => {
          if (!cancelled) {
            setStatus("You have left the video interview.");
            onLeave?.();
          }
        });

        api.addListener("readyToClose", () => {
          if (!cancelled) {
            setStatus("The video meeting has ended.");
            onLeave?.();
          }
        });

        api.addListener("errorOccurred", (payload) => {
          console.error("Jitsi error:", payload);

          if (!cancelled) {
            setError("The video service reported an error.");
          }
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to start video meeting."
          );
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [meetingUrl, displayName, onLeave]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-700">
          {status}
        </p>

        <button
          type="button"
          onClick={() => apiRef.current?.executeCommand("hangup")}
          disabled={!apiRef.current}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Leave meeting
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="min-h-[450px] w-full overflow-hidden rounded-xl bg-gray-950"
      />
    </section>
  );
}
