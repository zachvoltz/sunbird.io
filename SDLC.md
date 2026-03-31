# Sunbird — Software Development Lifecycle

## Overview

**Sunbird** is a music lessons platform connecting students with coaches. It runs as a monorepo on Turborepo + pnpm, deployed to Cloudflare Workers.

| Attribute | Value |
|-----------|-------|
| Repository | `github.com/zachvoltz/sunbird.io` |
| Main branch | `master` |
| Package manager | pnpm 9.15.4 |
| Node version | 20 |
| Deployment | Cloudflare Workers (API + frontend in single Worker) |
| Database | SQLite (local), Cloudflare D1 (production) |
| Current phase | Phase 2 — Auth, Roles & Booking |

---

## Repository Structure

```
birdie/
├── apps/
│   ├── api/          → Hono API (Cloudflare Workers)
│   └── web/          → React 19 + Vite SPA
├── packages/
│   ├── db/           → Prisma schema, migrations, seed
│   └── shared/       → Zod validators, TypeScript types
├── turbo.json        → Task orchestration
├── package.json      → Root scripts
└── .github/workflows/deploy.yml → CI/CD
```

### Workspace Packages

| Package | Name | Purpose |
|---------|------|---------|
| `apps/api` | `@sunbird/api` | Hono web server, API routes, auth, email |
| `apps/web` | `@sunbird/web` | React SPA, pages, components |
| `packages/db` | `@sunbird/db` | Prisma ORM, schema, migrations |
| `packages/shared` | `@sunbird/shared` | Zod schemas, shared TypeScript types |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, React Router 7 |
| API | Hono 4, Cloudflare Workers |
| ORM | Prisma 6 (SQLite/D1) |
| Auth | Session cookies, Google OAuth (Arctic) |
| Email | Resend |
| Validation | Zod |
| Testing | Vitest |
| CI/CD | GitHub Actions → Cloudflare Workers |

---

## Development

### First-time setup

```bash
pnpm install
pnpm --filter @sunbird/db exec prisma generate
pnpm --filter @sunbird/db exec prisma migrate dev
pnpm --filter @sunbird/db exec prisma db seed
```

### Running locally

```bash
pnpm dev
```

This starts:
- Frontend on `http://localhost:5173` (Vite)
- API on `http://localhost:8787` (Hono via tsx)
- Vite proxies `/api/*` requests to the API

### Key commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm lint` | Lint all packages |

### Per-workspace commands

```bash
pnpm --filter @sunbird/api dev        # API only
pnpm --filter @sunbird/web dev        # Frontend only
pnpm --filter @sunbird/api test       # API tests only
pnpm --filter @sunbird/shared test    # Validator tests only
pnpm --filter @sunbird/db exec prisma studio  # Visual DB browser
```

---

## Database

### Schema location
`packages/db/prisma/schema.prisma`

### Two Prisma generators

1. **`prisma-client-js`** — Standard Node.js client (used in local dev and tests)
2. **`prisma-client` with `runtime = "cloudflare"`** — Worker-compatible client (output: `apps/api/src/generated/prisma/`, used in production)

### DB initialization (`apps/api/src/lib/db.ts`)

The API detects its environment and initializes accordingly:
- **Cloudflare Workers** (production): Uses `PrismaD1` adapter with the `DB` binding
- **Node.js** (local dev, tests): Uses standard `PrismaClient` with `DATABASE_URL`

### Migrations

- **Local**: `pnpm --filter @sunbird/db exec prisma migrate dev`
- **Production D1**: `wrangler d1 migrations apply sunbird-db --remote` (from `apps/api/`)
- **D1 migration files**: `apps/api/migrations/*.sql` (separate from Prisma migrations)

### Seeding

- **Local**: `pnpm --filter @sunbird/db exec prisma db seed`
- **Production D1**: `wrangler d1 execute sunbird-db --remote --command="SQL_HERE"` or `--file=seed.sql`

### Key models

User, Session, Booking, LessonType, LessonCategory, AvailabilitySlot, SessionMessage, SessionResource, SubscriptionPlan, Subscription, Workshop, Event, Song, ContactMessage

---

## Testing

### Framework
Vitest, configured per workspace (`vitest.config.ts` in `apps/api/` and `packages/shared/`)

### Test locations

