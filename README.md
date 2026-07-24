# Next.js + Payload Template

A monorepo starter — a **Next.js 16** web app and a **Payload v3** backend (Postgres), wired together with pnpm workspaces, Turborepo, and TypeScript 6 strict.

Follow this README top to bottom and you'll have everything running locally in ~10 minutes.

---

## Start a new project from this template

On GitHub, click **"Use this template" → Create a new repository** (this gives you a fresh, single-commit history). Then clone your new repo and run the init script once:

```bash
./scripts/init-project.sh <scope> [db-name] [--git]
```

It renames the package scope (`@app/*` → `@<scope>/*`), updates the local Postgres identifiers, creates `apps/web/.env.local` + `apps/backend/.env.local`, and generates a `PAYLOAD_SECRET`.

```bash
# example
./scripts/init-project.sh acme              # packages become @acme/*, db "acme"
./scripts/init-project.sh acme acme_db --git # custom db name + fresh git history
```

After it runs, follow **First-time setup** below (`nvm use` → `pnpm install` → `pnpm dev`). The script is one-shot — delete it once you've run it.

---

## What's in this repo

```
.
├── apps/
│   ├── web/        Next.js 16 site (App Router + Turbopack)        :3000
│   └── backend/    Payload v3 admin + REST/GraphQL API            :3001
├── packages/       Shared TypeScript libraries
│   ├── api-contracts/  Zod schemas + types shared across apps
│   └── ui/             Shared component library
├── tooling/        Shared ESLint, Prettier, TS, Tailwind, Vitest configs
├── docs/           Project docs (add your PRDs / decisions here)
└── docker-compose.yml  Local Postgres
```

