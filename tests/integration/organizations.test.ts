import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

interface OrganizationFixture {
  id: string;
  name: string;
  slug: string;
}

interface ApiResponse {
  success?: boolean;
  data?: {
    organization?: {
      id: string;
      name: string;
      slug: string;
      createdAt: string;
      updatedAt: string;
    };
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
  throw new Error(
    "TEST_DATABASE_URL must point to a dedicated test database",
  );
}

const databaseIdentity = (databaseUrl: string): string => {
  const url = new URL(databaseUrl);
  const defaultPort = url.protocol === "postgres:" ? "5432" : "5432";

  return `${url.protocol}//${url.hostname}:${url.port || defaultPort}${url.pathname}`;
};

const configuredDatabaseUrls = [process.env.DATABASE_URL];

for (const envFile of [
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), ".env"),
]) {
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

const migrationFolder = resolve(
  process.cwd(),
  "drizzle",
);
const migratorUrl = pathToFileURL(
  serverRequire.resolve("drizzle-orm/node-postgres/migrator"),
).href;
const [{ createApp }, { db, pool }, { organizations }, { users }, { generateAccessToken }, { migrate }] =
  await Promise.all([
    import("../../server/src/app.js"),
    import("../../server/src/infrastructure/database/client.js"),
    import("../../server/src/infrastructure/database/schema/organizations.js"),
    import("../../server/src/infrastructure/database/schema/users.js"),
    import("../../server/src/shared/security/jwt.js"),
    import(migratorUrl),
  ]);

const organizationAId = randomUUID();
const organizationBId = randomUUID();
const userAId = randomUUID();
const userBId = randomUUID();
const orphanUserId = randomUUID();
const missingOrganizationId = randomUUID();

let organizationA: OrganizationFixture;
let organizationB: OrganizationFixture;
let tokenA: string;
let tokenB: string;
let server: Server | undefined;
let serverPort: number;
let migrationsComplete = false;

const request = (
  path: string,
  options: RequestOptions = {},
): Promise<HttpResponse> =>
  new Promise((resolveRequest, rejectRequest) => {
    const headers: Record<string, string> = {
      ...options.headers,
    };

    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }

    let serializedBody: string | undefined;

    if (options.body !== undefined) {
      serializedBody = JSON.stringify(options.body);
      headers["content-type"] = "application/json";
      headers["content-length"] = String(
        Buffer.byteLength(serializedBody),
      );
    }

    const outboundRequest = httpRequest(
      {
        hostname: "127.0.0.1",
        port: serverPort,
        path,
        method: "GET",
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
              body: JSON.parse(
                Buffer.concat(chunks).toString("utf8"),
              ) as ApiResponse,
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

describe("GET /api/v1/organizations/me tenant boundary", () => {
  before(async () => {
    await migrate(db, { migrationsFolder: migrationFolder });
    migrationsComplete = true;

    const seededOrganizations = await db
      .insert(organizations)
      .values([
        {
          id: organizationAId,
          name: "Integration Organization A",
          slug: `integration-a-${organizationAId}`,
        },
        {
          id: organizationBId,
          name: "Integration Organization B",
          slug: `integration-b-${organizationBId}`,
        },
      ])
      .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });

    const seededOrganizationA = seededOrganizations[0];
    const seededOrganizationB = seededOrganizations[1];

    assert.ok(seededOrganizationA);
    assert.ok(seededOrganizationB);

    organizationA = seededOrganizationA;
    organizationB = seededOrganizationB;

    await db.insert(users).values([
      {
        id: userAId,
        organizationId: organizationA.id,
        email: `integration-a-${userAId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Integration",
        lastName: "User A",
        role: "agent",
        isActive: true,
      },
      {
        id: userBId,
        organizationId: organizationB.id,
        email: `integration-b-${userBId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Integration",
        lastName: "User B",
        role: "agent",
        isActive: true,
      },
    ]);

    // A deliberately mismatched signed claim confirms auth uses the database user.
    tokenA = await generateAccessToken({
      userId: userAId,
      organizationId: organizationB.id,
      role: "agent",
      type: "access",
    });
    tokenB = await generateAccessToken({
      userId: userBId,
      organizationId: organizationB.id,
      role: "agent",
      type: "access",
    });

    const app = createApp();
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    serverPort = address.port;
  });

  after(async () => {
    try {
      if (server?.listening) {
        await new Promise<void>((resolveClose, rejectClose) => {
          server?.close((error) => {
            if (error) {
              rejectClose(error);
              return;
            }

            resolveClose();
          });
        });
      }

      if (migrationsComplete) {
        await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
          [userAId, userBId, orphanUserId],
        ]);
        await pool.query(
          "DELETE FROM organizations WHERE id = ANY($1::uuid[])",
          [[organizationAId, organizationBId]],
        );
      }
    } finally {
      await pool.end();
    }
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request("/api/v1/organizations/me");

    assert.equal(response.status, 401);
    assert.equal(response.body.error?.code, "AUTHENTICATION_REQUIRED");
  });

  it("returns only Organization A for User A", async () => {
    const response = await request("/api/v1/organizations/me", {
      token: tokenA,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data?.organization?.id, organizationA.id);
    assert.equal(response.body.data?.organization?.name, organizationA.name);
    assert.equal(response.body.data?.organization?.slug, organizationA.slug);
    assert.deepEqual(
      Object.keys(response.body.data?.organization ?? {}).sort(),
      ["createdAt", "id", "name", "slug", "updatedAt"],
    );
  });

  it("returns only Organization B for User B", async () => {
    const response = await request("/api/v1/organizations/me", {
      token: tokenB,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data?.organization?.id, organizationB.id);
    assert.equal(response.body.data?.organization?.name, organizationB.name);
    assert.equal(response.body.data?.organization?.slug, organizationB.slug);
  });

  it("ignores organization IDs in query, body, and headers", async () => {
    const response = await request(
      `/api/v1/organizations/me?organizationId=${organizationB.id}`,
      {
        token: tokenA,
        body: { organizationId: organizationB.id },
        headers: {
          "x-organization-id": organizationB.id,
          "organization-id": organizationB.id,
        },
      },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data?.organization?.id, organizationA.id);
  });

  it("does not expose an organization-ID URL route", async () => {
    const response = await request(
      `/api/v1/organizations/${organizationB.id}/me`,
      { token: tokenA },
    );

    assert.equal(response.status, 404);
    assert.equal(response.body.error?.code, "ROUTE_NOT_FOUND");
  });

  it("returns ORGANIZATION_NOT_FOUND when the authenticated user's organization is missing", async () => {
    const constraintResult = await pool.query<{
      name: string;
      definition: string;
    }>(
      `SELECT conname AS name, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid = 'users'::regclass
         AND confrelid = 'organizations'::regclass
         AND contype = 'f'`,
    );

    const organizationConstraint = constraintResult.rows[0];
    assert.ok(organizationConstraint);

    const quotedConstraintName = `"${organizationConstraint.name.replaceAll('"', '""')}"`;
    await pool.query(
      `ALTER TABLE users DROP CONSTRAINT ${quotedConstraintName}`,
    );

    try {
      await db.insert(users).values({
        id: orphanUserId,
        organizationId: missingOrganizationId,
        email: `integration-orphan-${orphanUserId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Integration",
        lastName: "Orphan",
        role: "agent",
        isActive: true,
      });

      const orphanToken = await generateAccessToken({
        userId: orphanUserId,
        organizationId: missingOrganizationId,
        role: "agent",
        type: "access",
      });
      const response = await request("/api/v1/organizations/me", {
        token: orphanToken,
      });

      assert.equal(response.status, 404);
      assert.equal(response.body.error?.code, "ORGANIZATION_NOT_FOUND");
      assert.equal(response.body.error?.message, "Organization not found");
    } finally {
      await pool.query("DELETE FROM users WHERE id = $1", [orphanUserId]);
      await pool.query(
        `ALTER TABLE users ADD CONSTRAINT ${quotedConstraintName} ${organizationConstraint.definition}`,
      );
    }
  });
});