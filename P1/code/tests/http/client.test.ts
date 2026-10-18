import { afterAll, beforeAll, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

afterAll(async () => {
  await testDb.close();
});

test("an unknown endpoint answers 404 NOT_FOUND", async () => {
  const api = testApi(testDb.db);

  expect(await api.post("/no-such-endpoint")).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
});
