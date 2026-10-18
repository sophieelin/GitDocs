# AGENTS.md

## Stack

Bun backend built with sync-engine (`@mit-sdg/sync-engine@1.1.0`) and its HTTP adapter (`@mit-sdg/sync-engine-http@1.1.0`, version must match exactly). Frontend is plain HTML, CSS, and TypeScript served by Bun. Each concept stores its own state in MongoDB.

- `bun run generate` regenerates the pinned artifacts after changing concepts or the assembly.
- `bun run check` checks the application, the artifacts, and types.
- `bun run check:design` checks the design Markdown in `design/`.
- `bun run dev` starts MongoDB, then the backend and frontend with reload.

## Database

MongoDB is defined in `compose.yaml`. The connection string is in `.env` (template in `.env.example`).

- `bun run db:up` starts MongoDB.
- `bun run db:reset` deletes all local data. It is safe to run at any time.
- `bun run db:logs` shows MongoDB's output.
- `bun run db:shell` opens mongosh, logged in.
- Only use the local database. Never connect to a hosted one.
