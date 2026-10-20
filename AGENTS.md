# AGENTS.md

## History

Record every decision and every step you take in `history.md` at the repository root (next to this file). Do not create history files anywhere else.

- Add a new entry each time you do something, and do it as you work, not only at the end.
- Start each entry with the date (YYYY-MM-DD) and a short title.
- For each step, say what you did and which files you changed.
- For each decision, say what you chose, which other options you considered, and why.
- Only add new entries. Never edit or delete old ones.

## Database

This project uses MongoDB, defined in `mongo-practice/compose.yaml`. The connection string is in `mongo-practice/.env`. Run these commands from `mongo-practice/`.

- `bun run db:up` starts MongoDB and waits until it accepts connections.
- `bun run db:check` checks that the app can connect.
- `bun run db:reset` deletes all local data and starts fresh. It is safe to run at any time.
- `bun run db:logs` shows MongoDB's output.
- `bun run test` runs the tests against the local MongoDB. Run `bun run db:up` first.
- `bun run test:memory` runs the tests with a temporary MongoDB and needs no container.
- Only use the local database. Never connect to a hosted one.
