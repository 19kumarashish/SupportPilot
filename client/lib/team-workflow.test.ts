import assert from "node:assert/strict";
import { describe, it } from "node:test";

const slugify = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

describe("team workflow helpers", () => {
  it("creates stable API-safe team slugs", () => {
    assert.equal(slugify(" Tier One / Support "), "tier-one-support");
  });
});
