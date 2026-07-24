# Claude Code instructions

@AGENTS.md

Monorepo: Next.js 16 web + Payload v3 backend. pnpm 11 workspaces, Turborepo 2.9, TypeScript 6 strict. See `package.json` for pinned versions; `README.md` for human onboarding.

## Hard rules

- **pnpm only.** `engine-strict=true`; npm/yarn invocations fail. Use `pnpm` for everything, `pnpm exec <bin>` for workspace binaries (never `pnpm dlx` in hooks — `dlx` fetches latest and breaks pinning).
- **Node 24.** Enforced via `.nvmrc` + `engines`. If you see `ERR_PNPM_UNSUPPORTED_ENGINE`, run `nvm use`.
- **Never read `process.env` directly.** ESLint blocks it outside each workspace's `src/env.ts`. Always `import { env } from './env'` — env is Zod-validated at boot via `@t3-oss/env-*`.
- **Workspace deps use `workspace:*`.** Internal packages reference each other via `"@app/foo": "workspace:*"`. No `npm publish` step.
- **TypeScript: `verbatimModuleSyntax` on.** Import CJS packages by their named export, not default import.
- **Payload uses Postgres**, not Mongo. The adapter is `@payloadcms/db-postgres`; do not regenerate from the stock template.
- **Local Postgres on `5434`.** Host port remap avoids clashing with system Postgres. Production (Railway) uses standard 5432.
- **No Conventional Commits.** Free-form commit messages.

## Never edit these files

Generators own them; your edits get overwritten on next run:

- `**/next-env.d.ts` (Next.js)
- `apps/backend/src/payload-types.ts`, `apps/backend/src/payload-generated-schema.ts`, `apps/backend/src/app/(payload)/admin/importMap.js` (Payload)
- `pnpm-lock.yaml` (pnpm)
- Any `.next/`, `.turbo/`, `dist/`, `coverage/`, `node_modules/`

To regenerate Payload types: `pnpm -C apps/backend generate:types`. To rebuild the import map: `pnpm -C apps/backend generate:importmap`.

## Commands

All from repo root. Scripts live in `package.json`; this list is just the entry points.

- `pnpm dev` — boots Docker (Postgres) then both runtimes in parallel via Turbo TUI.
- `pnpm docker:up` / `docker:down` / `docker:reset` — local infra lifecycle (reset wipes volumes).
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm format` / `pnpm format:check` — Turbo-cached across workspaces.
- `pnpm build` — production build (Next + dist).
- `pnpm clean` — nuke `node_modules`, `.next`, `.turbo`.
- `pnpm --filter @app/<workspace> <script>` — run one script in one workspace.
- `pnpm -C <path> <script>` — same, by path (useful for `pnpm -C apps/backend payload migrate:create`).

`pnpm test` uses `--passWithNoTests`; add tests per feature.

## Project structure

- `apps/web/` — customer Next.js app (App Router, Turbopack), port 3000. See `apps/web/CLAUDE.md`.
- `apps/backend/` — Payload v3 admin + API (Postgres adapter), port 3001. See `apps/backend/CLAUDE.md`.
- `packages/*` — shared TS libraries (source-only, no build step): `api-contracts`, `ui`. Apps consume them as source via Next's `transpilePackages` — no compile step between change and reload.
- `tooling/*` — shared configs as workspace packages: `typescript-config`, `eslint-config`, `prettier-config`, `tailwind-config`, `vitest-config`. Edit these to change rules globally.
- `docs/` — project docs (PRDs, decisions). Empty in the template; add your own.

## Skills

The harness has many skills; most auto-trigger from keywords (Payload, Postgres, Next.js, etc.). Two worth knowing by name:

- **`payload`** — collections, fields, hooks, access control, transactions for Payload v3. Lives at `.agents/skills/payload/` (symlinked into `.claude/skills/`). Use whenever touching `apps/backend/src/collections/**` or `payload.config.ts`.
- **`tdd`** — red-green-refactor enforcement for new features. Write the failing test first; then implement.

For everything else, write naturally — the harness auto-detects.

## Gotchas

- **`pnpm dlx` in hooks fetches the latest published version**, ignoring your lockfile. Use `pnpm exec` in `lefthook.yml` instead.
- **Payload's CSS side-effect imports** (`import '@payloadcms/next/css'`) fail `verbatimModuleSyntax` unless declared. See `apps/backend/src/types/css.d.ts`.
- **`baseUrl` is deprecated in TS 6.** Use `paths` without it.
- **Workspace `tsconfig.json` extends `@app/typescript-config/base.json`.** If VS Code reports "file not found", `Cmd+Shift+P → "TypeScript: Select TypeScript Version" → "Use Workspace Version"`. The bundled IDE TS is too old.
- **`create-payload-app` needs a TTY** that automated tools can't allocate. To re-scaffold the backend cleanly, use `pnpm dlx degit payloadcms/payload/templates/blank apps/backend` then re-apply our overrides.
- **Don't set `turbopack.root` in `apps/backend/next.config.ts`.** Auto-detection via the root `pnpm-lock.yaml` is correct; the explicit override misidentifies `src/app/` as the project root.

## Workflow

- **Branches:** short-lived feature branches off `main`. Squash-merge PRs.
- **Hooks:** Lefthook installs on `pnpm install`. Pre-commit prettier-formats + ESLint-fixes staged files. Pre-push runs `pnpm typecheck` + `pnpm lint` (Turbo-cached). `git commit --no-verify` is permitted but rare.
- **Tests:** Vitest. Write tests close to the code (`*.test.ts` next to source).
- **Reviews:** for non-trivial changes, ask for an `ecc:code-review` pass before merging.

## Updating this file

If your PR changes a convention (env shape, lint rule, port, command, never-edit list, skill recommendation), update CLAUDE.md in the **same PR**. Drift is the only failure mode for this file.

Rules of thumb when writing here:

- No version numbers — refer to `package.json` instead.
- No inline command bodies — refer to the script name and let `package.json` carry the implementation.
- No file-by-file listings — describe purposes; let the tree speak for itself.
- Imperative voice. Short bullets. No buzzwords ("leverage", "utilize", "robust").

Per-workspace `CLAUDE.md` files (`apps/*/CLAUDE.md`) load on demand when files in those directories enter context. Put workspace-specific rules there, not here.
