import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

interface SafeUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "agent";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  success?: boolean;
  data?: {
    users?: SafeUser[];
    user?: SafeUser;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    message?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

interface HttpResponse {
  status: number;
  body: ApiResponse;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

const serverRequire = createRequire(resolve(process.cwd(), "package.json"));
const dotenv = serverRequire("dotenv") as {
  config(options: { path: string }): unknown;
  parse(source: string): Record<string, string>;
};

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must point to a dedicated test database");
}

const databaseIdentity = (databaseUrl: string): string => {
  const url = new URL(databaseUrl);
  return `${url.protocol}//${url.hostname}:${url.port || "5432"}${url.pathname}`;
};

const configuredDatabaseUrls = [process.env.DATABASE_URL];

for (const envFile of [resolve(process.cwd(), "../.env"), resolve(process.cwd(), ".env")]) {
  try {
    configuredDatabaseUrls.push(
      dotenv.parse(readFileSync(envFile, "utf8")).DATABASE_URL,
    );
  } catch {
    // An absent optional env file does not affect the explicit test URL.
  }
}

if (
  configuredDatabaseUrls.some(
    (databaseUrl) =>
      databaseUrl &&
      databaseIdentity(databaseUrl) === databaseIdentity(testDatabaseUrl),
  )
) {
  throw new Error(
    "TEST_DATABASE_URL must not point to a configured development database",
  );
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString("base64url");
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString("base64url");

const migratorUrl = pathToFileURL(
  serverRequire.resolve("drizzle-orm/node-postgres/migrator"),
).href;
const [{ createApp }, { db, pool }, { organizations }, { users }, { refreshSessions }, { generateAccessToken }, { verifyPassword }, { migrate }] =
  await Promise.all([
    import("../../server/src/app.js"),
    import("../../server/src/infrastructure/database/client.js"),
    import("../../server/src/infrastructure/database/schema/organizations.js"),
    import("../../server/src/infrastructure/database/schema/users.js"),
    import("../../server/src/infrastructure/database/schema/refresh-sessions.js"),
    import("../../server/src/shared/security/jwt.js"),
    import("../../server/src/shared/security/password.js"),
    import(migratorUrl),
  ]);

const migrationFolder = resolve(process.cwd(), "drizzle");
const organizationAId = randomUUID();
const organizationBId = randomUUID();
const adminAId = randomUUID();
const agentAId = randomUUID();
const adminBId = randomUUID();
const userBId = randomUUID();

let adminAToken: string;
let agentAToken: string;
let adminBToken: string;
let server: Server | undefined;
let serverPort: number;
let migrationsComplete = false;
let createdUserId: string | undefined;

const request = (
  path: string,
  options: RequestOptions = {},
): Promise<HttpResponse> =>
  new Promise((resolveRequest, rejectRequest) => {
    const headers: Record<string, string> = { ...options.headers };

    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }

    let serializedBody: string | undefined;

    if (options.body !== undefined) {
      serializedBody = JSON.stringify(options.body);
      headers["content-type"] = "application/json";
      headers["content-length"] = String(Buffer.byteLength(serializedBody));
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
    if (serializedBody !== undefined) {
      outboundRequest.write(serializedBody);
    }
    outboundRequest.end();
  });

const createUserBody = (email: string) => ({
  email,
  password: "Strong-password-123",
  firstName: "New",
  lastName: "User",
  role: "agent",
});

describe("/api/v1/users tenant management", () => {
  before(async () => {
    await migrate(db, { migrationsFolder: migrationFolder });
    migrationsComplete = true;

    await db.insert(organizations).values([
      {
        id: organizationAId,
        name: "Users Integration A",
        slug: `users-a-${organizationAId}`,
      },
      {
        id: organizationBId,
        name: "Users Integration B",
        slug: `users-b-${organizationBId}`,
      },
    ]);

    await db.insert(users).values([
      {
        id: adminAId,
        organizationId: organizationAId,
        email: `admin-a-${adminAId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Admin",
        lastName: "A",
        role: "admin",
      },
      {
        id: agentAId,
        organizationId: organizationAId,
        email: `agent-a-${agentAId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Agent",
        lastName: "A",
        role: "agent",
      },
      {
        id: adminBId,
        organizationId: organizationBId,
        email: `admin-b-${adminBId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Admin",
        lastName: "B",
        role: "admin",
      },
      {
        id: userBId,
        organizationId: organizationBId,
        email: "shared-email@example.test",
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "User",
        lastName: "B",
        role: "agent",
      },
    ]);

    [adminAToken, agentAToken, adminBToken] = await Promise.all([
      generateAccessToken({ userId: adminAId, organizationId: organizationAId, role: "admin", type: "access" }),
      generateAccessToken({ userId: agentAId, organizationId: organizationAId, role: "agent", type: "access" }),
      generateAccessToken({ userId: adminBId, organizationId: organizationBId, role: "admin", type: "access" }),
    ]);

    server = createApp().listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    serverPort = address.port;
  });

  after(async () => {
    try {
      if (server?.listening) {
        await new Promise<void>((resolveClose, rejectClose) => {
          server?.close((error) => error ? rejectClose(error) : resolveClose());
        });
      }

      if (migrationsComplete) {
        await pool.query("DELETE FROM organizations WHERE id = ANY($1::uuid[])", [
          [organizationAId, organizationBId],
        ]);
      }
    } finally {
      await pool.end();
    }
  });

  it("requires authentication and admin role", async () => {
    const unauthenticated = await request("/api/v1/users");
    assert.equal(unauthenticated.status, 401);

    const nonAdmin = await request("/api/v1/users", { token: agentAToken });
    assert.equal(nonAdmin.status, 403);
  });

  it("lists only tenant users with validated pagination and safe fields", async () => {
    const response = await request("/api/v1/users?page=1&limit=1", {
      token: adminAToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data?.pagination?.page, 1);
    assert.equal(response.body.data?.pagination?.limit, 1);
    assert.equal(response.body.data?.pagination?.total, 2);
    assert.equal(response.body.data?.pagination?.totalPages, 2);
    assert.equal(response.body.data?.users?.length, 1);
    assert.equal(response.body.data?.users?.[0]?.organizationId, organizationAId);
    assert.equal(
      Object.hasOwn(response.body.data?.users?.[0] ?? {}, "passwordHash"),
      false,
    );

    const invalidPagination = await request("/api/v1/users?limit=101", {
      token: adminAToken,
    });
    assert.equal(invalidPagination.status, 400);
  });

  it("does not let client organization selectors alter tenant scope", async () => {
    const headerAttempt = await request("/api/v1/users", {
      token: adminAToken,
      headers: { "x-organization-id": organizationBId },
    });
    assert.equal(headerAttempt.status, 200);
    assert.ok(
      headerAttempt.body.data?.users?.every(
        (user) => user.organizationId === organizationAId,
      ),
    );

    const queryAttempt = await request(
      `/api/v1/users?organizationId=${organizationBId}`,
      { token: adminAToken },
    );
    assert.equal(queryAttempt.status, 400);

    const bodyAttempt = await request("/api/v1/users", {
      method: "POST",
      token: adminAToken,
      body: { ...createUserBody("forged-org@example.test"), organizationId: organizationBId },
    });
    assert.equal(bodyAttempt.status, 400);
  });

  it("hides another tenant's users by ID", async () => {
    const ownUser = await request(`/api/v1/users/${agentAId}`, {
      token: adminAToken,
    });
    assert.equal(ownUser.status, 200);
    assert.equal(ownUser.body.data?.user?.organizationId, organizationAId);
    assert.equal(Object.hasOwn(ownUser.body.data?.user ?? {}, "passwordHash"), false);

    const response = await request(`/api/v1/users/${userBId}`, {
      token: adminAToken,
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.error?.code, "USER_NOT_FOUND");
  });

  it("creates users with hashed passwords and no hash in the response", async () => {
    const response = await request("/api/v1/users", {
      method: "POST",
      token: adminAToken,
      body: createUserBody("created-user@example.test"),
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data?.user?.organizationId, organizationAId);
    assert.equal(response.body.data?.user?.isActive, true);
    assert.equal(Object.hasOwn(response.body.data?.user ?? {}, "passwordHash"), false);
    createdUserId = response.body.data?.user?.id;
    assert.ok(createdUserId);

    const storedUser = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [createdUserId],
    );
    assert.equal(storedUser.rowCount, 1);
    assert.equal(
      await verifyPassword(
        "Strong-password-123",
        storedUser.rows[0]!.password_hash,
      ),
      true,
    );
  });

  it("rejects duplicate email in one tenant but allows it in another", async () => {
    const duplicate = await request("/api/v1/users", {
      method: "POST",
      token: adminAToken,
      body: createUserBody("created-user@example.test"),
    });
    assert.equal(duplicate.status, 409);

    const crossTenantDuplicate = await request("/api/v1/users", {
      method: "POST",
      token: adminAToken,
      body: createUserBody("shared-email@example.test"),
    });
    assert.equal(crossTenantDuplicate.status, 201);
    assert.equal(crossTenantDuplicate.body.data?.user?.organizationId, organizationAId);
  });

  it("updates only tenant users and rejects protected fields", async () => {
    const updated = await request(`/api/v1/users/${agentAId}`, {
      method: "PATCH",
      token: adminAToken,
      body: { firstName: "Updated" },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data?.user?.firstName, "Updated");
    assert.equal(Object.hasOwn(updated.body.data?.user ?? {}, "passwordHash"), false);

    const crossTenantUpdate = await request(`/api/v1/users/${userBId}`, {
      method: "PATCH",
      token: adminAToken,
      body: { firstName: "Tampered" },
    });
    assert.equal(crossTenantUpdate.status, 404);

    const protectedFieldUpdate = await request(`/api/v1/users/${agentAId}`, {
      method: "PATCH",
      token: adminAToken,
      body: { organizationId: organizationBId },
    });
    assert.equal(protectedFieldUpdate.status, 400);
  });

  it("activates and deactivates users in the authenticated organization", async () => {
    const deactivated = await request(`/api/v1/users/${agentAId}/status`, {
      method: "PATCH",
      token: adminAToken,
      body: { isActive: false },
    });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.data?.user?.isActive, false);

    const activated = await request(`/api/v1/users/${agentAId}/status`, {
      method: "PATCH",
      token: adminAToken,
      body: { isActive: true },
    });
    assert.equal(activated.status, 200);
    assert.equal(activated.body.data?.user?.isActive, true);

    const crossTenantStatus = await request(`/api/v1/users/${userBId}/status`, {
      method: "PATCH",
      token: adminAToken,
      body: { isActive: false },
    });
    assert.equal(crossTenantStatus.status, 404);
  });

  it("prevents self-deletion and cascades refresh sessions when deleting a user", async () => {
    const crossTenantDelete = await request(`/api/v1/users/${userBId}`, {
      method: "DELETE",
      token: adminAToken,
    });
    assert.equal(crossTenantDelete.status, 404);

    const selfDelete = await request(`/api/v1/users/${adminAId}`, {
      method: "DELETE",
      token: adminAToken,
    });
    assert.equal(selfDelete.status, 400);
    assert.equal(selfDelete.body.error?.code, "CANNOT_DELETE_SELF");

    assert.ok(createdUserId);
    await db.insert(refreshSessions).values({
      userId: createdUserId,
      tokenHash: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const deleted = await request(`/api/v1/users/${createdUserId}`, {
      method: "DELETE",
      token: adminAToken,
    });
    assert.equal(deleted.status, 200);

    const sessions = await pool.query<{ count: string }>(
      "SELECT count(*) FROM refresh_sessions WHERE user_id = $1",
      [createdUserId],
    );
    assert.equal(sessions.rows[0]?.count, "0");
  });

  it("does not allow another tenant's admin to cross the boundary", async () => {
    const response = await request("/api/v1/users", { token: adminBToken });
    assert.equal(response.status, 200);
    assert.ok(
      response.body.data?.users?.every(
        (user) => user.organizationId === organizationBId,
      ),
    );
  });
});