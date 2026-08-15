# SupportPilot Client

Frontend application for SupportPilot.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Redux Toolkit
- React Hook Form
- Zod
- Axios
- Sonner

## Architecture

The frontend follows a feature-oriented architecture.

### Core directories

- `app/` — Next.js routes and layouts
- `components/` — reusable UI/components
- `features/` — domain-specific functionality
- `hooks/` — reusable React hooks
- `lib/` — framework-independent utilities
- `services/` — external/API services
- `store/` — client-side state
- `types/` — TypeScript types
- `validators/` — validation schemas
- `tests/` — frontend tests

## Development

```bash
pnpm dev