| File | Tests | Covers |
|------|-------|--------|
| `packages/shared/src/__tests__/validators.test.ts` | 57 | All 15 Zod schemas |
| `apps/api/src/__tests__/password.test.ts` | 8 | Hash + verify |
| `apps/api/src/__tests__/token.test.ts` | 5 | Token generation + hashing |
| `apps/api/src/__tests__/session.test.ts` | 13 | Cookie serialize/parse/clear, session ID |
| `apps/api/src/__tests__/routes/auth.test.ts` | 10 | Register, login, logout, me endpoints |

### Test helpers (`apps/api/src/__tests__/helpers.ts`)

- `createTestDb()` — Creates a temp SQLite DB with schema pushed, returns cleanup function
- `jsonRequest(app, path, options)` — Makes HTTP requests to the Hono app
- `getSessionCookie(res)` — Extracts session cookie from response

### Running tests

```bash
pnpm test                          # All tests via Turbo
pnpm --filter @sunbird/api test    # API tests
pnpm --filter @sunbird/shared test # Shared tests
```

---

## CI/CD Pipeline

**File**: `.github/workflows/deploy.yml`

### Triggers
- **Push to `master`**: Build + test + deploy
- **PR to `master`**: Build + test only (no deploy)

### Build job (always runs)

1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Generate Prisma client (`pnpm --filter @sunbird/db exec prisma generate`)
3. Typecheck (`pnpm turbo typecheck`)
4. Test (`pnpm turbo test`)
5. Build (`pnpm turbo build`)

### Deploy job (push to master only)

1. Install dependencies + generate Prisma client
2. Build frontend (`pnpm --filter @sunbird/web build`)
3. Copy frontend to Worker assets (`cp -r apps/web/dist apps/api/public`)
4. Apply D1 migrations (`wrangler d1 migrations apply sunbird-db --remote`)
5. Deploy Worker (`wrangler deploy`)

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API authentication |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier |

---

## Deployment Architecture

Frontend and API are bundled into a **single Cloudflare Worker**:

```
https://sunbird-api.zachvoltz.workers.dev
├── /api/*     → Hono routes (API)
├── /assets/*  → Static JS/CSS (Vite build output)
└── /*         → index.html (SPA fallback)
```

Wrangler config (`apps/api/wrangler.toml`):
- `[assets]` serves frontend from `./public` with SPA fallback
- `[[d1_databases]]` binds `DB` to the D1 instance
- `ASSETS` binding used by the Hono catch-all to serve frontend for non-API routes
- Compatibility flag: `nodejs_compat`

---

## Environment Variables

### Local development

Set in `apps/api/.dev.vars`:

```
DATABASE_URL=file:/path/to/packages/db/prisma/dev.db
SESSION_SECRET=local-dev-secret-at-least-32-chars
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/oauth/google/cb
RESEND_API_KEY=
EMAIL_FROM=Sunbird <noreply@sunbird.app>
```

### Production

Set as Cloudflare Worker secrets or GitHub Secrets. Key groups:
- **Auth**: `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Email**: `RESEND_API_KEY`, `EMAIL_FROM`
- **Payments** (future): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Storage** (future): R2 bucket binding in wrangler.toml

---

## Turbo Task Graph

```
turbo.json tasks:

build     → depends on ^build (workspace dependencies build first)
dev       → no cache, persistent
lint      → depends on ^build
typecheck → depends on ^build + build
test      → depends on ^build
clean     → no cache
```

---

## Roles

| Role | Access |
|------|--------|
| **ADMIN** | Full platform control, all teacher + student capabilities |
| **COACH** | Manage availability, view/manage bookings, send session notes, chat with students |
| **STUDENT** | Browse lessons, book sessions, chat with coaches, view resources |

Auth middleware: `requireAuth` (401 if no session), `requireRole("COACH", "ADMIN")` (403 if wrong role).

---

## Project Phases

| Phase | Status | Scope |
|-------|--------|-------|
| 0 — Scaffolding | Done | Monorepo, CI, local dev |
| 1 — Design System & Public Pages | Partial | Theme, components, public pages |
| 2 — Auth, Roles & Booking | Active | Login, booking flow, dashboards, session pages |
| 3 — Subscriptions & Workshops | Planned | Stripe, recurring payments |
| 4 — Community Song Feed | Planned | R2 uploads, audio player, comments |
| 5 — Polish & Growth | Planned | SEO, analytics, learning paths |

Full roadmap: `ellisa-sun-development-roadmap.md`
