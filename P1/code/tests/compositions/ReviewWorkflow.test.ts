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

/** An investigation by ari, submitted. */
async function submittedInvestigation(): Promise<string> {
  const investigating = app.concepts.InvestigatingChanges;
  const { investigation } = (await investigating.start({
    investigator: "ari",
    owner: "sophieelin",
    name: "PaperNet",
    commit: "6d4a4c6" + "b".repeat(33),
    title: "Organize the agents docs",
    currentStructure: structure,
    at: morning,
  })) as { investigation: string };
  await investigating.modify({
    investigation,
    investigator: "ari",
    title: "Organize the agents docs",
    operations: [{ kind: "move", from: "README.md", to: "GUIDE.md" }],
    rationale: "Reasons.",
    at: morning,
  });
  await investigating.submit({ investigation, investigator: "ari", at: morning });
  return investigation;
}

async function statusOf(investigation: string) {
  const [found] = await app.concepts.InvestigatingChanges._get({ investigation });
  return found?.status;
}

describe("ApprovalApprovesInvestigation", () => {
  test("approving the review approves its investigation, at the same instant", async () => {
    const proposal = await submittedInvestigation();
    const { review } = (await app.concepts.ReviewingDocumentation.open({ proposal, reviewer: "bo", at: morning })) as { review: string };

    expect(await app.concepts.ReviewingDocumentation.approve({ review, reviewer: "bo", at: noon })).toEqual({});
    const [found] = await app.concepts.InvestigatingChanges._get({ investigation: proposal });
    expect(found).toMatchObject({ status: "APPROVED", updatedAt: noon });
  });

  test("a refused approval leaves the investigation submitted", async () => {
    const proposal = await submittedInvestigation();
    const { review } = (await app.concepts.ReviewingDocumentation.open({ proposal, reviewer: "bo", at: morning })) as { review: string };

    expect(await app.concepts.ReviewingDocumentation.approve({ review, reviewer: "cy", at: noon })).toMatchObject({ error: "NOT_REVIEWER" });
    expect(await statusOf(proposal)).toBe("SUBMITTED");
  });

  test("when the investigation is no longer submitted, the review is still approved and the investigation keeps its status", async () => {
    const proposal = await submittedInvestigation();
    const { review } = (await app.concepts.ReviewingDocumentation.open({ proposal, reviewer: "bo", at: morning })) as { review: string };
    // Approved some other way first, so the reaction's approve is refused.
    await app.concepts.InvestigatingChanges.approve({ investigation: proposal, at: morning });

    expect(await app.concepts.ReviewingDocumentation.approve({ review, reviewer: "bo", at: noon })).toEqual({});
    expect(await app.concepts.ReviewingDocumentation._get({ review })).toMatchObject([{ decision: "APPROVED" }]);
    const [found] = await app.concepts.InvestigatingChanges._get({ investigation: proposal });
    expect(found).toMatchObject({ status: "APPROVED", updatedAt: morning });
  });
});
