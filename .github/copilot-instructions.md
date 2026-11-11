# SupportPilot Engineering Rules

## Stack

- Use Node.js 24 and pnpm 11.21.0.
- Backend: Express 5, strict TypeScript, Drizzle ORM, PostgreSQL, and Zod.
- Frontend: Next.js 16 App Router, React 19, React Query, and Tailwind CSS.
- Do not use `any`. Preserve strict types; prefer existing domain types, guards, and validators.

## Backend boundaries

- Routes compose middleware and handlers; controllers are HTTP-only.
- Controllers validate request input with Zod, obtain authenticated tenant context, call services, and format the `{ success, data }` response.
- Services own business rules, transactions, authorization decisions that require domain knowledge, and audit-event recording.
- Repositories own Drizzle queries and persistence mapping. Never put SQL or Drizzle calls in controllers or routes.
- Reuse existing `AppError`, safe error middleware, tenant-context helpers, security utilities, and response conventions.

## Mandatory multi-tenant security

- Every staff repository method that accesses tenant data MUST require `organizationId` as an explicit parameter and filter by `organization_id`.
- Never accept a client-supplied organization ID for staff authorization or persistence.
- Every customer route MUST derive both `organizationId` and `customerId` only from the authenticated customer JWT context. Never trust client-supplied tenant or customer IDs.
- Customer endpoints may return only that authenticated customer’s records.
- Internal ticket comments/notes and `internal_staff` knowledge-base content MUST NEVER be returned by customer endpoints.
- Verification, refresh, invitation, and other sensitive tokens MUST be hashed before database storage.
- Token consumption MUST be atomic, single-use, and expiry-checked.

## Validation and errors

- Validate params, query, and body with the module’s Zod schemas before service execution.
- Throw existing custom error classes for expected failures.
- Let the centralized safe error middleware handle unexpected failures.
- Never return stack traces, raw SQL errors, secrets, password hashes, or token values.
- Do not add silent fallbacks, broad catches, or success-shaped error responses.
