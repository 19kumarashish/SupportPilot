# Integration Tests

The server integration tests use `TEST_DATABASE_URL` when set. Otherwise, they derive an isolated URL by appending `_test` to the database name in `DATABASE_URL`. They refuse to run if the resulting test URL matches the configured development database.

1. Create a separate database in the local PostgreSQL container:

   ```powershell
   docker compose -f infrastructure/docker-compose.yml exec postgres sh -c 'createdb -U "$POSTGRES_USER" supportpilot_test'
   ```

   Skip this step if `supportpilot_test` already exists.

2. If the test database name should not be the default `<DATABASE>_test`, add `TEST_DATABASE_URL` to the root `.env`. Use the same host, port, username, and password as `DATABASE_URL`, but point it to the dedicated test database. Do not reuse the development database URL.

3. Run the integration tests:

   ```powershell
   pnpm --filter server test:integration
   ```

The test suites apply migrations to the test database and create/delete only their own generated test records.

Ticket attachment integration tests use a unique temporary directory under `server/tmp` and remove it after the suite completes. Attachments are stored outside PostgreSQL in a private local directory; set `ATTACHMENT_STORAGE_PATH` to an absolute, writable persistent directory in deployment. Do not serve this directory as static content.