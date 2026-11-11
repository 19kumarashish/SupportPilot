import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { AuthProvider, useAuth } from "./auth";

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalActEnvironment = Object.getOwnPropertyDescriptor(
  globalThis,
  "IS_REACT_ACT_ENVIRONMENT",
);

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
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  return values;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of [
    ["window", originalWindow],
    ["IS_REACT_ACT_ENVIRONMENT", originalActEnvironment],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, key);
    }
  }
});

function mountAuthProvider() {
  let auth: ReturnType<typeof useAuth> | undefined;
  function Probe() {
    auth = useAuth();
    return null;
  }
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  return {
    getAuth: () => {
      assert.ok(auth);
      return auth;
    },
    unmount: () => act(() => renderer?.unmount()),
  };
}

describe("AuthProvider", () => {
  it("starts signed out without making a needless auth request", async () => {
    installWindow();
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return new Response(null, { status: 401 });
    }) as typeof fetch;

    const mounted = mountAuthProvider();
    await act(async () => {
      await Promise.resolve();
    });

    assert.equal(mounted.getAuth().ready, true);
    assert.equal(mounted.getAuth().user, null);
    assert.equal(mounted.getAuth().unavailable, false);
    assert.equal(requestCount, 0);
    mounted.unmount();
  });

  it("sends the workspace slug login payload and stores returned tokens", async () => {
    const storage = installWindow();
    let requestUrl = "";
    let requestBody = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(input);
      requestBody = String(init?.body);
      return new Response(
        JSON.stringify({
          data: {
            user: {
              id: "user-1",
              organizationId: "org-1",
              email: "agent@example.test",
              firstName: "Test",
              lastName: "Agent",
              role: "admin",
              isActive: true,
            },
            tokens: { accessToken: "access-1", refreshToken: "refresh-1" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const mounted = mountAuthProvider();
    await act(async () => {
      await mounted.getAuth().signIn({
        organizationSlug: "test-workspace",
        email: "agent@example.test",
        password: "test-password-1",
      });
    });

    assert.match(requestUrl, /\/auth\/login$/u);
    assert.deepEqual(JSON.parse(requestBody), {
      organizationSlug: "test-workspace",
      email: "agent@example.test",
      password: "test-password-1",
    });
    assert.deepEqual(JSON.parse(storage.get("supportpilot.session") ?? "{}"), {
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    assert.equal(mounted.getAuth().user?.id, "user-1");
    mounted.unmount();
  });

  it("keeps tokens and exposes an unavailable state after a transient auth outage", async () => {
    const storage = installWindow();
    storage.set(
      "supportpilot.session",
      JSON.stringify({ accessToken: "access-1", refreshToken: "refresh-1" }),
    );
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return requestCount === 1
        ? new Response(null, { status: 401 })
        : new Response(
            JSON.stringify({ error: { message: "Temporarily unavailable" } }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
    }) as typeof fetch;

    const mounted = mountAuthProvider();
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });

    assert.equal(mounted.getAuth().ready, true);
    assert.equal(mounted.getAuth().user, null);
    assert.equal(mounted.getAuth().unavailable, true);
    assert.ok(storage.has("supportpilot.session"));
    assert.equal(requestCount, 2);
    mounted.unmount();
  });

  it("clears local tokens and reports unconfirmed server revocation on logout failure", async () => {
    const storage = installWindow();
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return requestCount === 1
        ? new Response(
            JSON.stringify({
              data: {
                user: {
                  id: "user-1",
                  organizationId: "org-1",
                  email: "agent@example.test",
                  firstName: "Test",
                  lastName: "Agent",
                  role: "admin",
                  isActive: true,
                },
                tokens: { accessToken: "access-1", refreshToken: "refresh-1" },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        : new Response(
            JSON.stringify({ error: { message: "Unavailable" } }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
    }) as typeof fetch;

    const mounted = mountAuthProvider();
    await act(async () => {
      await mounted.getAuth().signIn({
        organizationSlug: "test-workspace",
        email: "agent@example.test",
        password: "test-password-1",
      });
    });
    await act(async () => {
      await mounted.getAuth().signOut();
    });

    assert.equal(mounted.getAuth().user, null);
    assert.equal(storage.has("supportpilot.session"), false);
    assert.match(
      mounted.getAuth().signOutWarning ?? "",
      /server could not confirm session revocation/u,
    );
    mounted.unmount();
  });
});
