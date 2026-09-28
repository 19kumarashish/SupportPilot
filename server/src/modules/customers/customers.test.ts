import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { request as httpRequest, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

interface SafeCustomer {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  success?: boolean;
  data?: {
    items?: SafeCustomer[];
    customer?: SafeCustomer;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
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

const explicitTestDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const testDatabaseUrl = (() => {
  if (explicitTestDatabaseUrl) {
    return explicitTestDatabaseUrl;
  }

  const configuredDatabaseUrl = process.env.DATABASE_URL;

  if (!configuredDatabaseUrl) {
    throw new Error(
      "Set DATABASE_URL or TEST_DATABASE_URL to configure an isolated integration-test database",
    );
  }

  const testUrl = new URL(configuredDatabaseUrl);
  const databaseName = testUrl.pathname.slice(1);

  if (!databaseName) {
    throw new Error(
      "Set TEST_DATABASE_URL because DATABASE_URL does not include a database name",
    );
  }

  testUrl.pathname = `/${databaseName}_test`;

  return testUrl.toString();
})();

const databaseIdentity = (databaseUrl: string): string => {
  const url = new URL(databaseUrl);

  return `${url.protocol}//${url.hostname}:${url.port || "5432"}${url.pathname}`;
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

const migratorUrl = pathToFileURL(
  serverRequire.resolve("drizzle-orm/node-postgres/migrator"),
).href;

const [
  { createApp },
  { db, pool },
  { organizations },
  { users },
  { generateAccessToken },
  { migrate },
] = await Promise.all([
  import("../../app.js"),
  import("../../infrastructure/database/client.js"),
  import("../../infrastructure/database/schema/organizations.js"),
  import("../../infrastructure/database/schema/users.js"),
  import("../../shared/security/jwt.js"),
  import(migratorUrl),
]);

const migrationFolder = resolve(process.cwd(), "drizzle");

const organizationAId = randomUUID();
const organizationBId = randomUUID();

const adminAId = randomUUID();
const agentAId = randomUUID();
const adminBId = randomUUID();

const customerBId = randomUUID();

let adminAToken: string;
let agentAToken: string;
let adminBToken: string;

let server: Server | undefined;
let serverPort: number;

let migrationsComplete = false;
let createdCustomerId: string | undefined;

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
        method: options.method ?? "GET",
        headers,
      },
      (response: any) => {
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

const createCustomerBody = (email: string) => ({
  name: "Test Customer",
  email,
  phone: "+91-9876543210",
  company: "Test Company",
});

describe("/api/v1/customers tenant management", () => {
  before(async () => {
    await migrate(db, {
      migrationsFolder: migrationFolder,
    });

    migrationsComplete = true;

    await db.insert(organizations).values([
      {
        id: organizationAId,
        name: "Customers Integration A",
        slug: `customers-a-${organizationAId}`,
      },
      {
        id: organizationBId,
        name: "Customers Integration B",
        slug: `customers-b-${organizationBId}`,
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
    ]);

    adminAToken = await generateAccessToken({
      userId: adminAId,
      organizationId: organizationAId,
      role: "admin",
      type: "access",
    });

    agentAToken = await generateAccessToken({
      userId: agentAId,
      organizationId: organizationAId,
      role: "agent",
      type: "access",
    });

    adminBToken = await generateAccessToken({
      userId: adminBId,
      organizationId: organizationBId,
      role: "admin",
      type: "access",
    });

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
          server?.close((error) =>
            error ? rejectClose(error) : resolveClose(),
          );
        });
      }

      if (migrationsComplete) {
        await pool.query(
          "DELETE FROM organizations WHERE id = ANY($1::uuid[])",
          [[organizationAId, organizationBId]],
        );
      }
    } finally {
      await pool.end();
    }
  });

  it("requires authentication", async () => {
    const response = await request("/api/v1/customers");

    assert.equal(response.status, 401);
  });

  it("allows authenticated agents to access customers", async () => {
    const response = await request("/api/v1/customers", {
      token: agentAToken,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data?.total, 0);
  });

  it("creates customers with tenant scope and safe fields", async () => {
    const response = await request("/api/v1/customers", {
      method: "POST",
      token: adminAToken,
      body: createCustomerBody("customer-a@example.test"),
    });

    assert.equal(response.status, 201);

    const customer = response.body.data?.customer;

    assert.ok(customer);
    assert.equal(customer.organizationId, organizationAId);
    assert.equal(customer.email, "customer-a@example.test");
    assert.equal(customer.name, "Test Customer");
    assert.equal(customer.isActive, true);

    assert.equal(
      Object.hasOwn(customer, "organization_id"),
      false,
    );

    createdCustomerId = customer.id;
  });

  it("rejects client-controlled organization selectors", async () => {
    assert.ok(createdCustomerId);

    const headerAttempt = await request("/api/v1/customers", {
      token: adminAToken,
      headers: {
        "x-organization-id": organizationBId,
      },
    });

    assert.equal(headerAttempt.status, 200);
    assert.ok(
      headerAttempt.body.data?.items?.every(
        (customer) => customer.organizationId === organizationAId,
      ),
    );

    const queryAttempt = await request(
      `/api/v1/customers?organizationId=${organizationBId}`,
      {
        token: adminAToken,
      },
    );

    assert.equal(queryAttempt.status, 400);

    const bodyAttempt = await request("/api/v1/customers", {
      method: "POST",
      token: adminAToken,
      body: {
        ...createCustomerBody("forged-org@example.test"),
        organizationId: organizationBId,
      },
    });

    assert.equal(bodyAttempt.status, 400);
  });

  it("rejects duplicate email within one tenant but allows it in another", async () => {
    const duplicate = await request("/api/v1/customers", {
      method: "POST",
      token: adminAToken,
      body: createCustomerBody("customer-a@example.test"),
    });

    assert.equal(duplicate.status, 409);
    assert.equal(
      duplicate.body.error?.code,
      "CUSTOMER_EMAIL_EXISTS",
    );

    const crossTenant = await request("/api/v1/customers", {
      method: "POST",
      token: adminBToken,
      body: createCustomerBody("customer-a@example.test"),
    });

    assert.equal(crossTenant.status, 201);
    assert.equal(
      crossTenant.body.data?.customer?.organizationId,
      organizationBId,
    );
  });

  it("lists only customers belonging to the authenticated organization", async () => {
    const response = await request(
      "/api/v1/customers?page=1&limit=20",
      {
        token: adminAToken,
      },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data?.page, 1);
    assert.equal(response.body.data?.limit, 20);
    assert.equal(response.body.data?.total, 1);
    assert.equal(response.body.data?.totalPages, 1);
    assert.equal(response.body.data?.items?.length, 1);

    assert.ok(
      response.body.data?.items?.every(
        (customer) => customer.organizationId === organizationAId,
      ),
    );
  });

  it("supports getting a customer by ID and hides another tenant's customer", async () => {
    assert.ok(createdCustomerId);

    const ownCustomer = await request(
      `/api/v1/customers/${createdCustomerId}`,
      {
        token: adminAToken,
      },
    );

    assert.equal(ownCustomer.status, 200);
    assert.equal(
      ownCustomer.body.data?.customer?.organizationId,
      organizationAId,
    );

    const foreignCustomer = await request(
      `/api/v1/customers/${customerBId}`,
      {
        token: adminAToken,
      },
    );

    assert.equal(foreignCustomer.status, 404);
    assert.equal(
      foreignCustomer.body.error?.code,
      "CUSTOMER_NOT_FOUND",
    );
  });

  it("updates only customers inside the authenticated organization", async () => {
    assert.ok(createdCustomerId);

    const updated = await request(
      `/api/v1/customers/${createdCustomerId}`,
      {
        method: "PATCH",
        token: adminAToken,
        body: {
          name: "Updated Customer",
          company: "Updated Company",
        },
      },
    );

    assert.equal(updated.status, 200);
    assert.equal(
      updated.body.data?.customer?.name,
      "Updated Customer",
    );
    assert.equal(
      updated.body.data?.customer?.company,
      "Updated Company",
    );

    const crossTenant = await request(
      `/api/v1/customers/${customerBId}`,
      {
        method: "PATCH",
        token: adminAToken,
        body: {
          name: "Tampered",
        },
      },
    );

    assert.equal(crossTenant.status, 404);

    const protectedField = await request(
      `/api/v1/customers/${createdCustomerId}`,
      {
        method: "PATCH",
        token: adminAToken,
        body: {
          organizationId: organizationBId,
        },
      },
    );

    assert.equal(protectedField.status, 400);
  });

  it("activates and deactivates customers", async () => {
    assert.ok(createdCustomerId);

    const deactivated = await request(
      `/api/v1/customers/${createdCustomerId}/status`,
      {
        method: "PATCH",
        token: adminAToken,
        body: {
          isActive: false,
        },
      },
    );

    assert.equal(deactivated.status, 200);
    assert.equal(
      deactivated.body.data?.customer?.isActive,
      false,
    );

    const activated = await request(
      `/api/v1/customers/${createdCustomerId}/status`,
      {
        method: "PATCH",
        token: adminAToken,
        body: {
          isActive: true,
        },
      },
    );

    assert.equal(activated.status, 200);
    assert.equal(
      activated.body.data?.customer?.isActive,
      true,
    );
  });

  it("validates pagination", async () => {
    const invalid = await request(
      "/api/v1/customers?page=0&limit=101",
      {
        token: adminAToken,
      },
    );

    assert.equal(invalid.status, 400);
  });

  it("deletes only customers in the authenticated organization", async () => {
    assert.ok(createdCustomerId);

    const crossTenantDelete = await request(
      `/api/v1/customers/${customerBId}`,
      {
        method: "DELETE",
        token: adminAToken,
      },
    );

    assert.equal(crossTenantDelete.status, 404);

    const deleted = await request(
      `/api/v1/customers/${createdCustomerId}`,
      {
        method: "DELETE",
        token: adminAToken,
      },
    );

    assert.equal(deleted.status, 200);

    const getDeleted = await request(
      `/api/v1/customers/${createdCustomerId}`,
      {
        token: adminAToken,
      },
    );

    assert.equal(getDeleted.status, 404);
  });

  it("does not allow another tenant's admin to cross the boundary", async () => {
    const response = await request("/api/v1/customers", {
      token: adminBToken,
    });

    assert.equal(response.status, 200);

    assert.ok(
      response.body.data?.items?.every(
        (customer) => customer.organizationId === organizationBId,
      ),
    );
  });
});