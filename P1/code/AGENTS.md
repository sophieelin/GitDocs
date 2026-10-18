# AGENTS.md

## Stack

Bun backend built with sync-engine (`@mit-sdg/sync-engine@1.1.0`) and its HTTP adapter (`@mit-sdg/sync-engine-http@1.1.0`, version must match exactly), serving every endpoint under `/api` on port 3000. Frontend is Vue 3 + Vite + TypeScript with vue-router, in `web/`, on port 5173; Vite proxies `/api` to the backend, so the browser sees one origin. Each concept stores its own state in MongoDB.

- `bun run generate` regenerates the pinned artifacts after changing concepts or the assembly.
- `bun run check` checks the application, the artifacts, and types, including the frontend (`check:web`, which runs `vue-tsc`).
- `bun run check:design` checks the design Markdown in `design/`.
- `bun run dev` starts MongoDB, then the backend (`dev:backend`) and the frontend (`dev:frontend`) with reload.
- `bun test` runs the tests against the local MongoDB; `bun run test:memory` runs them without a container. Tests that call real GitHub run only with `GITHUB_INTEGRATION=1`.

## Database

MongoDB is defined in `compose.yaml`. The connection string is in `.env` (template in `.env.example`).

- `bun run db:up` starts MongoDB.
- `bun run db:reset` deletes all local data. It is safe to run at any time.
- `bun run db:logs` shows MongoDB's output.
- `bun run db:shell` opens mongosh, logged in.
- Only use the local database. Never connect to a hosted one.
