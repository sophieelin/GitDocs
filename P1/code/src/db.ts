import { MongoClient } from "mongodb";

const url = process.env.MONGODB_URL;
if (!url) {
  throw new Error("MONGODB_URL is not set. Add it to your .env file.");
}

// One client for the whole app. It keeps a pool of connections and reuses them,
// and the driver connects on the first query, so importing this file never blocks.
export const client = new MongoClient(url);
export const db = client.db();

/** Connects and pings, so the server fails at startup instead of on its first request. */
export async function connectDb(): Promise<void> {
  await client.connect();
  await db.command({ ping: 1 });
}

/** Closes every pooled connection. Call it when the server or a script shuts down. */
export async function closeDb(): Promise<void> {
  await client.close();
}
