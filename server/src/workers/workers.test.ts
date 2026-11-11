import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { makeIdempotencyKey } from "./jobs.js";

describe("notification job idempotency", () => {
  it("produces a stable key for the same delivery", () => {
    const first = makeIdempotencyKey("sla-breach", "org-1", "ticket-1");
    const second = makeIdempotencyKey("sla-breach", "org-1", "ticket-1");

    assert.equal(first, second);
  });

  it("separates deliveries by tenant and resource", () => {
    assert.notEqual(
      makeIdempotencyKey("sla-breach", "org-1", "ticket-1"),
      makeIdempotencyKey("sla-breach", "org-2", "ticket-1"),
    );
    assert.notEqual(
      makeIdempotencyKey("sla-breach", "org-1", "ticket-1"),
      makeIdempotencyKey("sla-breach", "org-1", "ticket-2"),
    );
  });
});
