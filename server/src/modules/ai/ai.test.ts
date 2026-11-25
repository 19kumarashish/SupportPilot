import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MockChatCompletionProvider,
  MockEmbeddingProvider,
} from "../../infrastructure/ai/mock-ai-provider.js";
import {
  CUSTOMER_AI_VISIBILITIES,
  STAFF_AI_VISIBILITIES,
  shouldHandOffCustomerAsk,
} from "./ai.service.js";
import { customerAskSchema, draftReplyParamSchema, reindexParamSchema } from "./ai.validators.js";
import { chunkArticle } from "./kb-chunker.js";

describe("KB chunker", () => {
  it("returns at least one chunk for a short article", () => {
    const chunks = chunkArticle("Password Reset", "Use the forgot password link.");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.chunkIndex, 0);
    assert.match(chunks[0]?.content ?? "", /Password Reset/);
  });

  it("splits markdown sections and preserves heading metadata", () => {
    const body = [
      "Overview of billing.",
      "",
      "## Invoices",
      "You can download PDF invoices from the billing tab.",
      "",
      "## Refunds",
      "Refunds are processed within 5 business days.",
    ].join("\n");

    const chunks = chunkArticle("Billing Guide", body);
    assert.ok(chunks.length >= 3);
    assert.equal(chunks[0]?.heading, null);
    assert.equal(chunks[1]?.heading, "Invoices");
    assert.equal(chunks[2]?.heading, "Refunds");
  });

  it("splits oversized content with overlap", () => {
    const body = Array.from({ length: 12 }, (_, i) => `Paragraph ${i}: ${"word ".repeat(80)}`).join("\n\n");
    const chunks = chunkArticle("Long Article", body);
    assert.ok(chunks.length >= 2);
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(chunks[i]?.chunkIndex, i);
      assert.ok((chunks[i]?.tokenCount ?? 0) > 0);
    }
  });
});

describe("AI visibility & handoff contracts", () => {
  it("excludes internal_staff from customer AI visibility filters", () => {
    assert.deepEqual(CUSTOMER_AI_VISIBILITIES, ["public", "customers_only"]);
    assert.equal(CUSTOMER_AI_VISIBILITIES.includes("internal_staff"), false);
  });

  it("includes all visibilities for staff AI drafts", () => {
    assert.deepEqual(STAFF_AI_VISIBILITIES, ["public", "customers_only", "internal_staff"]);
  });

  it("hands off when no chunks or score/confidence below threshold", () => {
    assert.equal(shouldHandOffCustomerAsk(undefined, undefined, 0.65), true);
    assert.equal(shouldHandOffCustomerAsk(0.4, 0.9, 0.65), true);
    assert.equal(shouldHandOffCustomerAsk(0.8, 0.5, 0.65), true);
    assert.equal(shouldHandOffCustomerAsk(0.75, 0.85, 0.65), false);
  });
});

describe("AI validators", () => {
  it("validates customerAskSchema", () => {
    assert.equal(customerAskSchema.safeParse({ question: "" }).success, false);
    assert.equal(customerAskSchema.safeParse({ question: "How do I reset MFA?" }).success, true);
    assert.equal(customerAskSchema.safeParse({ question: "a".repeat(501) }).success, false);
  });

  it("validates UUID params for draftReply and reindex", () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000";
    assert.equal(draftReplyParamSchema.safeParse({ ticketId: validId }).success, true);
    assert.equal(draftReplyParamSchema.safeParse({ ticketId: "invalid" }).success, false);
    assert.equal(reindexParamSchema.safeParse({ articleId: validId }).success, true);
    assert.equal(reindexParamSchema.safeParse({ articleId: "invalid" }).success, false);
  });
});

describe("Mock AI provider", () => {
  it("produces deterministic 1536-dim embeddings", async () => {
    const provider = new MockEmbeddingProvider();
    const [[a], [b]] = await Promise.all([
      provider.embedTexts(["reset password"]),
      provider.embedTexts(["reset password"]),
    ]);
    assert.equal(a?.length, 1536);
    assert.deepEqual(a, b);
  });

  it("generates grounded replies with citations when chunks exist", async () => {
    const chat = new MockChatCompletionProvider();
    const reply = await chat.generateGroundedReply({
      systemPrompt: "Help the user",
      userMessage: "How do I reset my password?",
      chunks: [
        {
          articleId: "550e8400-e29b-41d4-a716-446655440000",
          slug: "password-reset",
          title: "Password Reset",
          heading: "Steps",
          content: "Click Forgot Password on the login screen.",
          score: 0.91,
        },
      ],
    });
    assert.equal(reply.confidence, 0.9);
    assert.equal(reply.citations.length, 1);
    assert.equal(reply.citations[0]?.slug, "password-reset");
  });
});
