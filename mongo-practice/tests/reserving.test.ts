import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { Reserving } from "../src/reserving.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

let testDb: TestDb;
let reserving: Reserving;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  reserving = new Reserving(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

test("a table can only be reserved once", async () => {
  await reserving.reserve("barish", "table-4");
  await expect(reserving.reserve("eagon", "table-4")).rejects.toThrow("table-4 is already reserved");
});

test("when two people reserve at the same moment, only one gets the table", async () => {
  const results = await Promise.allSettled([
    reserving.reserve("barish", "table-4"),
    reserving.reserve("eagon", "table-4"),
  ]);
  const succeeded = results.filter((result) => result.status === "fulfilled");
  expect(succeeded).toHaveLength(1);
});

test("a reservation can only be claimed once", async () => {
  const id = await reserving.reserve("barish", "table-4");
  await reserving.claim(id);
  await expect(reserving.claim(id)).rejects.toThrow("No unclaimed reservation");
});

test("a claimed reservation can't be cancelled", async () => {
  const id = await reserving.reserve("barish", "table-4");
  await reserving.claim(id);
  await expect(reserving.cancel(id)).rejects.toThrow("No unclaimed reservation");
});

test("cancelling frees the table for someone else", async () => {
  const id = await reserving.reserve("barish", "table-4");
  await reserving.cancel(id);
  await expect(reserving.reserve("carmel", "table-4")).resolves.toBeString();
});
