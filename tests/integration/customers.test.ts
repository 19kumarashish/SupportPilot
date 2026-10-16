import { createRequire } from "node:module";
import { resolve } from "node:path";
import { getTestDatabaseUrl } from "./test-database-url.js";

const serverRequire = createRequire(resolve(process.cwd(), "package.json"));
const dotenv = serverRequire("dotenv") as {
  config(options: { path: string }): unknown;
};

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

process.env.DATABASE_URL = getTestDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.TEST_DATABASE_URL,
);

await import("../../server/src/modules/customers/customers.test.js");