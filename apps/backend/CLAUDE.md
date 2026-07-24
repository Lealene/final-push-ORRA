# `@app/backend` — Claude Code instructions

Payload v3 admin + REST/GraphQL API mounted inside Next.js 16. Postgres adapter. Port 3001. Admin UI at `/admin`, REST at `/api/<slug>`, GraphQL at `/api/graphql`.

Root rules in `/CLAUDE.md` apply. This file carries Payload + backend specifics.

## Hard rules

- **Use the `payload` skill** for any work touching collections, fields, hooks, access control, transactions, or `payload.config.ts`. It's the source of truth for v3 patterns. Lives at `.agents/skills/payload/`.
- **Adapter is Postgres**, not Mongo. `@payloadcms/db-postgres` reads from `env.DATABASE_URL`. The stock Payload template ships Mongo by default; don't re-introduce it.
- **Env via `src/env.ts`.** `DATABASE_URL`, `PAYLOAD_SECRET`, `PAYLOAD_PUBLIC_SERVER_URL` are required. `payload.config.ts` reads `env.X`, never `process.env.X` directly.
- **Collections** live in `src/collections/*.ts` and are registered in `payload.config.ts`. Keep one collection per file.
- **Access control belongs on the collection**, not in route handlers. Use `access: { read, create, update, delete }` per collection — Payload enforces it across REST, GraphQL, and local API uniformly.
- **Hooks** (`beforeChange`, `afterRead`, etc.) go on the collection or field, not on app routes.
- **CSS side-effect imports** (`import '@payloadcms/next/css'`) are pre-declared in `src/types/css.d.ts` — don't remove that file; verbatimModuleSyntax rejects undeclared CSS imports.
- **Don't set `turbopack.root` in `next.config.ts`.** Auto-detection via root lockfile is correct; the override breaks resolution in this monorepo layout.

## Never edit

Payload regenerates these on `pnpm payload generate:types` / `generate:importmap`:

- `src/payload-types.ts`
- `src/payload-generated-schema.ts`
- `src/app/(payload)/admin/importMap.js`
- `next-env.d.ts`

## Layout

- `src/payload.config.ts` — root Payload config (collections, db adapter, editor, hooks).
- `src/collections/` — collection schemas (stock `Users` + `Media`; add your own here).
- `src/env.ts` — Zod-validated env (`@t3-oss/env-core`).
- `src/app/(payload)/` — Payload's own routes (admin UI + REST + GraphQL). Generated; don't hand-edit `importMap.js`.
- `src/app/(frontend)/` — backend's own SSR pages (currently the default Payload template page).
- `src/types/css.d.ts` — module declarations for Payload's CSS imports.
- `next.config.ts` — wrapped with `withPayload`; sets `transpilePackages` + image patterns.

## Workflow

- **Schema changes** → update the collection → run `pnpm generate:types` → commit the regenerated `payload-types.ts` alongside the schema change. Don't commit one without the other.
- **Migrations** → `pnpm payload migrate:create` to generate, `pnpm payload migrate` to apply. Payload manages Drizzle under the hood; don't author Drizzle migrations by hand.
- **Local DB reset** → `pnpm docker:reset` (from repo root) wipes Postgres and lets Payload re-sync on next boot.

## Skills worth knowing

- **`payload`** (highest priority) — full Payload v3 reference.
- **`ecc:postgres-patterns`** — query optimisation, indexing, schema design, EXPLAIN reading. Triggers on "Postgres" / "query" / "index".
- **`ecc:database-migrations`** — when working on Payload migrations + the Drizzle layer underneath.
- **`ecc:security-review`** — for access control, auth, webhook signature verification.

## Next.js 16.2 agent affordances

- **Bundled docs.** Read `node_modules/next/dist/docs/` for version-matched Next.js docs before writing code; combine with the `payload` skill for Payload-specific patterns.
- **Browser logs forward to the terminal.** `logging.browserToTerminal: true` in `next.config.ts` — admin UI console output appears in the dev terminal.
- **Dev server lock file** at `.next/dev/lock` (PID/port/URL). Read it before retrying `pnpm dev`.

## Gotchas

- **`Users` collection has `auth: true`.** Don't remove it — it backs admin login. End-user/customer accounts go on a separate collection, not on `Users`.
- **`Media` upload field requires `upload: true`** on the collection. The default uses local disk in dev; production needs S3 / R2 via a Payload upload adapter.
- **Don't import from `apps/web`.** Shared types go in `@app/api-contracts`.
- **`payload.logger`** is the canonical logger inside hooks / endpoints — not `console.log`. It carries the request context.
- **Transactions:** for multi-step writes that must atomically succeed/fail, use Payload's transaction API (`payload.db.beginTransaction()` / pass `req` through). The `payload` skill documents the exact shape.
