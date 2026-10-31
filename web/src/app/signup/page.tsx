
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {visible ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.58 10.59a2 2 0 002.83 2.83" />
          <path d="M9.88 5.09A10.9 10.9 0 0112 5c5.5 0 9 7 9 7a15.9 15.9 0 01-3.13 3.86" />
          <path d="M6.61 6.61C4.21 8.2 3 12 3 12s3.5 7 9 7a10.4 10.4 0 004.12-.85" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 hover:border-stone-300 focus:border-orange-500 focus:ring-[3px] focus:ring-orange-100";

const labelClass = "mb-2 block text-sm font-medium text-stone-800";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");

  const passwordValid = password.length >= 8;
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    const name = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (name.length < 2) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (!passwordValid) {
      setErrorMessage("Your password must contain at least 8 characters.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setRegisteredEmail(normalizedEmail);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ee] px-5 py-10 text-stone-900">
      <div className="w-full max-w-[1050px]">

        {/* Brand header */}
        <header className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-700 text-xl font-semibold text-white">
            H
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight">
              HireSync
            </h1>
            <p className="text-[11px] text-stone-500">
              Recruit. Schedule. Hire.
            </p>
          </div>
        </header>

        <div className="grid overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_20px_60px_-30px_rgba(41,30,20,0.18)] lg:grid-cols-[0.85fr_1.15fr]">

          {/* Left information panel */}
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#211b17] p-10 text-white lg:flex">
            <div
              className="pointer-events-none absolute -right-28 -top-20 h-72 w-72 rounded-full bg-orange-600/20 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-orange-300">
                Recruitment workspace
              </p>

              <h2 className="mt-8 text-4xl font-semibold leading-[1.2] tracking-tight">
                Better hiring
                <span className="block font-serif italic text-orange-300">
                  starts here.
                </span>
              </h2>

              <p className="mt-5 max-w-sm text-sm leading-7 text-stone-400">
                Bring your recruitment workflow into one organized
                workspace. Create your account to get started with HireSync.
              </p>
            </div>

            <div className="relative mt-16 space-y-5">
              {[
                "One workspace for recruitment",
                "Structured candidate management",
                "Human-reviewed hiring decisions",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/15 text-orange-300">
                    <CheckIcon />
                  </span>

                  <span className="text-sm text-stone-300">{item}</span>
                </div>
              ))}
            </div>

            <p className="relative mt-16 text-xs text-stone-500">
              HireSync · Built for better recruitment operations.
            </p>
          </aside>

          {/* Signup form */}
          <section className="p-6 sm:p-10 lg:p-12">
            {!registeredEmail ? (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                    Get started
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                    Create your account
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Enter your details to create your HireSync HR account.
                  </p>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                  >
                    {errorMessage}
                  </div>
                )}

                <form
                  onSubmit={handleSignup}
                  className="space-y-5"
                >
                  {/* Full name */}
                  <div>
                    <label htmlFor="fullName" className={labelClass}>
                      Full name
                    </label>

                    <input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={80}
                      value={fullName}
                      onChange={(event) =>
                        setFullName(event.target.value)
                      }
                      placeholder="Enter your full name"
                      className={inputClass}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Work email
                    </label>

                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="name@company.com"
                      className={inputClass}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className={labelClass}>
                      Password
                    </label>

                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        placeholder="Enter password"
                        className={`${inputClass} pr-16`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((previous) => !previous)
                        }
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                      >
                        <EyeIcon visible={showPassword} />
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-stone-500">
                      Use at least 8 characters.
                    </p>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className={labelClass}
                    >
                      Confirm password
                    </label>

                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={
                          showConfirmPassword ? "text" : "password"
                        }
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Re-enter password"
                        aria-invalid={
                          confirmPassword.length > 0 && !passwordsMatch
                        }
                        className={`${inputClass} pr-16 ${
                          confirmPassword.length > 0 && !passwordsMatch
                            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                            : ""
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword((previous) => !previous)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirmation password"
                            : "Show confirmation password"
                        }
                        aria-pressed={showConfirmPassword}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                      >
                        <EyeIcon visible={showConfirmPassword} />
                      </button>
                    </div>

                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <p className="mt-2 text-xs text-red-600">
                        Passwords do not match.
                      </p>
                    )}

                    {passwordsMatch && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
                        <CheckIcon />
                        Passwords match.
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#211b17] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                          aria-hidden="true"
                        />
                        Creating account...
                      </>
                    ) : (
                      "Create account"
                    )}
                  </button>
                </form>

                <div className="mt-7 border-t border-stone-100 pt-6">
                  <p className="text-center text-sm text-stone-500">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-orange-800 underline-offset-4 hover:underline"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>

                <p className="mt-6 text-center text-xs leading-5 text-stone-400">
                  By creating an account, you agree to use HireSync
                  responsibly and protect candidate information.
                </p>
              </>
            ) : (
              /* Confirmation state */
              <div className="flex min-h-[470px] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-700">
                  <MailIcon />
                </div>

                <p className="mt-7 text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                  Verify your email
                </p>

                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  Check your inbox
                </h2>

                <p className="mt-4 max-w-sm text-sm leading-7 text-stone-500">
                  We've submitted your registration for:
                </p>

                <p className="mt-2 break-all font-semibold text-stone-900">
                  {registeredEmail}
                </p>

                <p className="mt-5 max-w-sm text-sm leading-7 text-stone-500">
                  Open the confirmation email and follow its link to
                  activate your account. You can sign in after verification.
                </p>

                <Link
                  href="/login"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-[#211b17] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-800 sm:w-auto"
                >
                  Go to sign in
                </Link>

                <button
                  type="button"
                  onClick={() => setRegisteredEmail("")}
                  className="mt-4 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
                >
                  Back to registration
                </button>
              </div>
            )}
          </section>
        </div>

      <footer className="mt-7 text-center text-xs text-stone-400">
  © 2026 HireSync. All rights reserved.
</footer>
      </div>
    </main>
  );
}
