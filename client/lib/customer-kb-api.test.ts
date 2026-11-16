import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { searchCustomerKb } from "./customer-kb-api";

describe("customer KB API", () => {
  it("encodes subject searches before requesting customer results", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    try {
      await searchCustomerKb("password reset?");
      assert.match(requestedUrl, /customer\/kb\/search\?q=password%20reset%3F/u);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

