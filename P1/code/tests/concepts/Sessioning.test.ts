import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SessioningConcept, UnknownSession } from "../../src/concepts/Sessioning.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
});

afterAll(async () => {
  await testDb.close();
});

/** Hands out the given session ids in order. */
function ids(...values: string[]) {
  return () => values.shift() ?? "exhausted";
}

describe("Sessioning", () => {
  test("its principle: start, resolve, and end an opaque session", async () => {
    const sessioning = new SessioningConcept(testDb.db, () => new Date("2099-07-20T12:00:00.000Z"), ids("session-1"));

    expect(await sessioning.start({ subject: "ari" })).toEqual({
      session: "session-1",
      expiresAt: new Date("2099-07-20T12:30:00.000Z"),
    });
    expect(await sessioning.current({ session: "session-1" })).toEqual({ subject: "ari" });
    expect(await sessioning._active({ session: "session-1" })).toEqual([
      { subject: "ari", expiresAt: new Date("2099-07-20T12:30:00.000Z") },
    ]);
    expect(await sessioning.end({ session: "session-1" })).toEqual({ ended: true });
    expect(await sessioning._active({ session: "session-1" })).toEqual([]);
    await expect(sessioning.current({ session: "session-1" })).rejects.toThrow(UnknownSession);
    await expect(sessioning.current({ session: "invented" })).rejects.toThrow("This session is not active.");
  });

  test("an expired session is omitted by the query and removed by an action", async () => {
    let now = new Date("2099-07-20T12:00:00.000Z");
    const sessioning = new SessioningConcept(testDb.db, () => now, ids("session-1"));
    await sessioning.start({ subject: "ari" });

    now = new Date("2099-07-20T12:30:00.000Z");
    expect(await sessioning._active({ session: "session-1" })).toEqual([]);
    await expect(sessioning.current({ session: "session-1" })).rejects.toThrow(UnknownSession);
    await expect(sessioning.end({ session: "session-1" })).rejects.toThrow(UnknownSession);
    expect(await testDb.db.collection("Sessioning.sessions").countDocuments()).toBe(0);
  });

  test("starting another session removes every expired one", async () => {
    let now = new Date("2099-07-20T12:00:00.000Z");
    const sessioning = new SessioningConcept(testDb.db, () => now, ids("session-1", "session-2"));
    await sessioning.start({ subject: "ari" });

    now = new Date("2099-07-20T12:31:00.000Z");
    await sessioning.start({ subject: "bo" });

    const stored = await testDb.db.collection("Sessioning.sessions").find().toArray();
    expect(stored.map((s) => s._id)).toEqual(["session-2"]);
  });

  test("ending the same session twice at once succeeds only once", async () => {
    const sessioning = new SessioningConcept(testDb.db, () => new Date("2099-07-20T12:00:00.000Z"), ids("session-1"));
    await sessioning.start({ subject: "ari" });

    const results = await Promise.allSettled([
      sessioning.end({ session: "session-1" }),
      sessioning.end({ session: "session-1" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  test("sessions survive a new concept instance, as after a server restart", async () => {
    const clock = () => new Date("2099-07-20T12:00:00.000Z");
    await new SessioningConcept(testDb.db, clock, ids("session-1")).start({ subject: "ari" });

    expect(await new SessioningConcept(testDb.db, clock).current({ session: "session-1" })).toEqual({ subject: "ari" });
  });
});
