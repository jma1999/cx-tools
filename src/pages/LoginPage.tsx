import { useState } from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";
import { FirebaseError } from "firebase/app";

import { useAuth } from "../auth/AuthProvider";

interface LoginLocationState {
  from?: string;
}

export default function LoginPage() {
  const {
    appUser,
    loading,
    signIn,
  } = useAuth();

  const location = useLocation();
  const [errorMessage, setErrorMessage] =
    useState("");
  const [signingIn, setSigningIn] =
    useState(false);

  const locationState =
    location.state as LoginLocationState | null;

  const destination =
    locationState?.from ?? "/projects";

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

  async function handleSignIn(): Promise<void> {
    setSigningIn(true);
    setErrorMessage("");

    try {
      await signIn();
    } catch (error) {
      if (
        error instanceof FirebaseError &&
        (
          error.code ===
            "auth/popup-closed-by-user" ||
          error.code ===
            "auth/cancelled-popup-request"
        )
      ) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Sign-in could not be completed.",
      );
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">
          RBGB
        </p>

        <h1>cxTools</h1>

        <p>
          Sign in to access commissioning
          projects.
        </p>

        <button
          type="button"
          className="primary-button login-button"
          disabled={signingIn}
          onClick={() => void handleSignIn()}
        >
          {signingIn
            ? "Signing in…"
            : "Continue with Google"}
        </button>

        {errorMessage && (
          <p className="login-error">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  );
}