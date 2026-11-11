import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { getTestDatabaseUrl } from "./test-database-url.js";

interface ApiResponse {
  success?: boolean;
  data?: {
    organization?: {
      id: string;
      name: string;
      slug: string;
    };
    admin?: {
      id: string;
      organizationId: string;
      email: string;
      role: "admin" | "agent";
      isActive: boolean;
    };
    tokens?: { accessToken: string; refreshToken: string };
    message?: string;
  };
  error?: { code?: string; message?: string };
}

interface HttpResponse {
  status: number;
  body: ApiResponse;
}

interface RequestOptions {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
}

const serverRequire = createRequire(resolve(process.cwd(), "package.json"));
const pino = serverRequire("pino") as { symbols: { streamSym: symbol } };
const dotenv = serverRequire("dotenv") as {
  config(options: { path: string }): unknown;
};

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });
process.env.DATABASE_URL = getTestDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.TEST_DATABASE_URL,
);
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString("base64url");
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString("base64url");
process.env.PUBLIC_APP_URL = "http://localhost:3000";

const migrationFolder = resolve(process.cwd(), "drizzle");
const migratorUrl = pathToFileURL(
  serverRequire.resolve("drizzle-orm/node-postgres/migrator"),
).href;
const drizzleUrl = pathToFileURL(serverRequire.resolve("drizzle-orm")).href;
const [
  { eq, inArray },
  { createApp },
  { db, pool },
  { organizations },
  { users },
  { pendingOrganizationSignups },
  { generateAccessToken },
  { hashToken },
  { allowSignupVerificationResend },
  {
    configureEmailProvider,
    resetEmailProvider,
    takeDevelopmentVerificationLink,
  },
  { logger },
  { migrate },
] = await Promise.all([
  import(drizzleUrl),
  import("../../server/src/app.js"),
  import("../../server/src/infrastructure/database/client.js"),
  import("../../server/src/infrastructure/database/schema/organizations.js"),
  import("../../server/src/infrastructure/database/schema/users.js"),
  import("../../server/src/db/schema/pending-organization-signups.js"),
  import("../../server/src/shared/security/jwt.js"),
  import("../../server/src/shared/security/token.js"),
  import("../../server/src/modules/auth/services/signup-resend-rate-limit.js"),
  import("../../server/src/modules/auth/services/email-provider.js"),
  import("../../server/src/infrastructure/logger/index.js"),
  import(migratorUrl),
]);

const testRunId = randomUUID();
const createdSlugs: string[] = [];
const trackedEmails: string[] = [];
const verificationUrls = new Map<string, string>();
let server: Server | undefined;
let serverPort = 0;
let migrationsComplete = false;

const request = (
  path: string,
  options: RequestOptions = {},
): Promise<HttpResponse> =>
  new Promise((resolveRequest, rejectRequest) => {
    const headers: Record<string, string> = {};
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers["content-type"] = "application/json";
      headers["content-length"] = String(Buffer.byteLength(body));
    }

    const outboundRequest = httpRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path,
        method: options.method ?? "GET",
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", rejectRequest);
        response.on("end", () => {
          try {
            resolveRequest({
              status: response.statusCode ?? 0,
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as ApiResponse,
            });
          } catch (error) {
            rejectRequest(error);
          }
        });
      },
    );

    outboundRequest.on("error", rejectRequest);
    if (body !== undefined) outboundRequest.write(body);
    outboundRequest.end();
  });

const signupInput = (suffix: string, overrides: Record<string, unknown> = {}) => {
  const input = {
    organizationName: `Signup Test ${suffix}`,
    organizationSlug: `signup-${testRunId.slice(0, 8)}-${suffix}`,
    firstName: "First",
    lastName: "Admin",
    email: `admin-${suffix}@example.test`,
    password: "Strong-password-123",
    ...overrides,
  };
  trackedEmails.push(input.email as string);
  createdSlugs.push(input.organizationSlug as string);
  return input;
};

