<div align="center">

<img src="apps/web/public/sunbird-icon.png" width="96" alt="sunbird logo" />

# sunbird

**Voice. Song. Story.**

A platform for voice, songwriting, theory, performance, and poetry-in-song lessons —
rooted in soul, neo-soul, and folk. Nashville, TN or online.

### 🌐 [**usesunbird.com**](https://usesunbird.com)

[![Live site](https://img.shields.io/badge/live-usesunbird.com-e85d4d)](https://usesunbird.com)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

---

## What it is

sunbird is the full booking-and-teaching platform behind an independent music studio.
Students discover lesson categories, browse coaches, and book sessions; coaches run
their studio end to end — availability, live lessons, a practice library, student
progress, and payments. The two sides talk through real-time chat with push
notifications.

## Features

- **Booking & scheduling** — lesson categories and types, per-coach availability,
  recurring schedules, and Google Calendar sync.
- **Coach ↔ student messaging** — 1:1 live chat over WebSockets (a Durable Object per
  conversation) with away-notifications delivered via Web Push.
- **Practice paths** — curricula, skill trees, and per-student progress, with assigned
  drills and recorded "takes" that coaches annotate and reply to.
- **Media library** — audio resources and lesson materials stored in R2, plus an
  in-browser MIDI editor and voice-range tools.
- **Payments** — pay-per-session today, with subscription plans and lesson packages;
  multi-provider support for **Stripe** and **Square**.
- **Auth** — email/password and **Google OAuth** (sign in with Google), session-based.
- **Workshops & events** — group sessions with registration and RSVPs.

## Tech stack

| Layer | Stack |
| --- | --- |
| **Web** | React 19, React Router 7, Vite 6, Tailwind CSS v4 (self-hosted fonts), TypeScript |
| **API** | Cloudflare Workers, [Hono](https://hono.dev), TypeScript |
| **Data** | Cloudflare **D1** (SQLite) via Prisma (`@prisma/adapter-d1`) |
| **Realtime** | Cloudflare **Durable Objects** (one room per conversation) |
| **Storage** | Cloudflare **R2** (lesson audio & media) |
| **Email / Push** | Cloudflare Email Sending · Web Push (VAPID) |
| **Auth** | [Arctic](https://arcticjs.dev) (Google OAuth) + password sessions |
| **Tooling** | pnpm workspaces · Turborepo · Wrangler |

The web app ships as static assets served by the API Worker itself — one deploy, one
origin, year-long immutable caching, and route-level code-splitting.

## Monorepo layout

```
sunbird/
├── apps/
│   ├── api/      Cloudflare Worker — Hono routes, D1/R2/Durable Objects, cron
│   └── web/      React + Vite SPA (served as the Worker's static assets)
└── packages/
    ├── db/       Prisma schema + generated client (@sunbird/db)
    └── shared/   Types & helpers shared across api and web (@sunbird/shared)
```

## Getting started

**Prerequisites:** Node 20+, [pnpm](https://pnpm.io) 9.15+, and a Cloudflare account
(for D1/R2/Workers when running the full backend).

```bash
# 1. Install
pnpm install

# 2. Configure env (see .env.example for the full list)
cp .env.example .env
#   apps/api also reads local secrets from apps/api/.dev.vars

# 3. Run everything (web on :5173, API on :8787)
pnpm dev
```

The web dev server proxies `/api` → the local Worker on `:8787`.

### Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web + API in watch mode (Turborepo) |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | Type-check everything |
| `pnpm test` | Run the test suites |

## Deployment

Hosted on **Cloudflare Workers**. The API deploy rebuilds the web app, syncs the build
into the Worker's assets, then ships:

```bash
cd apps/api
pnpm run deploy   # build web → sync → wrangler deploy
```

Secrets (Stripe, Square, the VAPID private key, OAuth client secret) are set with
`wrangler secret put` — never committed.

## License

© 2026 Zach Voltz. All rights reserved. This source is published for reference;
it is not licensed for reuse or redistribution.
