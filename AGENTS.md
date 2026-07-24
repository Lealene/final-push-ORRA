<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

## App additions

This repo has two Next.js apps (`apps/web` and `apps/backend`), both on Next 16.2. The bundled docs above cover both.

- App-specific conventions live in `apps/web/CLAUDE.md` and `apps/backend/CLAUDE.md`.
- Cross-cutting conventions live in the root `CLAUDE.md`.
- Browser console output is forwarded to the terminal in dev (see `next.config.ts` `logging.browserToTerminal`) — check the dev server output before opening a browser.
- A dev server lock file at `.next/dev/lock` carries the PID/port/URL of the active server. Read it before attempting `next dev` if you suspect one is already running.
