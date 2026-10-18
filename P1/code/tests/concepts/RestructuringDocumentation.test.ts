import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  InvalidProposalSource,
  InvalidProposalTitle,
  InvalidStructure,
  NotDraft,
  NotProposalAuthor,
  ProposalNotFound,
  RestructuringDocumentationConcept,
} from "../../src/concepts/RestructuringDocumentation.ts";
import type { DocumentationFolder } from "../../src/github/documentationTree.ts";
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

/** Hands out the given proposal ids in order. */
function ids(...values: string[]) {
  return () => values.shift() ?? "exhausted";
}

const paperNet = { owner: "sophieelin", name: "PaperNet" };
const c6d4a4c6 = "6d4a4c6" + "b".repeat(33);
const morning = new Date("2026-10-18T09:00:00.000Z");
const noon = new Date("2026-10-18T12:00:00.000Z");

const agentsReadme = { name: "README.md", path: "csail_hack/lib/agents/README.md" };

/** PaperNet's documentation at the commit: one README deep in `csail_hack/lib/agents/`. */
const current: DocumentationFolder = {
  name: "",
  path: "",
  files: [{ name: "README.md", path: "README.md" }],
  folders: [
    {
      name: "csail_hack",
      path: "csail_hack",
      files: [],
      folders: [{ name: "lib", path: "csail_hack/lib", files: [], folders: [{ name: "agents", path: "csail_hack/lib/agents", files: [agentsReadme], folders: [] }] }],
    },
  ],
};

/** The same documentation with the agents README moved to the root. */
const moved: DocumentationFolder = {
  name: "",
  path: "",
  files: [{ name: "README.md", path: "README.md" }, agentsReadme],
  folders: [],
};

const valid = { ...paperNet, investigation: "inv-1", commit: c6d4a4c6, title: "Organize the agents docs", currentStructure: current };

function newConcept(freshID = ids("p-1")) {
  return new RestructuringDocumentationConcept(testDb.db, freshID);
}

describe("RestructuringDocumentation", () => {
  test("create starts a draft whose proposal is the current structure", async () => {
    const proposals = newConcept();

    expect(await proposals.create({ author: "ari", ...valid, at: morning })).toEqual({ restructuring: "p-1" });
    expect(await proposals._get({ restructuring: "p-1" })).toEqual([
      {
        restructuring: "p-1",
        author: "ari",
        investigation: "inv-1",
        ...paperNet,
        commit: c6d4a4c6,
        title: "Organize the agents docs",
        rationale: "",
        status: "DRAFT",
        currentStructure: current,
        proposedStructure: current,
        createdAt: morning,
        updatedAt: morning,
      },
    ]);
  });

  test("modify changes the draft and leaves the current structure as it was", async () => {
    const proposals = newConcept();
    await proposals.create({ author: "ari", ...valid, at: morning });

    expect(
      await proposals.modify({
        restructuring: "p-1",
        author: "ari",
        title: "  Agents docs at the root  ",
        proposedStructure: moved,
        rationale: "  One place to look.  ",
        at: noon,
      }),
    ).toEqual({});

    const [saved] = await proposals._get({ restructuring: "p-1" });
    expect(saved).toMatchObject({
      title: "Agents docs at the root",
      rationale: "One place to look.",
      status: "DRAFT",
      currentStructure: current,
      proposedStructure: moved,
      createdAt: morning,
      updatedAt: noon,
    });
  });

  test("stores only a structure's known fields", async () => {
    const proposals = newConcept();
    const extra = { ...current, size: 12, files: [{ ...current.files[0], sha: "abc" }] } as DocumentationFolder;
    await proposals.create({ author: "ari", ...valid, currentStructure: extra, at: morning });

    const [saved] = await proposals._get({ restructuring: "p-1" });
    expect(saved?.currentStructure).toEqual(current);
  });

  test("the commit is stored in lowercase", async () => {
    const proposals = newConcept();
    await proposals.create({ author: "ari", ...valid, commit: c6d4a4c6.toUpperCase(), at: morning });

    expect((await proposals._get({ restructuring: "p-1" }))[0]?.commit).toBe(c6d4a4c6);
  });

  test("create refuses each invalid part, and records nothing", async () => {
    const proposals = newConcept();
    const cases: [Record<string, unknown>, new (message: string) => Error][] = [
      [{ owner: "" }, InvalidProposalSource],
      [{ name: " " }, InvalidProposalSource],
      [{ commit: "6d4a4c6" }, InvalidProposalSource],
      [{ title: "  " }, InvalidProposalTitle],
      [{ title: "x".repeat(121) }, InvalidProposalTitle],
      [{ currentStructure: null }, InvalidStructure],
      [{ currentStructure: { name: "", path: "", files: [] } }, InvalidStructure],
      [{ currentStructure: { ...current, files: [{ name: "README.md" }] } }, InvalidStructure],
      [{ currentStructure: { ...current, folders: ["docs"] } }, InvalidStructure],
    ];
    for (const [change, refusal] of cases) {
      await expect(proposals.create({ author: "ari", ...valid, ...change, at: morning } as never)).rejects.toThrow(refusal);
    }
    expect(await testDb.db.collection("RestructuringDocumentation.restructurings").countDocuments()).toBe(0);
  });

  test("modify refuses a missing proposal, another author, and an invalid draft", async () => {
    const proposals = newConcept();
    await proposals.create({ author: "ari", ...valid, at: morning });
    const draft = { restructuring: "p-1", author: "ari", title: "Organize the agents docs", proposedStructure: moved, rationale: "", at: noon };

    await expect(proposals.modify({ ...draft, restructuring: "missing" })).rejects.toThrow(ProposalNotFound);
    await expect(proposals.modify({ ...draft, author: "bob" })).rejects.toThrow(NotProposalAuthor);
    await expect(proposals.modify({ ...draft, title: "" })).rejects.toThrow(InvalidProposalTitle);
    await expect(proposals.modify({ ...draft, proposedStructure: { name: "" } as never })).rejects.toThrow(InvalidStructure);

    const [saved] = await proposals._get({ restructuring: "p-1" });
    expect(saved).toMatchObject({ proposedStructure: current, updatedAt: morning });
  });

  test("modify refuses a proposal that is no longer a draft", async () => {
    const proposals = newConcept();
    await proposals.create({ author: "ari", ...valid, at: morning });
    // Set directly until submit exists (plan step 5.4).
    await testDb.db
      .collection("RestructuringDocumentation.restructurings")
      .updateOne({ _id: "p-1" as never }, { $set: { status: "PENDING_APPROVAL" } });

    await expect(
      proposals.modify({ restructuring: "p-1", author: "ari", title: "Again", proposedStructure: moved, rationale: "", at: noon }),
    ).rejects.toThrow(NotDraft);
  });

  test("an unknown proposal answers no rows", async () => {
    expect(await newConcept()._get({ restructuring: "missing" })).toEqual([]);
  });
});
