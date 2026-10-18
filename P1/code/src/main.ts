import { assembleApplication } from "./assembly.ts";
import { closeDb, connectDb, db } from "./db.ts";
import { createHandler } from "./http.ts";

const port = Number(process.env.PORT ?? 3000);

// Fail now if MongoDB is unreachable, instead of on the first request.
await connectDb();

const handler = createHandler(assembleApplication({ db }));
const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: handler });
console.log(`GitDocs backend listening on http://127.0.0.1:${server.port}/api`);

async function shutdown(): Promise<void> {
  await server.stop();
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
