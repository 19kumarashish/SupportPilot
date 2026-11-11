import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  customerInputSchema,
  searchCurrentCustomers,
  userInputSchema,
  userUpdateSchema,
} from "./customer-workflow";

describe("customer management validation", () => {
  it("normalizes customer fields and accepts omitted optional values", () => {
    const parsed = customerInputSchema.parse({
      name: "  Acme Support  ",
      email: "  TEAM@EXAMPLE.TEST ",
      phone: "",
      company: "  Acme  ",
    });
    assert.equal(parsed.name, "Acme Support");
    assert.equal(parsed.email, "team@example.test");
    assert.equal(parsed.company, "Acme");
  });

  it("rejects malformed emails and too-short phone numbers", () => {
    assert.equal(customerInputSchema.safeParse({
      name: "Acme",
      email: "not-an-email",
    }).success, false);
    assert.equal(customerInputSchema.safeParse({
      name: "Acme",
      phone: "123",
    }).success, false);
  });

  it("requires a valid initial password for admin-created users", () => {
    const input = {
      email: "agent@example.test",
      password: "short",
      firstName: "Sam",
      lastName: "Agent",
      role: "agent",
    };
    assert.equal(userInputSchema.safeParse(input).success, false);
    assert.equal(userUpdateSchema.safeParse({
      email: "agent@example.test",
      firstName: "Sam",
      lastName: "Agent",
      role: "agent",
    }).success, true);
  });
});

describe("customer page search", () => {
  it("searches only the records provided from the loaded page", () => {
    const currentPage = [
      { name: "Acme", email: "care@acme.test", company: "Acme" },
      { name: "Northwind", email: null, company: "Northwind" },
    ];
    assert.deepEqual(searchCurrentCustomers(currentPage, "acme"), [currentPage[0]]);
    assert.deepEqual(searchCurrentCustomers(currentPage, "missing"), []);
    assert.equal(searchCurrentCustomers(currentPage, "").length, 2);
  });
});