Everything is a [pnpm workspace](https://pnpm.io/workspaces). Apps and packages reference each other via `workspace:*`; there is no `npm publish` step.

---

## Prerequisites

| Tool       | Version | How to install                                                                                |
| ---------- | ------- | --------------------------------------------------------------------------------------------- |
| **Node**   | 24 LTS  | Use [nvm](https://github.com/nvm-sh/nvm). After cloning, `nvm install` reads `.nvmrc` for you |
| **pnpm**   | 11.x    | `corepack enable && corepack prepare pnpm@11 --activate`                                      |
| **Docker** | any 24+ | [Docker Desktop](https://www.docker.com/products/docker-desktop/)                             |
| **Git**    | any 2.x | Already on macOS; `brew install git` if you don't have it                                     |

> **Why pnpm, not npm or yarn?** This repo is a workspace monorepo. pnpm hard-links shared dependencies once on disk instead of duplicating them per workspace. `.npmrc` has `engine-strict=true`, so `pnpm install` refuses to run on the wrong Node major — if you see `ERR_PNPM_UNSUPPORTED_ENGINE`, run `nvm use`.

---

## First-time setup

From a fresh clone:

```bash
# 1. Switch to Node 24 (reads .nvmrc)
nvm install
nvm use

# 2. Install everything
pnpm install

# 3. Create your local env files (see "Env files" below)
cp .env.example apps/web/.env.local
cp .env.example apps/backend/.env.local

# 4. Generate a Payload secret and paste it into apps/backend/.env.local
openssl rand -base64 32

# 5. Boot Postgres + both runtimes
pnpm dev
```

After step 5:

- **Web** at <http://localhost:3000> — Next.js default page for now
- **Payload admin** at <http://localhost:3001/admin> — login screen; create the first admin user here

To stop: `Ctrl+C`, then `pnpm docker:down` to free the database container.

---

## Env files

Each app has its own `.env.local` (gitignored). The root `.env.example` documents every variable. Sensible local defaults:

**`apps/web/.env.local`**

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

**`apps/backend/.env.local`**

```env
DATABASE_URL=postgres://app:app@localhost:5434/app
PAYLOAD_SECRET=<paste output of `openssl rand -base64 32`>
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3001
```

> **Why `5434` instead of `5432`?** Most dev machines already run system Postgres on `5432`. The local compose remaps to a free port. Production (Railway) uses the standard port — this is local-only.

> **Where do I read env in code?** Never use `process.env.X` directly — ESLint blocks it. Each workspace has a `src/env.ts` that validates env at boot using [`@t3-oss/env-*`](https://env.t3.gg/). Import like `import { env } from './env'; env.DATABASE_URL`.

---

## Daily commands

| Command             | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`          | Boots Docker + both runtimes in parallel (Turbo TUI; press `h` for help)  |
| `pnpm docker:up`    | Just Postgres                                                             |
| `pnpm docker:down`  | Stop the container (data persists in a named volume)                      |
| `pnpm docker:reset` | Stop **and wipe** Postgres (you'll re-seed from scratch)                  |
| `pnpm typecheck`    | TypeScript across every workspace (cached by Turbo)                       |
| `pnpm lint`         | ESLint across every workspace                                             |
| `pnpm test`         | Vitest across every workspace                                             |
| `pnpm format`       | Prettier-format everything in place                                       |
| `pnpm format:check` | Verify everything's formatted (CI uses this)                             |
| `pnpm build`        | Production build of all apps                                              |
| `pnpm clean`        | Nuke `node_modules`, `.next`, `.turbo` — use when things get weird        |

### Running commands inside one workspace

```bash
pnpm --filter @app/web dev
pnpm --filter @app/backend generate:types
pnpm -C apps/backend payload migrate:create
```

---

## Git hooks (Lefthook)

Hooks install automatically on `pnpm install`.

- **Pre-commit** — Prettier-formats and ESLint-fixes whatever you staged, then re-stages.
- **Pre-push** — Runs `pnpm typecheck` + `pnpm lint` against the whole repo (Turbo-cached).

Use `git commit --no-verify` _sparingly_.

---

## How the codebase is organized

```
apps/web/               Customer-facing Next.js app (App Router + Turbopack)
  src/app/              Routes (App Router)
  src/env.ts            Zod-validated env — import from here, never process.env
  next.config.ts        Includes transpilePackages for workspace deps

apps/backend/           Payload v3 in Next.js (App Router)
  src/payload.config.ts Payload config (collections, db adapter, auth)
  src/collections/      Payload collection schemas (Users, Media)
  src/app/(payload)/    Payload admin UI + REST/GraphQL routes (generated)
  src/app/(frontend)/   Anything the backend needs to render itself

packages/               Shared TS libraries (source-only, no build step)
  api-contracts/        Zod schemas + types shared between web and backend
  ui/                   shared component library

tooling/                Shared configs as workspace packages
  typescript-config/    base / nextjs / react-library / node tsconfigs
  eslint-config/        Flat ESLint configs (base / nextjs / react)
  prettier-config/      Single quotes, semis, 100 col, Tailwind class sort
  tailwind-config/      OKLCH design tokens
  vitest-config/        Shared Vitest base + react variants
```

---

## Common gotchas

**`pnpm install` fails with `ERR_PNPM_UNSUPPORTED_ENGINE`**
Wrong Node version. Run `nvm use` (or `nvm install`). The repo pins Node 24 in `.nvmrc` and `engine-strict=true` in `.npmrc`.

**`pnpm docker:up` fails with `port is already allocated`**
Something else is on port `5434`. Find it with `lsof -nP -iTCP:5434 -sTCP:LISTEN` and stop it, or edit `docker-compose.yml` to pick another host port (and update your `.env.local`).

**Payload admin says `Cannot find module 'sharp'` or images don't process**
`pnpm install` skipped a build script. Run `pnpm rebuild sharp` and restart `pnpm dev`. The `allowBuilds` list in `pnpm-workspace.yaml` covers this for fresh clones.

**`pnpm dev` shows the Payload admin but the web app 404s on save**
Next.js dev sometimes loses workspace package symlinks after a long session. `pnpm clean && pnpm install && pnpm dev`.

---

## Where to learn more

- [`CLAUDE.md`](./CLAUDE.md) — conventions and hard rules (also read by AI agents)
- [`apps/web/CLAUDE.md`](./apps/web/CLAUDE.md) / [`apps/backend/CLAUDE.md`](./apps/backend/CLAUDE.md) — per-app conventions
- [Payload docs](https://payloadcms.com/docs) — the Payload skill lives at `.agents/skills/payload/`
- Next.js 16 ships its docs in `node_modules/next/dist/docs/` — searchable and version-matched
