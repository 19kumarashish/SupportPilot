# SupportPilot Implementation Checklist

## Phase 1 - Critical security and correctness

- [x] Atomic refresh-token session consumption
- [x] Origin allowlisting and configurable request body limits
- [x] Login, signup, resend, verification, and API rate limiting
- [x] Redis-backed distributed rate-limit store support
- [x] Centralized permission definitions
- [x] Audit event schema and recorder
- [x] Customer soft deletion with ticket-history protection
- [x] Ticket customer foreign key restricted deletion
- [x] Attachment metadata rollback/restore on storage-delete failure
- [x] Case-insensitive user, customer, and pending-signup email uniqueness migration
- [x] Phase 1 migrations applied to isolated PostgreSQL and integration suites passed

## Later phases

- [x] Phase 2 backend: tenant-scoped categories/tags, advanced search/filter/sort, lifecycle, history, relations, bulk actions, comment edit/delete, customer ticket APIs
- [ ] Phase 2 frontend: category/tag detail/bulk controls, timeline/relationships, archive/restore workflows, and customer portal completion
- [x] Configurable tenant-scoped SLA policies, persisted deadlines, breach tracking, and BullMQ monitoring
- [ ] Team entities, memberships, invitations, and organization settings
- [x] BullMQ email notification processing with retries, idempotency logs, and dead-letter queues
- [ ] Storage abstraction, orphan cleanup, validation, malware hook, and attachment audit history
- [ ] Knowledge base articles, versions, feedback, and frontend
- [ ] Tenant-scoped analytics APIs and dashboard
- [ ] Genuine pgvector RAG ingestion, retrieval, citations, and AI ticket assistance
- [ ] Complete customer portal and remaining frontend workflows
- [ ] Comprehensive tenant-isolation, RAG, job, frontend, and end-to-end tests
- [x] Initial architecture, database, API, environment, security, testing, and RAG status documentation
