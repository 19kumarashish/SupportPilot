import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { kbService } from "./kb.service.js";

describe("knowledge base visibility contracts", () => {
  it("limits public content to published public articles", () => {
    assert.deepEqual(kbService.publicFilters(), {
      status: ["published"],
      visibility: ["public"],
    });
  });

  it("limits customer content to published public and customer-only articles", () => {
    assert.deepEqual(kbService.customerFilters(), {
      status: ["published"],
      visibility: ["public", "customers_only"],
    });
  });
});

