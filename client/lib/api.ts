const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
const SESSION_KEY = "supportpilot.session";

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const readTokens = (): SessionTokens | null => {
  if (typeof window === "undefined") return null;
  const serialized = window.sessionStorage.getItem(SESSION_KEY);
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("accessToken" in parsed) ||
      typeof parsed.accessToken !== "string" ||
      !("refreshToken" in parsed) ||
      typeof parsed.refreshToken !== "string"
    ) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
    };
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const hasStoredSession = (): boolean => readTokens() !== null;

export const saveTokens = (tokens: SessionTokens): void => {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens));
};

export const clearTokens = (): void => {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_KEY);
  }
};

let refreshRequest: Promise<SessionTokens | null> | undefined;

const refreshTokens = async (): Promise<SessionTokens | null> => {
  const current = readTokens();
  if (!current) return null;

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (response.status === 401 || response.status === 403) {
    clearTokens();
    return null;
  }
  if (!response.ok) throw await readError(response);

  let result: { data?: { tokens?: SessionTokens } };
  try {
    result = (await response.json()) as {
      data?: { tokens?: SessionTokens };
    };
  } catch {
    throw new ApiError(
      "The server returned an invalid refresh response.",
      502,
      "INVALID_REFRESH_RESPONSE",
    );
  }
  const tokens = result.data?.tokens;
  if (!tokens?.accessToken || !tokens.refreshToken) {
    throw new ApiError(
      "The server returned an invalid refresh response.",
      502,
      "INVALID_REFRESH_RESPONSE",
    );
  }

  saveTokens(tokens);
  return tokens;
};

const refreshSession = (): Promise<SessionTokens | null> => {
  if (!refreshRequest) {
    refreshRequest = refreshTokens().finally(() => {
      refreshRequest = undefined;
    });
  }
  return refreshRequest;
};

const canRetryAfterRefresh = (path: string, method: string): boolean =>
  ["GET", "HEAD", "OPTIONS"].includes(method) ||
  (path === "/auth/logout" && method === "POST");

const notifySessionExpired = (): void => {
  clearTokens();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("supportpilot:session-expired"));
  }
};

export const apiFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = new Headers(init.headers);
  const currentTokens = readTokens();
  if (currentTokens?.accessToken) {
    headers.set("Authorization", `Bearer ${currentTokens.accessToken}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (
    response.status === 401 &&
    path !== "/auth/login" &&
    path !== "/auth/refresh"
  ) {
    if (!hasStoredSession()) return response;

    const refreshed = await refreshSession();
    if (refreshed) {
      const method = (init.method ?? "GET").toUpperCase();
      if (!canRetryAfterRefresh(path, method)) {
        throw new ApiError(
          "Your session was refreshed. Please retry this action.",
          401,
          "SESSION_REFRESHED_RETRY",
        );
      }
      headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
      if (response.status === 401) notifySessionExpired();
    } else if (typeof window !== "undefined") {
      notifySessionExpired();
    }
  }

  return response;
};

const readError = async (response: Response): Promise<ApiError> => {
  let error: ApiErrorBody = {};
  try {
    const result = (await response.json()) as { error?: ApiErrorBody };
    error = result.error ?? {};
  } catch {
    error = {};
  }

  const message =
    error.message ??
    (response.status === 401
      ? "Your session has expired. Sign in again."
      : "The request could not be completed.");
  return new ApiError(message, response.status, error.code);
};

export const apiJson = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await apiFetch(path, init);
  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export const apiBlob = async (path: string): Promise<Blob> => {
  const response = await apiFetch(path);
  if (!response.ok) throw await readError(response);
  return response.blob();
};

export const apiBaseUrl = API_BASE_URL;
