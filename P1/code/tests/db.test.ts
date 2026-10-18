import { afterAll, beforeAll, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "./test-db.ts";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

afterAll(async () => {
  await testDb.close();
});

test("writes a document and reads it back", async () => {
  const notes = testDb.db.collection<{ _id: string; text: string }>("notes");
  await notes.insertOne({ _id: "n1", text: "hello" });

  expect(await notes.findOne({ _id: "n1" })).toEqual({ _id: "n1", text: "hello" });
});

test("each test file gets its own fresh database", () => {
  expect(testDb.db.databaseName).toMatch(/^test-/);
});
