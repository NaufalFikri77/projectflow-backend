# ProjectFlow Backend

Bun + Hono API for project, task, dependency, audit, and client progress management.

## Stack

Bun, Hono, strict TypeScript, Prisma, PostgreSQL, Zod, JWT, and bcrypt via `Bun.password`.

## Setup

Requirements: Bun 1+, PostgreSQL 15+.

```bash
bun install
copy .env.example .env
bun run db:generate
bun run db:deploy
bun run db:seed
bun run dev
```

Required environment variables are `DATABASE_URL`, `JWT_SECRET`, `PORT`, and `FRONTEND_URL`. The server refuses to start without a valid database URL or JWT secret.

## Commands

- `bun run dev`: hot development server on port 3001.
- `bun run typecheck`: strict TypeScript check.
- `bun run build`: Bun production bundle.
- `bun run db:deploy`: apply `prisma/migrations` in production.
- `bun run db:seed`: create demo users and project data.
- `bun run lint`: run Biome.
- `bun test`: run Bun tests when present.

## Architecture

`routes -> services -> repositories -> Prisma -> PostgreSQL`

Services enforce JWT identity, RBAC/ABAC, client data projections, dependency rules, optimistic locking, soft delete, and audit behavior. See the repository-level [ARCHITECTURE.md](../ARCHITECTURE.md).

## API Areas

- `/api/auth`: register, login, logout, and profile.
- `/api/projects`: authenticated project CRUD and membership.
- `/api/tasks`: task CRUD, status, dependencies, attachments, and task audit.
- `/api/client`: client-owned projects and client-visible progress.
- `/api/audit-logs`: PM-only audit listing.

All protected endpoints require `Authorization: Bearer <token>`. Public registration creates a client account; it cannot create privileged internal accounts.

Task attachments use validated `multipart/form-data` and local `uploads/` storage for the assessment. Allowed files are JPEG, PNG, WebP, PDF, TXT, and ZIP up to 10 MB. The local storage directory is ignored by Git; production deployments should replace it with durable object storage.

Internal task visibility is enforced server-side by active project membership plus matching assignee or department. Client responses use restricted projections and client-visible dependency filtering.

## Deployment

Deploy the backend to Railway or Render with the four environment variables configured, run `bun run db:deploy`, and start with `bun run start`. Set `FRONTEND_URL` to the exact deployed frontend origin.
