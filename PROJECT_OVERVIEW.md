# SupportPilot Project Overview

## Product

SupportPilot is an AI-ready, multi-tenant customer-support platform. It currently
provides organization onboarding, staff authentication, customer records, ticket
workflows, ticket collaboration, customer ticket access, and a Next.js
operations UI. AI, knowledge-base, analytics, and asynchronous notification
features are planned but are not implemented yet.

## Technology

- **Frontend:** Next.js 16, React 19, TypeScript, React Query, Tailwind CSS.
- **Backend:** Node.js 24, TypeScript, Express 5.
- **Persistence:** PostgreSQL with Drizzle ORM and SQL migrations.
- **Security:** Argon2 password hashing, JWT access/refresh tokens, Helmet,
  CORS allowlisting, Zod validation, rate limiting, and audit events.
- **Files:** Private filesystem storage behind an attachment service. S3 is not
  wired yet.
- **Optional infrastructure:** Redis and BullMQ dependencies are present, but
  production workers are not implemented.

## Repository layout

```text
client/                 Next.js application and UI tests
server/src/             Express application, modules, middleware, and schemas
server/drizzle/         Drizzle SQL migrations and snapshots
tests/integration/      PostgreSQL-backed integration tests
docs/testing/           Test-database and integration-test instructions
infrastructure/         Local Docker Compose and deployment placeholders
```

## Implemented capabilities

- Organization signup with email verification and single-use hashed tokens.
- Staff login, refresh, logout, current-user lookup, and role checks.
- Organization-scoped users and customers with soft deletion safeguards.
- Customer login and customer-scoped ticket listing, creation, and comments.
- Ticket creation, filtering, sorting, pagination, assignment, lifecycle
  transitions, archive/delete actions, tags, categories, relations, and bulk
  actions.
- Public/internal comments, comment editing/deletion, and private attachments.
- Tenant-scoped SLA policies, persisted ticket deadlines, breach timestamps,
  production HTTP email delivery, and optional BullMQ email/SLA workers.
- Request validation, tenant-scoped repository queries, rate limits, audit
  event recording, safe error responses, and health checks.
- Dashboard, ticket, customer, team, settings, signup, login, and verification
  frontend routes.

## Not yet implemented

The project is **PARTIALLY COMPLETE**. The remaining product work includes:

- Business-hours-aware SLA calendars and richer escalation policies beyond the
  current configurable minute windows.
- Team entities, invitations, granular membership management, and settings
  persistence.
- Durable email/notification queues and delivery providers.
- Object-storage abstraction, malware scanning, orphan cleanup, and attachment
  audit history.
- Knowledge-base articles, versions, permissions, search, and customer UI.
- Tenant-scoped analytics APIs and dashboards.
- Genuine pgvector ingestion, embeddings, retrieval, citations, grounded
  generation, usage limits, and evaluation tests.
- Production deployment assets, CI migrations against a real deployment
  environment, and end-to-end coverage.

## Local development

Use Node.js 24 and pnpm 11.21.0:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Set `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and
`CORS_ORIGINS` in the environment. Integration tests require a separate
`TEST_DATABASE_URL`; see [docs/testing/README.md](docs/testing/README.md).
