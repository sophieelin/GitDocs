import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  NotReviewer,
  ReviewExists,
  ReviewingDocumentationConcept,
  ReviewNotFound,
  ReviewNotPending,
} from "../../src/concepts/ReviewingDocumentation.ts";
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

/** Hands out the given review ids in order. */
function ids(...values: string[]) {
  return () => values.shift() ?? "exhausted";
}

const morning = new Date("2026-10-18T09:00:00.000Z");
const noon = new Date("2026-10-18T12:00:00.000Z");

function newConcept(freshID = ids("r-1", "r-2")) {
  return new ReviewingDocumentationConcept(testDb.db, freshID);
}

describe("ReviewingDocumentation", () => {
  test("its principle: Bo opens the one review of p-1 and approves it, and Cy can do neither", async () => {
    const reviews = newConcept();
    expect(await reviews.open({ proposal: "p-1", reviewer: "bo", at: morning })).toEqual({ review: "r-1" });
    const opened = { review: "r-1", proposal: "p-1", reviewer: "bo", decision: "PENDING", openedAt: morning, updatedAt: morning };
    expect(await reviews._get({ review: "r-1" })).toEqual([opened]);
    expect(await reviews._forProposal({ proposal: "p-1" })).toEqual([
      { review: "r-1", reviewer: "bo", decision: "PENDING", openedAt: morning, updatedAt: morning },
    ]);

    await expect(reviews.open({ proposal: "p-1", reviewer: "cy", at: noon })).rejects.toThrow(ReviewExists);
    await expect(reviews.approve({ review: "r-1", reviewer: "cy", at: noon })).rejects.toThrow(NotReviewer);
    expect(await reviews._get({ review: "r-1" })).toEqual([opened]);

    expect(await reviews.approve({ review: "r-1", reviewer: "bo", at: noon })).toEqual({});
    expect(await reviews._get({ review: "r-1" })).toEqual([{ ...opened, decision: "APPROVED", updatedAt: noon }]);
    await expect(reviews.approve({ review: "r-1", reviewer: "bo", at: noon })).rejects.toThrow(ReviewNotPending);
  });

  test("opening twice, even by the same reviewer, keeps only the first review", async () => {
    const reviews = newConcept();
    await reviews.open({ proposal: "p-1", reviewer: "bo", at: morning });
    await expect(reviews.open({ proposal: "p-1", reviewer: "bo", at: noon })).rejects.toThrow(ReviewExists);
    expect(await reviews._get({ review: "r-2" })).toEqual([]);
    expect((await reviews._forProposal({ proposal: "p-1" }))[0]).toMatchObject({ review: "r-1", openedAt: morning });
  });

  test("two opens at once: one succeeds and the other is refused", async () => {
    const reviews = newConcept();
    const results = await Promise.allSettled([
      reviews.open({ proposal: "p-1", reviewer: "bo", at: morning }),
      reviews.open({ proposal: "p-1", reviewer: "cy", at: morning }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(ReviewExists);
  });

  test("a second concept instance still refuses a second review", async () => {
    await newConcept().open({ proposal: "p-1", reviewer: "bo", at: morning });
    await expect(newConcept(ids("r-9")).open({ proposal: "p-1", reviewer: "cy", at: noon })).rejects.toThrow(ReviewExists);
  });

  test("reviews of different proposals are separate", async () => {
    const reviews = newConcept();
    await reviews.open({ proposal: "p-1", reviewer: "bo", at: morning });
    expect(await reviews.open({ proposal: "p-2", reviewer: "bo", at: morning })).toEqual({ review: "r-2" });
    await reviews.approve({ review: "r-1", reviewer: "bo", at: noon });
    expect((await reviews._get({ review: "r-2" }))[0]).toMatchObject({ proposal: "p-2", decision: "PENDING" });
  });

  test("approve refuses a missing review, and creates none", async () => {
    const reviews = newConcept();
    await expect(reviews.approve({ review: "missing", reviewer: "bo", at: noon })).rejects.toThrow(ReviewNotFound);
    expect(await reviews._get({ review: "missing" })).toEqual([]);
    expect(await testDb.db.collection("ReviewingDocumentation.reviews").countDocuments()).toBe(0);
  });

  test("a refused second open leaves exactly the first review", async () => {
    const reviews = newConcept();
    await reviews.open({ proposal: "p-1", reviewer: "bo", at: morning });
    await expect(reviews.open({ proposal: "p-1", reviewer: "cy", at: noon })).rejects.toThrow(ReviewExists);

    expect(await testDb.db.collection("ReviewingDocumentation.reviews").countDocuments()).toBe(1);
    expect(await reviews._forProposal({ proposal: "p-1" })).toEqual([
      { review: "r-1", reviewer: "bo", decision: "PENDING", openedAt: morning, updatedAt: morning },
    ]);
  });

  test("two approvals at once: one succeeds and the other is refused", async () => {
    const reviews = newConcept();
    await reviews.open({ proposal: "p-1", reviewer: "bo", at: morning });
    const results = await Promise.allSettled([
      reviews.approve({ review: "r-1", reviewer: "bo", at: noon }),
      reviews.approve({ review: "r-1", reviewer: "bo", at: noon }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(ReviewNotPending);
  });

  test("an unknown review and a proposal with no review answer no rows", async () => {
    const reviews = newConcept();
    expect(await reviews._get({ review: "missing" })).toEqual([]);
    expect(await reviews._forProposal({ proposal: "p-1" })).toEqual([]);
  });
});
