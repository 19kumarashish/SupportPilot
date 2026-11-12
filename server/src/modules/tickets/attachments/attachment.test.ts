import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowedFileSignatures,
  ensureAttachmentDownloadable,
  extensionMatchesContentType,
  makeAttachmentStorageKey,
} from "./attachment.service.js";
import { findOrphanedKeys } from "../../../workers/attachment-cleanup.worker.js";

describe("attachment file signatures", () => {
  it("accepts supported magic bytes", () => {
    assert.equal(
      allowedFileSignatures["application/pdf"]?.(Buffer.from("%PDF-1.7")),
      true,
    );
    assert.equal(
      allowedFileSignatures["image/png"]?.(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
      true,
    );
    assert.equal(
      allowedFileSignatures["image/jpeg"]?.(
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      ),
      true,
    );
  });

  it("rejects renamed executable and text payloads", () => {
    const executable = Buffer.from("MZ fake executable");
    const text = Buffer.from("plain text pretending to be an image");
    assert.equal(allowedFileSignatures["application/pdf"]?.(executable), false);
    assert.equal(allowedFileSignatures["image/png"]?.(text), false);
    assert.equal(allowedFileSignatures["image/jpeg"]?.(text), false);
    assert.equal(extensionMatchesContentType("payload.exe", "application/pdf"), false);
    assert.equal(extensionMatchesContentType("payload.pdf", "application/pdf"), true);
  });
});

describe("attachment storage keys", () => {
  it("isolates tenants and tickets in the key prefix", () => {
    const first = makeAttachmentStorageKey("org-a", "ticket-1", "invoice.pdf");
    const second = makeAttachmentStorageKey("org-b", "ticket-1", "invoice.pdf");
    assert.match(first, /^org\/org-a\/tickets\/ticket-1\/[0-9a-f-]+-invoice\.pdf$/);
    assert.match(second, /^org\/org-b\/tickets\/ticket-1\/[0-9a-f-]+-invoice\.pdf$/);
    assert.notEqual(first, second);
  });

  describe("attachment download gating", () => {
    it("rejects pending and infected attachments", () => {
      assert.throws(() => ensureAttachmentDownloadable("pending"), {
        statusCode: 409,
      });
      assert.throws(() => ensureAttachmentDownloadable("infected"), {
        statusCode: 403,
      });
      assert.doesNotThrow(() => ensureAttachmentDownloadable("clean"));
    });
  });
});

describe("attachment cleanup", () => {
  it("only identifies objects without metadata rows", () => {
    assert.deepEqual(
      findOrphanedKeys(
        ["org/a/one", "org/a/two"],
        new Set(["org/a/two"]),
      ),
      ["org/a/one"],
    );
  });
});
