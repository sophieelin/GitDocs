/**
 * The review workflow's reaction, against the assembled application: concept
 * actions are called directly, so no session or endpoint is involved.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { assembleApplication } from "../../src/assembly.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let app: ReturnType<typeof assembleApplication>;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  app = assembleApplication({ db: testDb.db });
});

afterAll(async () => {
  await testDb.close();
});

const morning = new Date("2026-10-18T09:00:00.000Z");
const noon = new Date("2026-10-18T12:00:00.000Z");
const structure = { name: "", path: "", files: [{ name: "README.md", path: "README.md" }], folders: [] };

/** A proposal by ari, submitted and pending approval. */
async function pendingProposal(): Promise<string> {
  const proposals = app.concepts.RestructuringDocumentation;
  const { restructuring } = (await proposals.create({
    author: "ari",
    investigation: "i-1",
    owner: "sophieelin",
    name: "PaperNet",
    commit: "6d4a4c6" + "b".repeat(33),
    title: "Organize the agents docs",
    currentStructure: structure,
    at: morning,
  })) as { restructuring: string };
  await proposals.modify({ restructuring, author: "ari", title: "Organize the agents docs", proposedStructure: structure, rationale: "Reasons.", at: morning });
  await proposals.submit({ restructuring, author: "ari", at: morning });
  return restructuring;
}

async function statusOf(proposal: string) {
  const [found] = await app.concepts.RestructuringDocumentation._get({ restructuring: proposal });
  return found?.status;
}

describe("ApprovalApprovesProposal", () => {
  test("approving the review approves its proposal, at the same instant", async () => {
    const proposal = await pendingProposal();
    const { review } = (await app.concepts.ReviewingDocumentation.open({ proposal, reviewer: "bo", at: morning })) as { review: string };

    expect(await app.concepts.ReviewingDocumentation.approve({ review, reviewer: "bo", at: noon })).toEqual({});
    const [found] = await app.concepts.RestructuringDocumentation._get({ restructuring: proposal });
    expect(found).toMatchObject({ status: "APPROVED", updatedAt: noon });
  });

  test("a refused approval leaves the proposal unchanged", async () => {
    const proposal = await pendingProposal();
    const { review } = (await app.concepts.ReviewingDocumentation.open({ proposal, reviewer: "bo", at: morning })) as { review: string };

    expect(await app.concepts.ReviewingDocumentation.approve({ review, reviewer: "cy", at: noon })).toMatchObject({ error: "NOT_REVIEWER" });
    expect(await statusOf(proposal)).toBe("PENDING_APPROVAL");
  });

  test("when the proposal is no longer pending, the review is still approved and the proposal keeps its status", async () => {
    const proposal = await pendingProposal();
    const { review } = (await app.concepts.ReviewingDocumentation.open({ proposal, reviewer: "bo", at: morning })) as { review: string };
    // Approved some other way first, so the reaction's approve is refused.
    await app.concepts.RestructuringDocumentation.approve({ restructuring: proposal, at: morning });

    expect(await app.concepts.ReviewingDocumentation.approve({ review, reviewer: "bo", at: noon })).toEqual({});
    expect(await app.concepts.ReviewingDocumentation._get({ review })).toMatchObject([{ decision: "APPROVED" }]);
    const [found] = await app.concepts.RestructuringDocumentation._get({ restructuring: proposal });
    expect(found).toMatchObject({ status: "APPROVED", updatedAt: morning });
  });
});
