# SupportPilot

AI-native, multi-tenant customer support SaaS.

## Status

🚧 Phase 1 — Engineering Foundation

Current milestone: ticket workflow validation and SLA tracking are in place for the core ticket API. Each response includes SLA deadline metadata and enforced status-transition rules to prevent invalid support lifecycles.

Ticket collaboration is also supported through authenticated comment and attachment APIs:

- `GET` / `POST` `/api/v1/tickets/:id/comments`
- `GET` / `POST` `/api/v1/tickets/:id/attachments`
- `GET` `/api/v1/tickets/:id/attachments/:attachmentId/download`
- `DELETE` `/api/v1/tickets/:id/attachments/:attachmentId` (admins only)

Admin and agent accounts can read internal notes; only comments marked public are eligible for customer-facing use. Customer authentication and customer-facing APIs are not implemented yet. Attachment uploads accept PDF, PNG, and JPEG files up to 10 MiB. Files are kept outside PostgreSQL in a private local directory configured by `ATTACHMENT_STORAGE_PATH`; configure a persistent, access-controlled path for deployment and do not expose it as static content. Malware scanning is not available yet, so uploaded files must be treated as untrusted.

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