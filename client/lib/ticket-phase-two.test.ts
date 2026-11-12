import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterPublicCustomerComments } from "@/components/portal/portal-ticket-detail";
import { buildBulkTicketPayload } from "@/lib/ticket-bulk-workflow";
import { sortTicketActivity } from "@/lib/ticket-detail-workflow";

describe("phase two ticket workflows", () => {
  it("builds scoped bulk action payloads", () => {
    assert.deepEqual(
      buildBulkTicketPayload({
        ticketIds: ["one", "two"],
        action: "priority",
        priority: "urgent",
      }),
      { ticketIds: ["one", "two"], action: "priority", priority: "urgent" },
    );
  });

  it("orders activity chronologically", () => {
    const activity = [
      { id: "2", ticketId: "t", action: "reply", createdAt: "2026-01-02T00:00:00Z" },
      { id: "1", ticketId: "t", action: "created", createdAt: "2026-01-01T00:00:00Z" },
    ];
    assert.deepEqual(sortTicketActivity(activity), [activity[1], activity[0]]);
  });

  it("never exposes internal customer comments", () => {
    const comments = [
      { id: "public", ticketId: "t", authorId: "c", body: "Visible", isInternal: false, createdAt: "" },
      { id: "private", ticketId: "t", authorId: "s", body: "Private", isInternal: true, createdAt: "" },
    ];
    assert.deepEqual(filterPublicCustomerComments(comments).map((comment) => comment.id), ["public"]);
  });
});
