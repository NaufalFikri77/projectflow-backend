# ProjectFlow Backend

Backend API for **ProjectFlow** — Project & Task Management System, built for Nodewave technical assessment.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Bun | 1.2+ | Runtime |
| Hono | 4.x | Web Framework |
| TypeScript | 5.x | Language (strict mode) |
| Prisma | 6.x | ORM |
| PostgreSQL | 15+ | Database |
| JWT (jsonwebtoken) | 9.x | Authentication |
| Zod | 3.x | Validation |
| @nodewave/prisma-ezfilter | 0.2.x | Filtering |
| Biome | 1.x | Linting/Formatting |

## Architecture

```
routes → controllers → services → repositories → Prisma (PostgreSQL)
```

```
src/
├── index.ts                 # App entry point
├── lib/
│   ├── auth.ts              # JWT utilities
│   ├── env.ts               # Environment validation
│   ├── errors.ts            # Custom error classes
│   ├── permissions.ts       # RBAC + ABAC definitions
│   ├── prisma.ts            # Prisma client singleton
│   └── query-helpers.ts     # Pagination/filter/sort helpers
├── middleware/
│   ├── auth.middleware.ts   # JWT verification
│   ├── error-handler.ts     # Global error handler
│   └── rbac.middleware.ts   # Role-based access control
├── repositories/            # Data access layer
│   ├── attachment.repository.ts
│   ├── audit.repository.ts
│   ├── dependency.repository.ts
│   ├── project.repository.ts
│   ├── task.repository.ts
│   └── user.repository.ts
├── routes/                  # API route definitions
│   ├── audit.routes.ts
│   ├── auth.routes.ts
│   ├── client.routes.ts
│   ├── project.routes.ts
│   └── task.routes.ts
├── schemas/                 # Zod validation schemas
│   ├── auth.schema.ts
│   ├── project.schema.ts
│   └── task.schema.ts
├── services/                # Business logic
│   ├── attachment.service.ts
│   ├── audit.service.ts
│   ├── auth.service.ts
│   ├── client.service.ts
│   ├── dependency.service.ts
│   ├── project.service.ts
│   └── task.service.ts
└── __tests__/               # Integration tests
    ├── test-setup.ts
    ├── auth.test.ts
    └── rbac.test.ts
```

## Getting Started

### Prerequisites

- Bun >= 1.2
- PostgreSQL >= 15

### Installation

```bash
bun install
cp .env.example .env
# Edit .env with your database credentials
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | required |
| `JWT_SECRET` | Secret key for JWT signing | required |
| `PORT` | Server port | 3001 |
| `FRONTEND_URL` | Frontend URL for CORS | required |

### Database Setup

```bash
# Generate Prisma Client
bun run db:generate

# Run migrations
bun run db:migrate

# Seed demo data
bun run db:seed
```

### Development

```bash
bun run dev
```

Server runs on http://localhost:3001

### Testing

```bash
bun test
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Projects
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/projects` | List projects | All (filtered by role) |
| GET | `/api/projects/:id` | Get project | Member/PM/Owner |
| POST | `/api/projects` | Create project | PM only |
| PUT | `/api/projects/:id` | Update project | PM only |
| DELETE | `/api/projects/:id` | Soft delete | PM only |
| POST | `/api/projects/:id/members` | Add member | PM only |
| DELETE | `/api/projects/:id/members/:userId` | Remove member | PM only |

### Tasks
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/tasks` | List tasks | All (filtered by role) |
| GET | `/api/tasks/:id` | Get task | Member/PM |
| POST | `/api/tasks` | Create task | PM only |
| PUT | `/api/tasks/:id` | Update task | PM (core), Team (status) |
| PATCH | `/api/tasks/:id/status` | Change status | PM/Team (with restrictions) |
| DELETE | `/api/tasks/:id` | Soft delete | PM only |

### Dependencies
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/tasks/:id/dependencies` | Get dependencies | Authenticated |
| POST | `/api/tasks/:id/dependencies` | Add dependency | PM only |
| DELETE | `/api/tasks/:id/dependencies/:depId` | Remove dependency | PM only |

### Attachments
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/tasks/:id/attachments` | List attachments | Internal team |
| POST | `/api/tasks/:id/attachments` | Upload attachment | Internal team |
| DELETE | `/api/tasks/attachments/:id` | Delete attachment | Authenticated |

### Audit Logs
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/audit-logs` | List all logs | PM only |
| GET | `/api/tasks/:id/audit-logs` | Task audit logs | PM only |

### Client Dashboard
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/client/projects` | Client's projects + metrics | Client only |
| GET | `/api/client/projects/:id` | Project detail + tasks | Client only |
| GET | `/api/client/projects/:id/tasks` | Client-visible tasks | Client only |

All list endpoints support: `?search=`, `?page=`, `?limit=`, `?sortBy=`, `?sortOrder=`, and entity-specific filters.

## RBAC + ABAC

| Action | PM | UI/UX | Frontend | Backend | Client |
|---|:---:|:---:|:---:|:---:|:---:|
| Create/Edit/Delete Project | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Task | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit Task (core fields) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change Task Status | ✅* | ✅** | ✅** | ✅** | ❌ |
| Upload Attachment | ✅ | ✅** | ✅** | ✅** | ❌ |
| Manage Dependencies | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Internal Data | ✅ | ✅ | ✅ | ✅ | ❌ |

\* PM cannot change IN_PROGRESS → DONE
\** Internal team: only for tasks in projects they are members of

## Key Features

### Task Dependencies
- Dependency chain enforcement (e.g., UI Design → Backend API → Frontend → Testing)
- Cannot start a task (IN_PROGRESS) if dependencies are not DONE
- Circular dependency detection via DFS
- Auto-BLOCKED when dependency is added for an incomplete task

### Optimistic Locking
- Every task has a `version` field
- Updates require matching version number
- Returns `HTTP 409 Conflict` if version mismatch

### Audit Trail
- Every task change recorded in AuditLog
- Tracks: action, changedColumn, oldValue, newValue, userId, timestamp
- AuditLog is immutable (no update/delete)

### Soft Delete
- Projects, Tasks, Attachments use `isDeleted` + `deletedAt`
- All queries filter `isDeleted: false`
- AuditLog entry created on delete

### Client Isolation
- Clients can only see their own projects
- Only `clientVisible: true` tasks are returned
- Response DTOs strip: assignee name, avatar, department, internal comments
- Filtering enforced at backend service layer, not frontend

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Product Manager | pm@projectflow.com | password123 |
| UI/UX Designer | uiux@projectflow.com | password123 |
| Frontend Dev | frontend@projectflow.com | password123 |
| Backend Dev | backend@projectflow.com | password123 |
| Client | client@projectflow.com | password123 |
| Client 2 | client2@projectflow.com | password123 |

## Deployment

### Railway

1. Create a service from the backend GitHub repository.
2. Use the included `Dockerfile`, or configure Bun with the commands below.
3. Add `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URL` as Railway variables.
4. Railway provides `PORT`; the server binds to `0.0.0.0` and reads it automatically.
5. The container runs `bun run db:deploy` before starting the API.

```text
Build command: bun install && bun run db:generate && bun run build
Start command: bun run db:deploy && bun run start
```

Health check: `GET /health` returns `{ "status": "ok" }`.

## HTTP Status Codes

| Code | Usage |
|---|---|
| 200 | Success |
| 201 | Created |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 409 | Conflict (optimistic locking) |
| 422 | Validation error |
| 500 | Internal server error |
