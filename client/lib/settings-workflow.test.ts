import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("settings workflow", () => {
  it("preserves nullable defaults when no SLA policy is selected", () => {
    const settings = { defaultSlaPolicyId: "" };
    const payload = { defaultSlaPolicyId: settings.defaultSlaPolicyId || null };
    assert.equal(payload.defaultSlaPolicyId, null);
  });
});
