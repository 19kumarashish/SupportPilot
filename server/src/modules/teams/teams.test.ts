import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTeamSchema, membershipSchema } from "./validators/team.validators.js";
import { createInvitationSchema } from "../users/invitations/invitation.validators.js";
import { organizationSettingsSchema } from "../organizations/organization-settings.validators.js";
import { hashToken } from "../../shared/security/token.js";

describe("teams, invitations, and settings validation", () => {
  it("accepts team slugs and membership roles while rejecting unsafe slugs", () => {
    assert.equal(createTeamSchema.safeParse({ name: "Tier One", slug: "tier-one" }).success, true);
    assert.equal(createTeamSchema.safeParse({ name: "Tier One", slug: "Tier One" }).success, false);
    assert.deepEqual(membershipSchema.parse({ userId: "bd288f02-9baf-4551-a278-e09f2adabf00" }).role, "member");
  });

  it("normalizes invitation email and never treats a raw token as its stored value", () => {
    const parsed = createInvitationSchema.parse({ email: " Agent@Example.com " });
    const raw = "test-invitation-token";
    assert.equal(parsed.email, "agent@example.com");
    assert.notEqual(hashToken(raw), raw);
    assert.equal(hashToken(raw), hashToken(raw));
  });

  it("requires complete persisted settings and permits a nullable SLA default", () => {
    assert.equal(organizationSettingsSchema.safeParse({
      supportEmail: null,
      defaultSlaPolicyId: null,
      autoAssignEnabled: false,
      aiAssistanceEnabled: false,
      timezone: "UTC",
    }).success, true);
  });
});
