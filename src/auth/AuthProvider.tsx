import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";

import { firebaseAuth } from "./firebase";

interface AuthContextValue {
  appUser: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

interface AuthProviderProps {
  children: ReactNode;
}

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [appUser, setAppUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        setAppUser(user);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Firebase authentication state error:",
          error,
        );

        setAppUser(null);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  async function signIn(): Promise<void> {
    await signInWithPopup(
      firebaseAuth,
      googleProvider,
    );
  }

  async function signOut(): Promise<void> {
    await firebaseSignOut(firebaseAuth);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      appUser,
      loading,
      signIn,
      signOut,
    }),
    [appUser, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}