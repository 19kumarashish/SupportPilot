interface DatabaseIdentity {
  host: string;
  port: string;
  database: string;
}

const parseDatabaseUrl = (value: string, label: string): {
  url: URL;
  identity: DatabaseIdentity;
} => {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL connection URL`);
  }

  if (
    (url.protocol !== "postgres:" && url.protocol !== "postgresql:") ||
    !url.hostname ||
    url.hash
  ) {
    throw new Error(`${label} must be a safe PostgreSQL connection URL`);
  }

  for (const parameter of [
    "database",
    "dbname",
    "host",
    "hostaddr",
    "options",
    "port",
    "service",
    "servicefile",
  ]) {
    if (url.searchParams.has(parameter)) {
      throw new Error(`${label} must not override its connection target`);
    }
  }

  let databaseName: string;

  try {
    if (!url.pathname.startsWith("/") || url.pathname.length < 2) {
      throw new Error();
    }

    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error(`${label} must include a valid database name`);
  }

  if (
    !databaseName ||
    databaseName === "." ||
    databaseName === ".." ||
    /[\\/\u0000-\u001f\u007f]/u.test(databaseName)
  ) {
    throw new Error(`${label} must include a safe database name`);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
  const isLoopback =
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/u.test(hostname);

  return {
    url,
    identity: {
      host: isLoopback ? "loopback" : hostname,
      port: url.port || "5432",
      database: databaseName,
    },
  };
};

const hasSameDatabase = (
  first: DatabaseIdentity,
  second: DatabaseIdentity,
): boolean =>
  first.host === second.host &&
  first.port === second.port &&
  first.database === second.database;

export function getTestDatabaseUrl(
  databaseUrl: string | undefined,
  configuredTestDatabaseUrl: string | undefined,
): string {
  const configuredDatabase = databaseUrl?.trim();
  const explicitTestDatabase = configuredTestDatabaseUrl?.trim();

  if (!configuredDatabase && !explicitTestDatabase) {
    throw new Error(
      "Set DATABASE_URL or TEST_DATABASE_URL to configure an isolated integration-test database",
    );
  }

  const development = configuredDatabase
    ? parseDatabaseUrl(configuredDatabase, "DATABASE_URL")
    : undefined;

  if (explicitTestDatabase) {
    const test = parseDatabaseUrl(explicitTestDatabase, "TEST_DATABASE_URL");

    if (development && hasSameDatabase(development.identity, test.identity)) {
      throw new Error(
        "TEST_DATABASE_URL must not point to the configured development database",
      );
    }

    return test.url.toString();
  }

  if (!development) {
    throw new Error(
      "Set DATABASE_URL or TEST_DATABASE_URL to configure an isolated integration-test database",
    );
  }

  const testUrl = new URL(development.url);
  const databaseName = development.identity.database;
  testUrl.pathname = `/${encodeURIComponent(`${databaseName}_test`)}`;
  const test = parseDatabaseUrl(testUrl.toString(), "Derived test database URL");

  if (hasSameDatabase(development.identity, test.identity)) {
    throw new Error(
      "The derived test database must not point to the configured development database",
    );
  }

  return test.url.toString();
}
