import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Navigate,
  useLocation,
} from "react-router-dom";
import { FirebaseError } from "firebase/app";

import { useAuth } from "../auth/AuthProvider";

import {
  completeEmailSignIn,
  isEmailSignInCallback,
  sendEmailSignInLink,
  signInWithGoogle,
  signInWithMicrosoft,
  storedSignInEmail,
} from "../auth/authService";

interface LoginLocationState {
  from?: string;
}

export default function LoginPage() {
  const {
    appUser,
    loading,
  } = useAuth();

  const location = useLocation();
  const [errorMessage, setErrorMessage] =
    useState("");
  const [signingIn, setSigningIn] =
    useState(false);

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    emailSent,
    setEmailSent,
  ] =
    useState(false);

  const [
    emailCallback,
    setEmailCallback,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const signInAttemptRef = useRef(false);
  const appUserRef = useRef(appUser);

  const locationState =
    location.state as LoginLocationState | null;

  const destination =
    locationState?.from ?? "/projects";

  useEffect(() => {
    appUserRef.current = appUser;

    if (appUser) {
      signInAttemptRef.current = false;
      setSigningIn(false);
    }
  }, [appUser]);

  useEffect(() => {
    function handleReturnToPage(): void {
      if (
        !signInAttemptRef.current ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      window.setTimeout(() => {
        if (
          signInAttemptRef.current &&
          !appUserRef.current
        ) {
          signInAttemptRef.current = false;
          setSigningIn(false);
        }
      }, 700);
    }

    window.addEventListener(
      "focus",
      handleReturnToPage,
    );

    document.addEventListener(
      "visibilitychange",
      handleReturnToPage,
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleReturnToPage,
      );

      document.removeEventListener(
        "visibilitychange",
        handleReturnToPage,
      );
    };
  }, []);

  useEffect(() => {
    if (
      isEmailSignInCallback()
    ) {
      setEmailCallback(
        true,
      );

      setEmail(
        storedSignInEmail(),
      );
    }
  }, []);
  
  if (loading) {
    return (
      <div className="route-loading">
        Loading your account…
      </div>
    );
  }

  if (appUser) {
    return (
      <Navigate
        to={destination}
        replace
      />
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">
          RBGB
        </p>

        <h1>Welcome to cxTools!</h1>

        <p>
          Commissioning workflows, field testing, and project coordination.
        </p>

        <p>
          Sign in to continue...
        </p>

        <div className="login-provider-buttons">
          <button
            type="button"
            className="login-provider-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");

              try {
                await signInWithGoogle();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Google sign-in failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Continue with Google
          </button>

          <button
            type="button"
            className="login-provider-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");

              try {
                await signInWithMicrosoft();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Microsoft sign-in failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Continue with Microsoft
          </button>
        </div>

        <div className="login-divider">
          <span>or</span>
        </div>

        <div className="login-email-section">
          {emailCallback ? (
            <>
              <div className="login-email-heading">
                <strong>
                  Finish signing in
                </strong>

                <p>
                  Confirm the email address
                  that received this link.
                </p>
              </div>

              <label>
                <span>
                  Work email
                </span>

                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={busy}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                />
              </label>

              <button
                type="button"
                className="primary-button"
                disabled={
                  busy ||
                  !email.trim()
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");

                  try {
                    await completeEmailSignIn(
                      email,
                    );

                    /*
                    * AuthProvider will observe
                    * the newly authenticated
                    * Firebase user.
                    */
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Sign-in could not be completed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "Signing in…"
                  : "Complete sign-in"}
              </button>
            </>
          ) : emailSent ? (
            <div className="login-email-sent">
              <strong>
                Check your inbox
              </strong>

              <p>
                We sent a secure sign-in
                link to {email}.
              </p>

              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEmailSent(false);
                  setError("");
                }}
              >
                Use another email
              </button>
            </div>
          ) : (
            <>
              <label>
                <span>
                  Work email
                </span>

                <input
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  disabled={busy}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                />
              </label>

              <button
                type="button"
                className="secondary-button"
                disabled={
                  busy ||
                  !email.trim()
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");

                  try {
                    await sendEmailSignInLink(
                      email,
                    );

                    setEmailSent(true);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Sign-in email could not be sent.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "Sending…"
                  : "Email me a sign-in link"}
              </button>
            </>
          )}

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}
        </div>

        {errorMessage && (
          <p className="login-error">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  );
}