# SupportPilot Architecture

## Runtime topology

The Next.js client calls the Express API under `/api/v1`. The API validates
requests, authenticates the caller, resolves the organization context, and
delegates to module services and Drizzle repositories. PostgreSQL is the source
of truth. Attachments are stored outside PostgreSQL through the attachment
storage service.

```text
Browser
  -> Next.js client
  -> Express API
       -> auth middleware / role checks / rate limits
       -> module controller
       -> module service
       -> tenant-scoped repository
       -> PostgreSQL
       -> private attachment storage (attachments only)
```

When enabled, Redis/BullMQ provide separate email-notification and SLA-monitor
workers. Jobs use exponential retries, notification logs provide idempotency,
and failed jobs are copied to dead-letter queues. Without Redis or with async
notifications disabled, development/test signup delivery remains in-memory and
local delivery is performed directly.

## Backend modules

- `auth`: signup verification, staff/customer login, refresh sessions, and
  current-user access.
- `organizations`: authenticated organization lookup.
- `users`: organization-scoped staff management.
- `customers`: customer CRUD, status/deletion rules, and customer auth.
- `tickets`: tickets, lifecycle, assignment, search, categories, tags,
  relations, bulk actions, activity, comments, and attachments.
- `health`: liveness/readiness endpoints.
- `sla`: tenant-scoped policy CRUD and policy-based deadline calculation.

Controllers translate HTTP requests and responses. Services enforce business
rules. Repositories perform tenant-scoped database operations. Zod validators
reject malformed input before service execution.

## Authentication and authorization

Staff access uses short-lived JWT access tokens and refresh sessions persisted in
PostgreSQL. Passwords are hashed before persistence. Organization signup stores
only a hash of the verification token and creates the organization plus initial
administrator after successful verification.

Every staff repository operation receives an organization ID. Customer routes
derive both organization and customer identity from the authenticated customer
context; clients cannot supply an organization ID to broaden access. Roles are
currently `admin` and `agent`, with route-level role checks and centralized
permission definitions.

Ticket creation persists first-response and resolution deadlines from the
organization's priority policy, with default windows when no policy exists.
The SLA worker atomically marks eligible open tickets as breached, records an
audit event, and queues one breach alert using an idempotency key.

## Database model

Core entities are organizations, users, refresh sessions, pending organization
signups, customers, tickets, ticket comments, ticket attachments, categories,
tags, tag links, activities, assignment history, relations, and audit events.
Foreign keys and organization-prefixed indexes support tenant isolation and
common list operations. Ticket/customer deletion uses restrictive or soft
deletion behavior where history must remain intact.

Drizzle schema definitions live in `server/src/db/schema` and
`server/src/infrastructure/database/schema`. Generated SQL migrations live in
`server/drizzle`.

## Frontend

The App Router provides login, signup, email verification, dashboard, ticket
inbox/detail/create, customers, team, and settings routes. Shared API/auth
helpers keep access and refresh token handling in one place. Current frontend
coverage is strongest for staff workflows; a complete customer-facing portal
and all management controls are still outstanding.

## Future production topology

For AWS deployment, use ECS/Fargate for the API and worker processes, RDS
PostgreSQL for relational data, ElastiCache Redis for shared rate limits and
BullMQ coordination, and private S3 buckets for attachments. Store JWT,
database, Redis, email, and AI provider secrets in AWS Secrets Manager.
Front the client/API with a managed load balancer and TLS, keep databases and
Redis in private subnets, and emit structured logs/metrics to CloudWatch.

This is a target architecture, not a claim that those integrations already
exist in the repository. Production work must add health checks, graceful
shutdown, worker retry/dead-letter behavior, object-storage authorization,
migration execution, and secret rotation before deployment.
