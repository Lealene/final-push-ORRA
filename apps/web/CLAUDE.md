# `@app/web` — Claude Code instructions

Customer-facing Next.js 16 app. App Router + Turbopack + React 19 + Tailwind 4. Port 3000. Talks to the Payload backend at `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:3001`).

Root rules in `/CLAUDE.md` apply. This file carries only web-specific conventions.

## Hard rules

- **App Router default.** No Pages Router. New routes go in `src/app/<segment>/page.tsx` (and `layout.tsx`, `loading.tsx`, `error.tsx` as needed).
- **Server Components by default.** Add `'use client'` only when you need browser APIs, state, or event handlers.
- **Env via `src/env.ts`.** Server vars in `server: {…}`, client-exposed vars must start with `NEXT_PUBLIC_` and live in `client: {…}`. Never read `process.env` directly.
- **Workspace deps are source-only.** Import from `@app/<pkg>`; Next transpiles via `transpilePackages` in `next.config.ts`. Don't pre-build packages.
- **Tailwind 4 CSS-first.** Theme tokens live in `@app/tailwind-config/theme.css` (placeholders until M3). No `tailwind.config.js`; use `@theme` blocks in CSS.
- **Path alias `@/*` → `./src/*`** (set in `tsconfig.json` paths; no `baseUrl`).

## Layout

- `src/app/` — routes (App Router).
- `src/env.ts` — Zod-validated env (uses `@t3-oss/env-nextjs`).
- `src/app/globals.css` — imports `tailwindcss` + `@app/tailwind-config/theme.css`. Add app-wide styles here.
- `next.config.ts` — `transpilePackages` for workspace deps; nothing else exotic.
- `next-env.d.ts` — generated, never edit.

## Skills worth knowing

- **`ecc:nextjs-turbopack`** — App Router + Turbopack patterns, hydration safety, route rules. Triggers on "Next.js" / "App Router" / "RSC".
- **`ecc:frontend-patterns`** — component structure, state management, client/server split.
- **`ecc:seo`** — when working on metadata, sitemap, structured data.

## Gotchas

- **Server Component data fetching** uses `fetch()` with Next's cache semantics. Use `cache: 'no-store'` for personalised data; default cache for static content.
- **Prefer streaming via Suspense** over blocking data flows for content-heavy pages.
- **Don't import from `apps/backend`.** Backend types belong in `@app/api-contracts` (shared). Importing across apps breaks the layering.

## Next.js 16.2 agent affordances

- **Bundled docs.** Read `node_modules/next/dist/docs/` for version-matched Next.js docs before writing code. Your training data is older than what's installed.
- **Browser logs forward to the terminal.** `logging.browserToTerminal: true` in `next.config.ts` — all client-side console output appears in the dev terminal. Check it before opening DevTools.
- **Dev server lock file** at `.next/dev/lock` carries PID/port/URL. If `pnpm dev` fails with "another dev server is running", read the lock file (or the printed error) to find the PID and kill it instead of guessing.
