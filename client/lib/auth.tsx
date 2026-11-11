"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ApiError,
  apiJson,
  clearTokens,
  hasStoredSession,
  saveTokens,
  type SessionTokens,
} from "./api";

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "agent";
  isActive: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  unavailable: boolean;
  signOutWarning: string | null;
  retrySession(): void;
  signIn(input: {
    organizationSlug: string;
    email: string;
    password: string;
  }): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [signOutWarning, setSignOutWarning] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const onSessionExpired = () => {
      setUser(null);
      setUnavailable(false);
      setReady(true);
    };
    window.addEventListener("supportpilot:session-expired", onSessionExpired);

    Promise.resolve()
      .then(() =>
        hasStoredSession()
          ? apiJson<{ data: { user: AuthUser } }>("/auth/me")
          : null,
      )
      .then((result) => {
        if (!active) return;
        if (!result) {
          setUser(null);
          setUnavailable(false);
          return;
        }
        if (active) {
          setUser(result.data.user);
          setUnavailable(false);
        }
      })
      .catch((error: unknown) => {
        const invalidSession =
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403);
        if (invalidSession) clearTokens();
        if (active) {
          setUser(null);
          setUnavailable(!invalidSession);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
      window.removeEventListener("supportpilot:session-expired", onSessionExpired);
    };
  }, [retryCount]);

  const retrySession = useCallback(() => {
    setReady(false);
    setUnavailable(false);
    setRetryCount((count) => count + 1);
  }, []);

  const signIn = useCallback(
    async (input: {
      organizationSlug: string;
      email: string;
      password: string;
    }) => {
      const result = await apiJson<{
        data: { user: AuthUser; tokens: SessionTokens };
      }>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      saveTokens(result.data.tokens);
      setUser(result.data.user);
      setUnavailable(false);
      setSignOutWarning(null);
      setReady(true);
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      if (user) {
        await apiJson("/auth/logout", { method: "POST" });
      }
    } catch (error) {
      if (!(error instanceof ApiError && [401, 403].includes(error.status))) {
        setSignOutWarning(
          "This device is signed out, but the server could not confirm session revocation.",
        );
      }
    } finally {
      clearTokens();
      setUser(null);
      setUnavailable(false);
      setReady(true);
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      ready,
      unavailable,
      signOutWarning,
      retrySession,
      signIn,
      signOut,
    }),
    [user, ready, unavailable, signOutWarning, retrySession, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
