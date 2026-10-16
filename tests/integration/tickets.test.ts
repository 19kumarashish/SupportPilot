import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { getTestDatabaseUrl } from "./test-database-url.js";

interface SafeTicket {
  id: string;
  organizationId: string;
  customerId: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  success?: boolean;
  data?: {
    ticket?: SafeTicket;
    items?: SafeTicket[];
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
  method?: "GET" | "POST" | "PATCH";
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

const serverRequire = createRequire(resolve(process.cwd(), "package.json"));
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

const migrationUrl = pathToFileURL(
  serverRequire.resolve("drizzle-orm/node-postgres/migrator"),
).href;

const [
  { createApp },
  { db, pool },
  { organizations },
  { users },
  { customers },
  { generateAccessToken },
  { migrate },
] = await Promise.all([
  import("../../server/src/app.js"),
  import("../../server/src/infrastructure/database/client.js"),
  import("../../server/src/infrastructure/database/schema/organizations.js"),
  import("../../server/src/infrastructure/database/schema/users.js"),
  import("../../server/src/db/schema/customers.js"),
  import("../../server/src/shared/security/jwt.js"),
  import(migrationUrl),
]);

const migrationFolder = resolve(process.cwd(), "drizzle");
const organizationAId = randomUUID();
const organizationBId = randomUUID();
const adminAId = randomUUID();
const agentAId = randomUUID();
const adminBId = randomUUID();
const customerAId = randomUUID();
const customerBId = randomUUID();
const inactiveCustomerId = randomUUID();

let adminAToken: string;
let agentAToken: string;
let adminBToken: string;
let server: Server | undefined;
let serverPort: number;
let migrationsComplete = false;
let ticketAId: string | undefined;
let ticketBId: string | undefined;

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

const ticketBody = (customerId: string, subject: string) => ({
  customerId,
  subject,
  description: `Description for ${subject}`,
});

describe("/api/v1/tickets tenant management", () => {
  before(async () => {
    await migrate(db, { migrationsFolder: migrationFolder });
    migrationsComplete = true;

    await db.insert(organizations).values([
      {
        id: organizationAId,
        name: "Tickets Integration A",
        slug: `tickets-a-${organizationAId}`,
      },
      {
        id: organizationBId,
        name: "Tickets Integration B",
        slug: `tickets-b-${organizationBId}`,
      },
    ]);

    await db.insert(users).values([
      {
        id: adminAId,
        organizationId: organizationAId,
        email: `ticket-admin-a-${adminAId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Admin",
        lastName: "A",
        role: "admin",
      },
      {
        id: agentAId,
        organizationId: organizationAId,
        email: `ticket-agent-a-${agentAId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Agent",
        lastName: "A",
        role: "agent",
      },
      {
        id: adminBId,
        organizationId: organizationBId,
        email: `ticket-admin-b-${adminBId}@example.test`,
        passwordHash: randomBytes(32).toString("hex"),
        firstName: "Admin",
        lastName: "B",
        role: "admin",
      },
    ]);

    await db.insert(customers).values([
      {
        id: customerAId,
        organizationId: organizationAId,
        name: "Ticket Customer A",
      },
      {
        id: customerBId,
        organizationId: organizationBId,
        name: "Ticket Customer B",
      },
      {
        id: inactiveCustomerId,
        organizationId: organizationAId,
        name: "Inactive Ticket Customer",
        isActive: false,
      },
    ]);

    [adminAToken, agentAToken, adminBToken] = await Promise.all([
      generateAccessToken({
        userId: adminAId,
        organizationId: organizationAId,
        role: "admin",
        type: "access",
      }),
      generateAccessToken({
        userId: agentAId,
        organizationId: organizationAId,
        role: "agent",
        type: "access",
      }),
      generateAccessToken({
        userId: adminBId,
        organizationId: organizationBId,
        role: "admin",
        type: "access",
      }),
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

  it("rejects unauthenticated requests", async () => {
    const response = await request("/api/v1/tickets");
    assert.equal(response.status, 401);
    assert.equal(response.body.error?.code, "AUTHENTICATION_REQUIRED");
  });

  it("creates and retrieves a ticket for an authenticated user", async () => {
    const created = await request("/api/v1/tickets", {
      method: "POST",
      token: agentAToken,
      body: ticketBody(customerAId, "Initial ticket"),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data?.ticket?.organizationId, organizationAId);
    assert.equal(created.body.data?.ticket?.customerId, customerAId);
    assert.equal(created.body.data?.ticket?.status, "open");
    assert.equal(created.body.data?.ticket?.priority, "medium");
    ticketAId = created.body.data?.ticket?.id;
    assert.ok(ticketAId);

    const fetched = await request(`/api/v1/tickets/${ticketAId}`, {
      token: agentAToken,
    });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data?.ticket?.id, ticketAId);
    assert.equal(fetched.body.data?.ticket?.subject, "Initial ticket");
  });

  it("rejects invalid ticket data, malformed IDs, and invalid customers", async () => {
    const invalidSubject = await request("/api/v1/tickets", {
      method: "POST",
      token: adminAToken,
      body: ticketBody(customerAId, "  "),
    });
    assert.equal(invalidSubject.status, 400);

    const invalidDescription = await request("/api/v1/tickets", {
      method: "POST",
      token: adminAToken,
      body: {
        ...ticketBody(customerAId, "Too long"),
        description: "x".repeat(10_001),
      },
    });
    assert.equal(invalidDescription.status, 400);

    const invalidStatus = await request("/api/v1/tickets", {
      method: "POST",
      token: adminAToken,
      body: { ...ticketBody(customerAId, "Bad status"), status: "pending" },
    });
    assert.equal(invalidStatus.status, 400);

    const invalidCustomerId = await request("/api/v1/tickets", {
      method: "POST",
      token: adminAToken,
      body: ticketBody("not-a-uuid", "Bad customer ID"),
    });
    assert.equal(invalidCustomerId.status, 400);

    const missingCustomer = await request("/api/v1/tickets", {
      method: "POST",
      token: adminAToken,
      body: ticketBody(randomUUID(), "Missing customer"),
    });
    assert.equal(missingCustomer.status, 404);
    assert.equal(missingCustomer.body.error?.code, "CUSTOMER_NOT_FOUND");

    const inactiveCustomer = await request("/api/v1/tickets", {
      method: "POST",
      token: adminAToken,
      body: ticketBody(inactiveCustomerId, "Inactive customer"),
    });
    assert.equal(inactiveCustomer.status, 409);
    assert.equal(inactiveCustomer.body.error?.code, "CUSTOMER_INACTIVE");

    const malformedTicketId = await request("/api/v1/tickets/not-a-uuid", {
      token: adminAToken,
    });
    assert.equal(malformedTicketId.status, 400);
  });

  it("does not allow another organization’s customer or ticket to be used", async () => {
    const foreignCustomer = await request("/api/v1/tickets", {
      method: "POST",
      token: adminAToken,
      body: ticketBody(customerBId, "Foreign customer"),
    });
    assert.equal(foreignCustomer.status, 404);

    const created = await request("/api/v1/tickets", {
      method: "POST",
      token: adminBToken,
      body: ticketBody(customerBId, "Organization B ticket"),
    });
    assert.equal(created.status, 201);
    ticketBId = created.body.data?.ticket?.id;
    assert.ok(ticketBId);

    const foreignGet = await request(`/api/v1/tickets/${ticketBId}`, {
      token: adminAToken,
    });
    assert.equal(foreignGet.status, 404);
    assert.equal(foreignGet.body.error?.code, "TICKET_NOT_FOUND");

    const foreignUpdate = await request(`/api/v1/tickets/${ticketBId}`, {
      method: "PATCH",
      token: adminAToken,
      body: { subject: "Cross-tenant update" },
    });
    assert.equal(foreignUpdate.status, 404);

    const foreignStatus = await request(
      `/api/v1/tickets/${ticketBId}/status`,
      {
        method: "PATCH",
        token: adminAToken,
        body: { status: "closed" },
      },
    );
    assert.equal(foreignStatus.status, 404);
  });

  it("lists tickets with tenant-scoped pagination and supported filters", async () => {
    assert.ok(ticketAId);

    const second = await request("/api/v1/tickets", {
      method: "POST",
      token: adminAToken,
      body: {
        ...ticketBody(customerAId, "High priority ticket"),
        priority: "high",
        status: "in_progress",
      },
    });
    assert.equal(second.status, 201);

    const paginated = await request(
      "/api/v1/tickets?page=1&limit=1",
      { token: adminAToken },
    );
    assert.equal(paginated.status, 200);
    assert.equal(paginated.body.data?.page, 1);
    assert.equal(paginated.body.data?.limit, 1);
    assert.equal(paginated.body.data?.total, 2);
    assert.equal(paginated.body.data?.items?.length, 1);
    assert.ok(
      paginated.body.data?.items?.every(
        (ticket) => ticket.organizationId === organizationAId,
      ),
    );

    const filtered = await request(
      "/api/v1/tickets?status=in_progress&priority=high",
      { token: adminAToken },
    );
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data?.total, 1);
    assert.equal(filtered.body.data?.items?.[0]?.subject, "High priority ticket");

    const invalidFilter = await request("/api/v1/tickets?priority=critical", {
      token: adminAToken,
    });
    assert.equal(invalidFilter.status, 400);

    const clientOrganization = await request(
      `/api/v1/tickets?organizationId=${organizationBId}`,
      { token: adminAToken },
    );
    assert.equal(clientOrganization.status, 400);
  });

  it("updates permitted details and status while ignoring client tenant selectors", async () => {
    assert.ok(ticketAId);

    const updated = await request(`/api/v1/tickets/${ticketAId}`, {
      method: "PATCH",
      token: adminAToken,
      body: {
        subject: "Updated ticket",
        priority: "urgent",
        organizationId: organizationBId,
      },
    });
    assert.equal(updated.status, 400);

    const successfulUpdate = await request(`/api/v1/tickets/${ticketAId}`, {
      method: "PATCH",
      token: adminAToken,
      body: {
        subject: "Updated ticket",
        priority: "urgent",
      },
    });
    assert.equal(successfulUpdate.status, 200);
    assert.equal(successfulUpdate.body.data?.ticket?.subject, "Updated ticket");
    assert.equal(successfulUpdate.body.data?.ticket?.priority, "urgent");
    assert.equal(
      successfulUpdate.body.data?.ticket?.organizationId,
      organizationAId,
    );

    const statusUpdate = await request(
      `/api/v1/tickets/${ticketAId}/status`,
      {
        method: "PATCH",
        token: agentAToken,
        body: { status: "resolved" },
      },
    );
    assert.equal(statusUpdate.status, 200);
    assert.equal(statusUpdate.body.data?.ticket?.status, "resolved");

    const headerAttempt = await request("/api/v1/tickets", {
      token: adminAToken,
      headers: { "x-organization-id": organizationBId },
    });
    assert.equal(headerAttempt.status, 200);
    assert.ok(
      headerAttempt.body.data?.items?.every(
        (ticket) => ticket.organizationId === organizationAId,
      ),
    );
  });
});
