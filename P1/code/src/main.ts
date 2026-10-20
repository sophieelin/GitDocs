import { assembleApplication } from "./assembly.ts";
import { closeDb, connectDb, db } from "./db.ts";
import { createHandler } from "./http.ts";

const port = Number(process.env.PORT ?? 3000);

// Fail now if MongoDB is unreachable, instead of on the first request.
await connectDb();

const handler = createHandler(assembleApplication({ db }));

// In production the backend also serves the built pages from web/dist. Paths that
// are not a file get index.html, so Vue Router can show the page on reload.
const dist = `${import.meta.dir}/../web/dist`;
const production = process.env.NODE_ENV === "production";

const server = Bun.serve({
  // The platform reaches the app from outside the machine; locally, stay private.
  hostname: production ? "0.0.0.0" : "127.0.0.1",
  port,
  routes: {
    "/health": async () => {
      await db.command({ ping: 1 });
      return Response.json({ status: "ok" });
    },
  },
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (!production || pathname === "/api" || pathname.startsWith("/api/")) return handler(request);
    const file = Bun.file(dist + pathname);
    return new Response((await file.exists()) ? file : Bun.file(`${dist}/index.html`));
  },
});
console.log(`GitDocs listening on http://${server.hostname}:${server.port}`);

async function shutdown(): Promise<void> {
  await server.stop();
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
