import {
  GoogleAuthProvider,
  OAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import {
  firebaseAuth,
} from "./firebase";

const EMAIL_STORAGE_KEY =
  "cxtools-email-for-sign-in";

const googleProvider =
  new GoogleAuthProvider();

const microsoftProvider =
  new OAuthProvider(
    "microsoft.com",
  );

export async function signInWithGoogle():
  Promise<void> {
  await signInWithPopup(
    firebaseAuth,
    googleProvider,
  );
}

export async function sendEmailSignInLink(
  email: string,
): Promise<void> {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "Enter your email address.",
    );
  }

  const continueUrl =
    `${window.location.origin}/login`;

  await sendSignInLinkToEmail(
    firebaseAuth,
    normalizedEmail,
    {
      url:
        continueUrl,

      handleCodeInApp:
        true,
    },
  );

  /*
   * The Firebase docs recommend
   * remembering the email locally
   * so the user does not have to
   * type it again when opening the
   * link on the same device.
   *
   * Never put the email in the
   * redirect URL itself.
   */
  window.localStorage.setItem(
    EMAIL_STORAGE_KEY,
    normalizedEmail,
  );
}

export function isEmailSignInCallback():
  boolean {
  return isSignInWithEmailLink(
    firebaseAuth,
    window.location.href,
  );
}

export function storedSignInEmail():
  string {
  return (
    window.localStorage.getItem(
      EMAIL_STORAGE_KEY,
    ) ?? ""
  );
}

export async function completeEmailSignIn(
  email: string,
): Promise<void> {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "Enter the email address that received this sign-in link.",
    );
  }

  if (
    !isSignInWithEmailLink(
      firebaseAuth,
      window.location.href,
    )
  ) {
    throw new Error(
      "This sign-in link is invalid or has expired.",
    );
  }

  await signInWithEmailLink(
    firebaseAuth,
    normalizedEmail,
    window.location.href,
  );

  window.localStorage.removeItem(
    EMAIL_STORAGE_KEY,
  );

  /*
   * Remove the one-time Firebase
   * code from the browser address.
   */
  window.history.replaceState(
    {},
    document.title,
    "/login",
  );
}

export async function signOutCxTools():
  Promise<void> {
  await signOut(
    firebaseAuth,
  );
}

export async function signInWithMicrosoft():
  Promise<void> {
  try {
    await signInWithPopup(
      firebaseAuth,
      microsoftProvider,
    );
  } catch (error) {
    if (
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error &&
      error.code ===
        "auth/account-exists-with-different-credential"
    ) {
      throw new Error(
        "An cxTools account already exists for this email using another sign-in method. Sign in using that method first.",
      );
    }

    throw error;
  }
}