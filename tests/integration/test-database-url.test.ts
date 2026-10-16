import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTestDatabaseUrl } from "./test-database-url.js";

describe("getTestDatabaseUrl", () => {
  it("derives a separate database name when no override is configured", () => {
    assert.equal(
      getTestDatabaseUrl(
        "postgresql://user:password@localhost:5432/supportpilot",
        undefined,
      ),
      "postgresql://user:password@localhost:5432/supportpilot_test",
    );
  });

  it("uses and validates an explicitly configured test URL", () => {
    assert.equal(
      getTestDatabaseUrl(
        "postgresql://user:password@localhost:5432/supportpilot",
        "postgresql://user:password@localhost:5432/separate_test",
      ),
      "postgresql://user:password@localhost:5432/separate_test",
    );
  });

  it("rejects the development database even when host aliases differ", () => {
    assert.throws(
      () =>
        getTestDatabaseUrl(
          "postgresql://user:password@localhost:5432/supportpilot",
          "postgresql://user:password@127.0.0.1:5432/supportpilot",
        ),
      /must not point to the configured development database/u,
    );
  });

  it("rejects missing, malformed, and unsafe URLs without exposing credentials", () => {
    assert.throws(
      () => getTestDatabaseUrl(undefined, undefined),
      /Set DATABASE_URL or TEST_DATABASE_URL/u,
    );
    assert.throws(
      () => getTestDatabaseUrl("not-a-url", undefined),
      /valid PostgreSQL connection URL/u,
    );
    assert.throws(
      () =>
        getTestDatabaseUrl(
          "postgresql://user:password@localhost:5432/supportpilot",
          "not-a-url",
        ),
      /valid PostgreSQL connection URL/u,
    );
    assert.throws(
      () =>
        getTestDatabaseUrl(
          "postgresql://user:secret@localhost/supportpilot",
          "postgresql://user:secret@localhost/supportpilot?options=-csearch_path%3Dpublic",
        ),
      /must not override its connection target/u,
    );
  });
});
