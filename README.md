# SupportPilot

AI-native, multi-tenant customer support SaaS.

## CI

GitHub Actions runs server and client type-checks, lint, production builds, database URL safety unit tests, and PostgreSQL integration tests. On Ubuntu, integration tests use an ephemeral `supportpilot_ci_test` database and the existing test database URL guard; they never use a development database.

Use Node.js 24 (`.nvmrc`) and pnpm 11.21.0.

Reproduce the checks locally with:

```powershell
pnpm install --frozen-lockfile
pnpm --filter server type-check
pnpm --filter server lint
pnpm --filter server build
pnpm --filter client exec tsc --noEmit
pnpm --filter client lint
pnpm --filter client build
pnpm --filter client test
pnpm --filter server test:unit
```

## Status

🚧 Phase 1 — Engineering Foundation

Detailed current scope and remaining work are documented in
[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md), [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md),
and [ARCHITECTURE.md](ARCHITECTURE.md).

Organization onboarding now supports public signup followed by email verification. The organization and its first administrator are created together only after a valid, unexpired, single-use verification token is used. Pending signup tokens are stored as hashes. Staff can sign in with the workspace slug; UUID-based login remains available for existing clients.

For local development, the development email adapter keeps verification links in memory rather than writing them to logs. Retrieve a link once by posting `{"email":"admin@example.test"}` to `POST /api/v1/auth/development/verification-link` from the local machine while the API runs in development mode. The endpoint is loopback-only, and the link expires with its signup. If the API restarts or the link expires, request a replacement using `POST /api/v1/auth/organization-signup/resend-verification` with `{"organizationSlug":"your-workspace","email":"admin@example.test"}`. The resend endpoint returns the same response for eligible and ineligible signup details; a fresh link is only sent for an unexpired pending signup. Requests are throttled per source address in the current API process; production deployments should also apply shared rate limiting at the edge. Expired reservations are reclaimed only when a new signup matches their email or workspace slug. Set `PUBLIC_APP_URL` to the frontend origin used in verification links. Production HTTP email delivery uses `EMAIL_PROVIDER=http`, `EMAIL_API_URL`, `EMAIL_API_KEY`, and `EMAIL_FROM`; enable asynchronous delivery with `REDIS_URL` and `ENABLE_ASYNC_NOTIFICATIONS=true`.

The onboarding endpoints are `POST /api/v1/auth/organization-signup` and `POST /api/v1/auth/verify-organization-signup`. Signup reserves the workspace slug and email only while verification is pending; existing tenant-scoped email membership rules remain unchanged.

Current milestone: tenant-scoped SLA policies, persisted ticket deadlines, breach tracking, and optional BullMQ email/SLA workers are in place for the core ticket API. Each response includes SLA deadline metadata and enforced status-transition rules to prevent invalid support lifecycles.

Ticket collaboration is also supported through authenticated comment and attachment APIs:

- `GET` / `POST` `/api/v1/tickets/:id/comments`
- `GET` / `POST` `/api/v1/tickets/:id/attachments`
- `GET` `/api/v1/tickets/:id/attachments/:attachmentId/download`
- `DELETE` `/api/v1/tickets/:id/attachments/:attachmentId` (admins only)

Admin and agent accounts can read internal notes; only comments marked public are eligible for customer-facing use. Customer authentication and customer-facing ticket APIs are now implemented for listing, creation, and comments; the complete customer portal UI is not. Attachment uploads accept PDF, PNG, and JPEG files up to 10 MiB. Files are kept outside PostgreSQL in a private local directory configured by `ATTACHMENT_STORAGE_PATH`; configure a persistent, access-controlled path for deployment and do not expose it as static content. Malware scanning is not available yet, so uploaded files must be treated as untrusted.

## Vision

SupportPilot helps companies reduce repetitive support workload and improve resolution speed through:

- AI-powered customer support
- Organization-specific knowledge retrieval
- RAG
- AI agents
- Controlled tool calling
- Real-time conversations
- Human handoff
- Support analytics

## Repository Structure

```text
client/           Frontend application
server/           Backend application
packages/         Shared packages
docs/             Engineering documentation
tests/            Cross-application tests
infrastructure/  Infrastructure configuration
.github/          CI/CD workflows