const signup = (input: Record<string, unknown>) =>
  request("/api/v1/auth/organization-signup", {
    method: "POST",
    body: input,
  });

const resendVerification = (input: {
  organizationSlug: string;
  email: string;
}) =>
  request("/api/v1/auth/organization-signup/resend-verification", {
    method: "POST",
    body: input,
  });

const tokenFor = (email: string): string => {
  const verificationUrl = verificationUrls.get(email);
  assert.ok(verificationUrl, `expected captured verification URL for ${email}`);
  const token = new URL(verificationUrl).searchParams.get("token");
  assert.ok(token);
  return token;
};

describe("organization signup email verification", () => {
  before(async () => {
    await migrate(db, { migrationsFolder: migrationFolder });
    migrationsComplete = true;

    configureEmailProvider({
      async sendVerificationEmail(input) {
        verificationUrls.set(input.to, input.verificationUrl);
      },
    });

    const app = createApp();
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    serverPort = address.port;
  });

  after(async () => {
    resetEmailProvider();
    if (server) {
      server.close();
      await once(server, "close");
    }
    if (migrationsComplete) {
      if (trackedEmails.length > 0) {
        await db
          .delete(pendingOrganizationSignups)
          .where(inArray(pendingOrganizationSignups.email, trackedEmails));
      }
      if (createdSlugs.length > 0) {
        await db
          .delete(organizations)
          .where(inArray(organizations.slug, createdSlugs));
      }
    }
    await pool.end();
  });

  it("verifies email, atomically creates an admin, and logs in by workspace slug", async () => {
    const input = signupInput("valid");
    const signupResponse = await signup(input);
    assert.equal(signupResponse.status, 202);
    assert.equal(verificationUrls.has(input.email as string), true);
    assert.equal("token" in (signupResponse.body.data ?? {}), false);

    const token = tokenFor(input.email as string);
    const [pending] = await db
      .select()
      .from(pendingOrganizationSignups)
      .where(eq(
        pendingOrganizationSignups.email,
        input.email as string,
      ))
      .limit(1);
    assert.ok(pending);
    assert.equal(pending.tokenHash, hashToken(token));
    assert.notEqual(pending.tokenHash, token);

    const verified = await request("/api/v1/auth/verify-organization-signup", {
      method: "POST",
      body: { token },
    });
    assert.equal(verified.status, 201);
    assert.equal(verified.body.data?.organization?.slug, input.organizationSlug);
    assert.equal(verified.body.data?.admin?.role, "admin");
    assert.equal(verified.body.data?.admin?.isActive, true);
    assert.equal(
      verified.body.data?.admin?.organizationId,
      verified.body.data?.organization?.id,
    );

    const login = await request("/api/v1/auth/login", {
      method: "POST",
      body: {
        organizationSlug: input.organizationSlug,
        email: input.email,
        password: input.password,
      },
    });
    assert.equal(login.status, 200);
    const accessToken = login.body.data?.tokens?.accessToken;
    assert.ok(accessToken);

    const organization = await request("/api/v1/organizations/me", {
      token: accessToken,
    });
    assert.equal(
      organization.body.data?.organization?.id,
      verified.body.data?.organization?.id,
    );

    const replay = await request("/api/v1/auth/verify-organization-signup", {
      method: "POST",
      body: { token },
    });
    assert.equal(replay.status, 410);
    assert.equal(replay.body.error?.code, "VERIFICATION_TOKEN_INVALID");
  });

  it("rejects untrusted organization IDs and role fields from public signup", async () => {
    const input = signupInput("forged", {
      organizationId: randomUUID(),
      role: "platform_admin",
    });
    const response = await signup(input);
    assert.equal(response.status, 400);
  });

  it("rejects an expired verification token without creating membership", async () => {
    const input = signupInput("expired");
    assert.equal((await signup(input)).status, 202);
    const token = tokenFor(input.email as string);
    await db
      .update(pendingOrganizationSignups)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(
        pendingOrganizationSignups.tokenHash,
        hashToken(token),
      ));

    const response = await request("/api/v1/auth/verify-organization-signup", {
      method: "POST",
      body: { token },
    });
    assert.equal(response.status, 410);
    assert.equal(response.body.error?.code, "VERIFICATION_TOKEN_EXPIRED");

    const [organization] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(
        organizations.slug,
        input.organizationSlug as string,
      ))
      .limit(1);
    assert.equal(organization, undefined);
  });

  it("resends a pending signup link, invalidates the previous token, and verifies the new token", async () => {
    const input = signupInput("resend");
    assert.equal((await signup(input)).status, 202);
    const originalToken = tokenFor(input.email as string);

    const response = await resendVerification({
      organizationSlug: input.organizationSlug as string,
      email: input.email as string,
    });
    assert.equal(response.status, 202);
    assert.equal(
      response.body.data?.message,
      "If those details match an unexpired pending signup, check your inbox for a fresh verification link. If it does not arrive, request another link later.",
    );

    const [pending] = await db
      .select()
      .from(pendingOrganizationSignups)
      .where(eq(pendingOrganizationSignups.email, input.email as string))
      .limit(1);
    assert.ok(pending);
    const newToken = tokenFor(input.email as string);
    assert.notEqual(newToken, originalToken);
    assert.equal(pending.tokenHash, hashToken(newToken));

    const oldTokenResponse = await request(
      "/api/v1/auth/verify-organization-signup",
      { method: "POST", body: { token: originalToken } },
    );
    assert.equal(oldTokenResponse.status, 410);

    const verified = await request(
      "/api/v1/auth/verify-organization-signup",
      { method: "POST", body: { token: newToken } },
    );
    assert.equal(verified.status, 201);
    assert.equal(verified.body.data?.organization?.slug, input.organizationSlug);
  });

  it("returns the same public response for eligible, unknown, and verified signups", async () => {
    const input = signupInput("resend-generic");
    assert.equal((await signup(input)).status, 202);

    const eligible = await resendVerification({
      organizationSlug: input.organizationSlug as string,
      email: input.email as string,
    });
    assert.equal(eligible.status, 202);

    const unknown = await resendVerification({
      organizationSlug: `unknown-${testRunId.slice(0, 8)}`,
      email: `unknown-${testRunId}@example.test`,
    });
    assert.equal(unknown.status, 202);
    assert.deepEqual(unknown.body, eligible.body);

    const verified = await request(
      "/api/v1/auth/verify-organization-signup",
      { method: "POST", body: { token: tokenFor(input.email as string) } },
    );
    assert.equal(verified.status, 201);

    const alreadyVerified = await resendVerification({
      organizationSlug: input.organizationSlug as string,
      email: input.email as string,
    });
    assert.equal(alreadyVerified.status, 202);
    assert.deepEqual(alreadyVerified.body, eligible.body);
  });

  it("keeps delivery failures non-enumerating and excludes provider errors from logs", async () => {
    const input = signupInput("resend-delivery-failure");
    assert.equal((await signup(input)).status, 202);
    const originalToken = tokenFor(input.email as string);
    const providerErrorMarker = `provider-error-${randomUUID()}`;
    const verificationUrl = verificationUrls.get(input.email as string);
    assert.ok(verificationUrl);

    configureEmailProvider({
      async sendVerificationEmail() {
        throw new Error(`${providerErrorMarker}:${originalToken}`);
      },
    });

    const capturedLogLines: string[] = [];
    const logStream = Reflect.get(logger, pino.symbols.streamSym) as {
      write: (chunk: string) => boolean;
    };
    const originalWrite = logStream.write;
    logStream.write = (chunk) => {
      capturedLogLines.push(chunk);
      return true;
    };

    try {
      const response = await resendVerification({
        organizationSlug: input.organizationSlug as string,
        email: input.email as string,
      });
      assert.equal(response.status, 202);
      assert.deepEqual(response.body, {
        success: true,
        data: {
          message:
            "If those details match an unexpired pending signup, check your inbox for a fresh verification link. If it does not arrive, request another link later.",
        },
      });

      const [pending] = await db
        .select()
        .from(pendingOrganizationSignups)
        .where(eq(pendingOrganizationSignups.email, input.email as string))
        .limit(1);
      assert.ok(pending);
      assert.equal(pending.tokenHash, hashToken(originalToken));
      const logs = capturedLogLines.join("");
      assert.equal(logs.includes(providerErrorMarker), false);
      assert.equal(logs.includes(originalToken), false);
      assert.equal(logs.includes(verificationUrl), false);
      assert.equal(logs.includes(input.password as string), false);
      assert.equal(logs.includes(pending.passwordHash), false);
      assert.equal(logs.includes(pending.tokenHash), false);
    } finally {
      logStream.write = originalWrite;
      configureEmailProvider({
        async sendVerificationEmail(emailInput) {
          verificationUrls.set(emailInput.to, emailInput.verificationUrl);
        },
      });
    }
  });

  it("does not resend expired reservations and allows the same email and slug to be reused", async () => {
    const expired = signupInput("expired-resend");
    assert.equal((await signup(expired)).status, 202);
    const previousUrl = verificationUrls.get(expired.email as string);
    await db
      .update(pendingOrganizationSignups)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(pendingOrganizationSignups.email, expired.email as string));

    const resend = await resendVerification({
      organizationSlug: expired.organizationSlug as string,
      email: expired.email as string,
    });
    assert.equal(resend.status, 202);
    assert.equal(verificationUrls.get(expired.email as string), previousUrl);

    const reused = signupInput("expired-reused", {
      organizationSlug: expired.organizationSlug,
      email: expired.email,
    });
    assert.equal((await signup(reused)).status, 202);
    assert.notEqual(verificationUrls.get(reused.email as string), previousUrl);
  });

  it("serializes concurrent resend and verification without creating duplicate organizations", async () => {
    const input = signupInput("resend-race");
    assert.equal((await signup(input)).status, 202);
    const originalToken = tokenFor(input.email as string);

    const [resend, verification] = await Promise.all([
      resendVerification({
        organizationSlug: input.organizationSlug as string,
        email: input.email as string,
      }),
      request("/api/v1/auth/verify-organization-signup", {
        method: "POST",
        body: { token: originalToken },
      }),
    ]);

    assert.equal(resend.status, 202);
    if (verification.status === 410) {
      const replacementToken = tokenFor(input.email as string);
      assert.notEqual(replacementToken, originalToken);
      const replacementVerification = await request(
        "/api/v1/auth/verify-organization-signup",
        { method: "POST", body: { token: replacementToken } },
      );
      assert.equal(replacementVerification.status, 201);
    } else {
      assert.equal(verification.status, 201);
    }

    const created = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, input.organizationSlug as string));
    assert.equal(created.length, 1);
  });

  it("limits verification resend requests per source address", () => {
    const address = `rate-limit-test-${randomUUID()}`;
    const startedAt = Date.now();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(allowSignupVerificationResend(address, startedAt), true);
    }
    assert.equal(allowSignupVerificationResend(address, startedAt), false);
    assert.equal(
      allowSignupVerificationResend(address, startedAt + 15 * 60 * 1000),
      true,
    );
  });

  it("rejects existing workspace slugs and duplicate pending emails", async () => {
    const input = signupInput("duplicate-slug");
    assert.equal((await signup(input)).status, 202);
    const token = tokenFor(input.email as string);
    assert.equal((await request("/api/v1/auth/verify-organization-signup", {
      method: "POST",
      body: { token },
    })).status, 201);

    const reusedSlug = signupInput("reused-slug", {
      organizationSlug: input.organizationSlug,
    });
    const slugConflict = await signup(reusedSlug);
    assert.equal(slugConflict.status, 409);
    assert.equal(slugConflict.body.error?.code, "SIGNUP_ALREADY_EXISTS");

    const firstPending = signupInput("duplicate-email-a");
    assert.equal((await signup(firstPending)).status, 202);
    const secondPending = signupInput("duplicate-email-b", {
      email: firstPending.email,
    });
    const emailConflict = await signup(secondPending);
    assert.equal(emailConflict.status, 409);
    assert.equal(emailConflict.body.error?.code, "SIGNUP_ALREADY_EXISTS");
  });

  it("allows only one concurrent reservation for a workspace slug", async () => {
    const first = signupInput("concurrent-a");
    const second = signupInput("concurrent-b", {
      organizationSlug: first.organizationSlug,
    });
    const responses = await Promise.all([signup(first), signup(second)]);
    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [202, 409],
    );
  });

  it("rolls back organization creation if first-admin insertion fails", async () => {
    const input = signupInput("rollback", {
      email: `rollback-${testRunId}@example.test`,
    });
    await pool.query(`
      CREATE OR REPLACE FUNCTION supportpilot_test_reject_signup_admin()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.email = '${input.email}' THEN
          RAISE EXCEPTION 'intentional integration-test failure';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER supportpilot_test_reject_signup_admin
      BEFORE INSERT ON users
      FOR EACH ROW EXECUTE FUNCTION supportpilot_test_reject_signup_admin();
    `);

    try {
      assert.equal((await signup(input)).status, 202);
      const response = await request("/api/v1/auth/verify-organization-signup", {
        method: "POST",
        body: { token: tokenFor(input.email as string) },
      });
      assert.equal(response.status, 500);

      const [organization] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(
          organizations.slug,
          input.organizationSlug as string,
        ))
        .limit(1);
      assert.equal(organization, undefined);

      const [admin] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(
          users.email,
          input.email as string,
        ))
        .limit(1);
      assert.equal(admin, undefined);

      const [pending] = await db
        .select({ id: pendingOrganizationSignups.id })
        .from(pendingOrganizationSignups)
        .where(eq(
          pendingOrganizationSignups.email,
          input.email as string,
        ))
        .limit(1);
      assert.ok(pending);
    } finally {
      await pool.query(`
        DROP TRIGGER IF EXISTS supportpilot_test_reject_signup_admin ON users;
        DROP FUNCTION IF EXISTS supportpilot_test_reject_signup_admin();
      `);
    }
  });

  it("keeps signup and resend tokens, links, passwords, and hashes out of application logs", async () => {
    const input = signupInput("dev-link");
    resetEmailProvider();
    const capturedLogLines: string[] = [];
    const logStream = Reflect.get(logger, pino.symbols.streamSym) as {
      write: (chunk: string) => boolean;
    };
    const originalWrite = logStream.write;
    logStream.write = (chunk) => {
      capturedLogLines.push(chunk);
      return true;
    };

    try {
      const response = await signup(input);
      assert.equal(response.status, 202);
      const originalUrl = takeDevelopmentVerificationLink(
        input.email as string,
      );
      assert.ok(originalUrl);
      const originalToken = new URL(originalUrl).searchParams.get("token");
      assert.ok(originalToken);
      assert.equal(takeDevelopmentVerificationLink(input.email as string), null);

      const resend = await resendVerification({
        organizationSlug: input.organizationSlug as string,
        email: input.email as string,
      });
      assert.equal(resend.status, 202);
      const verificationUrl = takeDevelopmentVerificationLink(
        input.email as string,
      );
      assert.ok(verificationUrl);
      const token = new URL(verificationUrl).searchParams.get("token");
      assert.ok(token);
      const [pending] = await db
        .select()
        .from(pendingOrganizationSignups)
        .where(eq(pendingOrganizationSignups.email, input.email as string))
        .limit(1);
      assert.ok(pending);

      const capturedLogs = capturedLogLines.join("");
      assert.equal(capturedLogs.includes(token), false);
      assert.equal(capturedLogs.includes(originalToken), false);
      assert.equal(capturedLogs.includes(verificationUrl), false);
      assert.equal(capturedLogs.includes(originalUrl), false);
      assert.equal(capturedLogs.includes(input.password as string), false);
      assert.equal(capturedLogs.includes(pending.passwordHash), false);
      assert.equal(capturedLogs.includes(pending.tokenHash), false);
    } finally {
      logStream.write = originalWrite;
      configureEmailProvider({
        async sendVerificationEmail(emailInput) {
          verificationUrls.set(emailInput.to, emailInput.verificationUrl);
        },
      });
    }
  });

  it("does not log database parameters or credentials when signup fails", async () => {
    const input = signupInput("logging");
    const capturedLogArguments: unknown[][] = [];
    const originalError = logger.error;
    logger.error = ((...args: unknown[]) => {
      capturedLogArguments.push(args);
    }) as typeof logger.error;

    await pool.query(`
      CREATE OR REPLACE FUNCTION supportpilot_test_reject_signup_pending()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.email = '${input.email}' THEN
          RAISE EXCEPTION 'sensitive=%:%', NEW.password_hash, NEW.token_hash;
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER supportpilot_test_reject_signup_pending
      BEFORE INSERT ON pending_organization_signups
      FOR EACH ROW EXECUTE FUNCTION supportpilot_test_reject_signup_pending();
    `);

    try {
      const response = await signup(input);
      assert.equal(response.status, 500);
      assert.equal(capturedLogArguments.length, 1);
      const loggedFields = capturedLogArguments[0]?.[0];
      assert.ok(loggedFields && typeof loggedFields === "object");
      assert.deepEqual(Object.keys(loggedFields).sort(), [
        "category",
        "postgresCode",
        "requestId",
      ]);
      assert.equal(
        (loggedFields as { category: string }).category,
        "database_error",
      );
      assert.equal(
        (loggedFields as { postgresCode: string }).postgresCode,
        "P0001",
      );

      const serializedLogs = JSON.stringify(capturedLogArguments);
      assert.equal(serializedLogs.includes(input.password as string), false);
      assert.equal(serializedLogs.includes("sensitive="), false);
      assert.equal(serializedLogs.includes("passwordHash"), false);
      assert.equal(serializedLogs.includes("tokenHash"), false);
      assert.equal(serializedLogs.includes("INSERT INTO"), false);
    } finally {
      logger.error = originalError;
      await pool.query(`
        DROP TRIGGER IF EXISTS supportpilot_test_reject_signup_pending
          ON pending_organization_signups;
        DROP FUNCTION IF EXISTS supportpilot_test_reject_signup_pending();
      `);
    }
  });

  it("derives authenticated tenant scope from the stored user, not a token claim", async () => {
    const input = signupInput("tenant");
    assert.equal((await signup(input)).status, 202);
    const verified = await request("/api/v1/auth/verify-organization-signup", {
      method: "POST",
      body: { token: tokenFor(input.email as string) },
    });
    assert.equal(verified.status, 201);

    const otherOrganizationId = randomUUID();
    const [otherOrganization] = await db
      .insert(organizations)
      .values({
        id: otherOrganizationId,
        name: "Other tenant",
        slug: `other-${testRunId.slice(0, 8)}`,
      })
      .returning({ id: organizations.id });
    assert.ok(otherOrganization);
    createdSlugs.push(`other-${testRunId.slice(0, 8)}`);

    const mismatchedClaimToken = await generateAccessToken({
      userId: verified.body.data?.admin?.id as string,
      organizationId: otherOrganization.id,
      role: "admin",
      type: "access",
    });
    const scoped = await request("/api/v1/organizations/me", {
      token: mismatchedClaimToken,
    });
    assert.equal(scoped.status, 200);
    assert.equal(
      scoped.body.data?.organization?.id,
      verified.body.data?.organization?.id,
    );
  });
});
