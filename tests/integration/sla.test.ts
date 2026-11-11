import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { getTestDatabaseUrl } from "./test-database-url.js";

const serverRequire = createRequire(resolve(process.cwd(), "package.json"));
const { eq, or } = serverRequire("drizzle-orm") as {
  eq: typeof import("drizzle-orm").eq;
  or: typeof import("drizzle-orm").or;
};
const dotenv = serverRequire("dotenv") as {
  config(options: { path: string }): unknown;
};

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = getTestDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.TEST_DATABASE_URL,
);
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString("base64url");
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString("base64url");

const migratorUrl = pathToFileURL(
  serverRequire.resolve("drizzle-orm/node-postgres/migrator"),
).href;
const [{ db, pool }, { migrate }, { organizations }, { slaPolicies }, { slaRepository }] =
  await Promise.all([
    import("../../server/src/infrastructure/database/client.js"),
    import(migratorUrl),
    import("../../server/src/infrastructure/database/schema/organizations.js"),
    import("../../server/src/db/schema/sla-policies.js"),
    import("../../server/src/modules/sla/repositories/sla.repository.js"),
  ]);

const organizationAId = randomUUID();
const organizationBId = randomUUID();
const policyAId = randomUUID();
const policyBId = randomUUID();

describe("SLA policy tenant isolation", () => {
  before(async () => {
    await migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
    await db.insert(organizations).values([
      { id: organizationAId, name: "SLA A", slug: `sla-a-${organizationAId.slice(0, 8)}` },
      { id: organizationBId, name: "SLA B", slug: `sla-b-${organizationBId.slice(0, 8)}` },
    ]);
    await db.insert(slaPolicies).values([
      {
        id: policyAId,
        organizationId: organizationAId,
        name: "A urgent",
        priority: "urgent",
        firstResponseMinutes: 5,
        resolutionMinutes: 30,
        isDefault: true,
      },
      {
        id: policyBId,
        organizationId: organizationBId,
        name: "B urgent",
        priority: "urgent",
        firstResponseMinutes: 60,
        resolutionMinutes: 120,
        isDefault: true,
      },
    ]);
  });

  after(async () => {
    await db.delete(slaPolicies).where(or(
      eq(slaPolicies.id, policyAId),
      eq(slaPolicies.id, policyBId),
    ));
    await db.delete(organizations).where(or(
      eq(organizations.id, organizationAId),
      eq(organizations.id, organizationBId),
    ));
    await pool.end();
  });

  it("returns only the policy belonging to the requested organization", async () => {
    const policyA = await slaRepository.findByPriority(organizationAId, "urgent");
    const policyB = await slaRepository.findByPriority(organizationBId, "urgent");

    assert.equal(policyA?.id, policyAId);
    assert.equal(policyA?.resolutionMinutes, 30);
    assert.equal(policyB?.id, policyBId);
    assert.equal(policyB?.resolutionMinutes, 120);
  });
});
