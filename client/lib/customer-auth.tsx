"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError, apiBaseUrl } from "./api";

const CUSTOMER_TOKEN_KEY = "supportpilot_customer_token";

interface CustomerSession {
  accessToken: string;
  customerId: string;
}

interface CustomerAuthValue {
  customerId: string | null;
  ready: boolean;
  signIn(input: { organizationSlug: string; email: string; password: string }): Promise<void>;
  signOut(): void;
}

const CustomerAuthContext = createContext<CustomerAuthValue | null>(null);

function readSession(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" && parsed !== null &&
      "accessToken" in parsed && typeof parsed.accessToken === "string" &&
      "customerId" in parsed && typeof parsed.customerId === "string"
    ) return { accessToken: parsed.accessToken, customerId: parsed.customerId };
  } catch {
    // Invalid browser state is treated as signed out.
  }
  window.sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
  return null;
}

export const customerApiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  const session = readSession();
  if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);
  return fetch(`${apiBaseUrl}${path}`, { ...init, headers });
};

export async function customerApiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await customerApiFetch(path, init);
  if (!response.ok) {
    let message = "The request could not be completed.";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // Preserve the standard API error for non-JSON responses.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const customerApiBlob = async (path: string): Promise<Blob> => {
  const response = await customerApiFetch(path);
  if (!response.ok) throw new ApiError("The attachment could not be downloaded.", response.status);
  return response.blob();
};

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(() => readSession());
  const [ready] = useState(() => typeof window !== "undefined");

  const signIn = useCallback(async (input: { organizationSlug: string; email: string; password: string }) => {
    const result = await customerApiJson<{ data: { accessToken: string; customerId: string } }>(
      "/auth/customer/login",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    );
    const next = { accessToken: result.data.accessToken, customerId: result.data.customerId };
    window.sessionStorage.setItem(CUSTOMER_TOKEN_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    window.sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ customerId: session?.customerId ?? null, ready, signIn, signOut }),
    [ready, session?.customerId, signIn, signOut],
  );
  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth(): CustomerAuthValue {
  const value = useContext(CustomerAuthContext);
  if (!value) throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  return value;
}
