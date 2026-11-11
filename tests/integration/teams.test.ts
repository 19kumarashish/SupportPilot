import assert from "node:assert/strict";
import { test } from "node:test";

import { getTestDatabaseUrl } from "./test-database-url.js";

test("teams integration database remains isolated from development database", {
  skip: !process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL,
}, () => {
  const url = getTestDatabaseUrl(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
  const database = new URL(url).pathname.slice(1);
  assert.notEqual(database, new URL(process.env.DATABASE_URL ?? url).pathname.slice(1));
});
