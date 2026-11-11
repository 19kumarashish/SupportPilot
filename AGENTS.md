# SupportPilot Agent Rules

## Required verification

Before finishing any code task, run all applicable commands below. A task is
not complete until each command required by the changed surface passes:

```powershell
pnpm --filter server type-check
pnpm --filter server lint
pnpm --filter server test:unit
pnpm --filter client exec tsc --noEmit
pnpm --filter client lint
pnpm --filter client test
```

Do not claim a check passed unless it was actually run. Do not disable tests or
hide failures. For database, migration, or cross-tenant changes, also run the
relevant integration tests when the required isolated PostgreSQL test database
is available.

## Migration workflow

- Drizzle schema changes belong in `server/src/db/schema/` or
  `server/src/infrastructure/database/schema/`, following existing ownership.
- Generate migrations with:

  ```powershell
  pnpm --filter server db:generate
  ```

- Review generated SQL and snapshots before applying them.
- Never modify, reorder, or delete an already-applied SQL migration in
  `server/drizzle/`. Add a new forward migration instead.
- Keep migration metadata synchronized with the generated migration.
- Apply migrations only to the intended database with:

  ```powershell
  pnpm --filter server db:migrate
  ```

- Preserve the existing `TEST_DATABASE_URL` safety guards. Integration tests
  must use a dedicated test database, must never reuse `DATABASE_URL`, and must
  retain CI database-name validation.

## Change discipline

- Preserve unrelated uncommitted work; never reset, force-clean, commit, or
  push unless explicitly requested.
- Keep controllers, services, repositories, validators, and frontend helpers
  within their established boundaries.
- Add or update focused tests and directly related documentation for behavior
  changes.
- Use existing error, auth, tenant, audit, and response helpers before adding
  new abstractions.
