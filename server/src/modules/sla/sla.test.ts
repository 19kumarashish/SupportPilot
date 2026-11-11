import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateSlaDeadlines,
  defaultSlaWindows,
} from "./services/sla-calculator.js";

describe("SLA deadline calculation", () => {
  it("uses the organization policy when configured", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const deadlines = calculateSlaDeadlines(createdAt, "urgent", {
      firstResponseMinutes: 5,
      resolutionMinutes: 30,
    });

    assert.equal(
      deadlines.firstResponseDeadlineAt.toISOString(),
      "2026-01-01T00:05:00.000Z",
    );
    assert.equal(
      deadlines.resolutionDeadlineAt.toISOString(),
      "2026-01-01T00:30:00.000Z",
    );
  });

  it("falls back to the priority default", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const deadlines = calculateSlaDeadlines(createdAt, "low");

    assert.equal(
      deadlines.firstResponseDeadlineAt.getTime(),
      createdAt.getTime() + defaultSlaWindows.low.firstResponseMinutes * 60_000,
    );
    assert.equal(
      deadlines.resolutionDeadlineAt.getTime(),
      createdAt.getTime() + defaultSlaWindows.low.resolutionMinutes * 60_000,
    );
  });
});
