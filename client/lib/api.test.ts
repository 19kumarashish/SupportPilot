import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { ApiError, apiFetch, apiJson } from "./api";

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function installWindow() {
  const values = new Map<string, string>();
  const target = Object.assign(new EventTarget(), {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: target,
  });
  return values;
}

function tokens(accessToken = "old-access", refreshToken = "old-refresh") {
  return JSON.stringify({ accessToken, refreshToken });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

describe("apiFetch session handling", () => {
  it("does not attempt refresh when no session is stored", async () => {
    installWindow();
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    const response = await apiFetch("/auth/me");

    assert.equal(response.status, 401);
    assert.equal(requestCount, 1);
  });

  it("preserves stored tokens when refresh fails transiently", async () => {
    const storage = installWindow();
    storage.set("supportpilot.session", tokens());
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return requestCount === 1
        ? new Response(null, { status: 401 })
        : new Response(
            JSON.stringify({ error: { message: "Unavailable" } }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
    }) as typeof fetch;

    await assert.rejects(apiJson("/auth/me"), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 503);
      return true;
    });

    assert.equal(storage.get("supportpilot.session"), tokens());
    assert.equal(requestCount, 2);
  });

  it("retries a safe request once with refreshed access tokens", async () => {
    installWindow().set("supportpilot.session", tokens());
    let requestCount = 0;
    const authorizationHeaders: string[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestCount += 1;
      if (requestCount !== 2) {
        authorizationHeaders.push(
          new Headers(init?.headers).get("Authorization") ?? "",
        );
      }
      return requestCount === 1
        ? new Response(null, { status: 401 })
        : requestCount === 2
          ? new Response(
              JSON.stringify({
                data: {
                  tokens: {
                    accessToken: "new-access",
                    refreshToken: "new-refresh",
                  },
                },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            )
          : new Response(null, { status: 204 });
    }) as typeof fetch;

    const response = await apiFetch("/tickets");

    assert.equal(response.status, 204);
    assert.equal(requestCount, 3);
    assert.deepEqual(authorizationHeaders, [
      "Bearer old-access",
      "Bearer new-access",
    ]);
  });

  it("does not automatically replay an unsafe mutation after refreshing", async () => {
    const storage = installWindow();
    storage.set("supportpilot.session", tokens());
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return requestCount === 1
        ? new Response(null, { status: 401 })
        : new Response(
            JSON.stringify({
              data: { tokens: { accessToken: "new-access", refreshToken: "new-refresh" } },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
    }) as typeof fetch;

    await assert.rejects(
      apiFetch("/tickets/ticket-1/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "SESSION_REFRESHED_RETRY");
        return true;
      },
    );

    assert.equal(requestCount, 2);
    assert.equal(storage.get("supportpilot.session"), tokens("new-access", "new-refresh"));
  });

  it("clears tokens when the refresh session is rejected", async () => {
    const storage = installWindow();
    storage.set("supportpilot.session", tokens());
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    const response = await apiFetch("/auth/me");

    assert.equal(response.status, 401);
    assert.equal(storage.has("supportpilot.session"), false);
    assert.equal(requestCount, 2);
  });

  it("clears tokens when a retried request still returns unauthorized", async () => {
    const storage = installWindow();
    storage.set("supportpilot.session", tokens());
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return requestCount === 2
        ? new Response(
            JSON.stringify({
              data: {
                tokens: {
                  accessToken: "new-access",
                  refreshToken: "new-refresh",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        : new Response(null, { status: 401 });
    }) as typeof fetch;

    const response = await apiFetch("/auth/me");

    assert.equal(response.status, 401);
    assert.equal(storage.has("supportpilot.session"), false);
    assert.equal(requestCount, 3);
  });
});
