import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  HighlightNotFound,
  InvalidCommit,
  InvalidHighlight,
  InvalidOperations,
  InvalidRepository,
  InvalidStructure,
  InvalidTitle,
  InvestigatingChangesConcept,
  InvestigationNotFound,
  InvestigationNotPending,
  NoChanges,
  NotApproved,
  NotDraft,
  NotInvestigator,
  RationaleMissing,
  SuggestionsOverlap,
} from "../../src/concepts/InvestigatingChanges.ts";
import type { DocumentationFolder } from "../../src/github/documentationTree.ts";
import { applyOperations, gitCommands, type Operation } from "../../src/github/structureOperations.ts";
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

/** Hands out the given ids in order. */
function ids(...values: string[]) {
  return () => values.shift() ?? "exhausted";
}

const paperNet = { owner: "sophieelin", name: "PaperNet" };
const c6d4a4c6 = "6d4a4c6" + "b".repeat(33);
const applied = "e1f2a3b" + "c".repeat(33);
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

/** Moves the agents README to the root. */
const operations: Operation[] = [{ kind: "move", from: agentsReadme.path, to: "AGENTS.md" }];

function proposedFrom(tree: DocumentationFolder, changes: Operation[]): DocumentationFolder {
  const result = applyOperations(tree, changes);
  if ("error" in result) throw new Error(result.error);
  return result.tree;
}

const valid = { ...paperNet, commit: c6d4a4c6, title: "Organize the agents docs", currentStructure: current };

/** What a highlight that is only a comment adds. */
const comment = { kind: "COMMENT" as const, replacement: "" };

function newConcept(freshID = ids("i-1")) {
  return new InvestigatingChangesConcept(testDb.db, freshID);
}

/** Investigation `investigation`'s draft, as `investigator` saves it. */
function draftOf(investigation: string, investigator = "ari") {
  return { investigation, investigator, title: valid.title, operations, rationale: "One place to look." };
}

/** Starts an investigation by `investigator` and submits it with a change and a rationale at `at`. */
async function submitted(investigating: InvestigatingChangesConcept, investigator: string, at: Date, fields: Partial<typeof valid> = {}) {
  const { investigation } = await investigating.start({ investigator, ...valid, ...fields, at });
  await investigating.modify({ ...draftOf(investigation, investigator), title: fields.title ?? valid.title, at });
  await investigating.submit({ investigation, investigator, at });
  return investigation;
}

describe("InvestigatingChanges", () => {
  test("start begins a draft with no changes, whose proposed structure is the current one", async () => {
    const investigating = newConcept();

    expect(await investigating.start({ investigator: "ari", ...valid, at: morning })).toEqual({ investigation: "i-1" });
    expect(await investigating._get({ investigation: "i-1" })).toEqual([
      {
        investigation: "i-1",
        investigator: "ari",
        ...paperNet,
        commit: c6d4a4c6,
        title: "Organize the agents docs",
        rationale: "",
        status: "DRAFT",
        appliedCommit: "",
        currentStructure: current,
        operations: [],
        proposedStructure: current,
        createdAt: morning,
        updatedAt: morning,
      },
    ]);
    expect(await investigating._highlights({ investigation: "i-1" })).toEqual([]);
  });

  test("stores only a structure's known fields, and the commit in lowercase", async () => {
    const investigating = newConcept();
    const extra = { ...current, size: 12, files: [{ ...current.files[0], sha: "abc" }] } as DocumentationFolder;
    await investigating.start({ investigator: "ari", ...valid, commit: c6d4a4c6.toUpperCase(), currentStructure: extra, at: morning });

    const [saved] = await investigating._get({ investigation: "i-1" });
    expect(saved).toMatchObject({ commit: c6d4a4c6, currentStructure: current });
  });

  test("start refuses each invalid part, and records nothing", async () => {
    const investigating = newConcept();
    const cases: [Record<string, unknown>, new (message: string) => Error][] = [
      [{ owner: "" }, InvalidRepository],
      [{ name: " " }, InvalidRepository],
      [{ commit: "6d4a4c6" }, InvalidCommit],
      [{ title: "  " }, InvalidTitle],
      [{ title: "x".repeat(121) }, InvalidTitle],
      [{ currentStructure: null }, InvalidStructure],
      [{ currentStructure: { name: "", path: "", files: [] } }, InvalidStructure],
      [{ currentStructure: { ...current, files: [{ name: "README.md" }] } }, InvalidStructure],
      [{ currentStructure: { ...current, folders: ["docs"] } }, InvalidStructure],
    ];
    for (const [change, refusal] of cases) {
      await expect(investigating.start({ investigator: "ari", ...valid, ...change, at: morning } as never)).rejects.toThrow(refusal);
    }
    expect(await testDb.db.collection("InvestigatingChanges.investigations").countDocuments()).toBe(0);
  });

  test("modify saves the changes and works out the proposed structure from them", async () => {
    const investigating = newConcept();
    await investigating.start({ investigator: "ari", ...valid, at: morning });

    expect(
      await investigating.modify({ ...draftOf("i-1"), title: "  Agents docs at the root  ", rationale: "  One place to look.  ", at: noon }),
    ).toEqual({});

    const [saved] = await investigating._get({ investigation: "i-1" });
    expect(saved).toMatchObject({
      title: "Agents docs at the root",
      rationale: "One place to look.",
      status: "DRAFT",
      currentStructure: current,
      operations,
      proposedStructure: proposedFrom(current, operations),
      createdAt: morning,
      updatedAt: noon,
    });
  });

  test("modify refuses a missing investigation, another investigator, and an invalid draft, and changes nothing", async () => {
    const investigating = newConcept();
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    const draft = { ...draftOf("i-1"), at: noon };

    await expect(investigating.modify({ ...draft, investigation: "missing" })).rejects.toThrow(InvestigationNotFound);
    await expect(investigating.modify({ ...draft, investigator: "bob" })).rejects.toThrow(NotInvestigator);
    await expect(investigating.modify({ ...draft, title: "" })).rejects.toThrow(InvalidTitle);
    await expect(investigating.modify({ ...draft, operations: [{ kind: "move", from: "nowhere.md", to: "here.md" }] })).rejects.toThrow(
      InvalidOperations,
    );
    await expect(investigating.modify({ ...draft, operations: [{ kind: "explode" }] as never })).rejects.toThrow(InvalidOperations);

    const [saved] = await investigating._get({ investigation: "i-1" });
    expect(saved).toMatchObject({ operations: [], proposedStructure: current, updatedAt: morning });
  });

  test("highlights are kept in the order added, and one can be removed", async () => {
    const investigating = newConcept(ids("i-1", "h-1", "h-2"));
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    const first = { path: agentsReadme.path, from: 2, to: 3, start: 4, end: 11, text: "  Moved under lib/.  ", ...comment };
    const second = { path: "README.md", from: 1, to: 1, start: 0, end: 5, text: "Stale", kind: "SUGGESTION" as const, replacement: "Fresh\n" };

    expect(await investigating.highlight({ investigation: "i-1", investigator: "ari", ...first, at: noon })).toEqual({ highlight: "h-1" });
    await investigating.highlight({ investigation: "i-1", investigator: "ari", ...second, at: noon });

    expect(await investigating._highlights({ investigation: "i-1" })).toEqual([
      { highlight: "h-1", ...first, text: "Moved under lib/." },
      { highlight: "h-2", ...second },
    ]);
    expect((await investigating._get({ investigation: "i-1" }))[0]?.updatedAt).toEqual(noon);

    expect(await investigating.unhighlight({ investigation: "i-1", investigator: "ari", highlight: "h-1", at: noon })).toEqual({});
    expect((await investigating._highlights({ investigation: "i-1" })).map(({ highlight }) => highlight)).toEqual(["h-2"]);
    await expect(investigating.unhighlight({ investigation: "i-1", investigator: "ari", highlight: "h-1", at: noon })).rejects.toThrow(
      HighlightNotFound,
    );
  });

  test("highlight refuses a highlight with no comment or no valid range, another investigator, and a submitted investigation", async () => {
    const investigating = newConcept(ids("i-1", "h-1"));
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    const highlight = { investigation: "i-1", investigator: "ari", path: "README.md", from: 2, to: 3, start: 4, end: 11, text: "Why", ...comment, at: noon };

    for (const change of [
      { text: " " },
      { path: "" },
      { from: 0 },
      { from: 4, to: 3 },
      { to: 2.5 },
      { start: -1 },
      { from: 3, to: 3, start: 6, end: 6 },
      { from: 3, to: 3, start: 6, end: 6, kind: "SUGGESTION", replacement: "" },
      { from: 3, to: 3, start: 7, end: 6, kind: "SUGGESTION", replacement: "new" },
      { kind: "EDIT" },
      { replacement: "A comment replaces nothing." },
      { kind: "SUGGESTION", replacement: "x".repeat(20_001) },
      { kind: "SUGGESTION", replacement: null },
    ]) {
      await expect(investigating.highlight({ ...highlight, ...change } as never)).rejects.toThrow(InvalidHighlight);
    }
    await expect(investigating.highlight({ ...highlight, investigator: "bob" })).rejects.toThrow(NotInvestigator);
    await expect(investigating.highlight({ ...highlight, investigation: "missing" })).rejects.toThrow(InvestigationNotFound);
    expect(await investigating._highlights({ investigation: "i-1" })).toEqual([]);

    await investigating.highlight(highlight);
    await investigating.modify({ ...draftOf("i-1"), at: noon });
    await investigating.submit({ investigation: "i-1", investigator: "ari", at: noon });
    await expect(investigating.highlight(highlight)).rejects.toThrow(NotDraft);
    await expect(investigating.unhighlight({ investigation: "i-1", investigator: "ari", highlight: "h-1", at: noon })).rejects.toThrow(NotDraft);
  });

  test("its principle: plan changes, submit with a rationale, and the investigation is fixed", async () => {
    const investigating = newConcept();
    await investigating.start({ investigator: "ari", ...valid, at: morning });

    await expect(investigating.submit({ investigation: "i-1", investigator: "ari", at: noon })).rejects.toThrow(NoChanges);
    await investigating.modify({ ...draftOf("i-1"), rationale: "", at: morning });
    await expect(investigating.submit({ investigation: "i-1", investigator: "ari", at: noon })).rejects.toThrow(RationaleMissing);
    await investigating.modify({ ...draftOf("i-1"), at: morning });
    await expect(investigating.submit({ investigation: "i-1", investigator: "bob", at: noon })).rejects.toThrow(NotInvestigator);

    expect(await investigating.submit({ investigation: "i-1", investigator: "ari", at: noon })).toEqual({});
    const [submittedOne] = await investigating._get({ investigation: "i-1" });
    expect(submittedOne).toMatchObject({ status: "SUBMITTED", rationale: "One place to look.", operations, updatedAt: noon });

    await expect(investigating.submit({ investigation: "i-1", investigator: "ari", at: noon })).rejects.toThrow(NotDraft);
    await expect(investigating.modify({ ...draftOf("i-1"), title: "Again", at: noon })).rejects.toThrow(NotDraft);
    await expect(investigating.discard({ investigation: "i-1", investigator: "ari" })).rejects.toThrow(NotDraft);
    expect(await investigating._get({ investigation: "i-1" })).toEqual([submittedOne!]);
  });

  test("its principle, end to end: highlight, plan, submit, approve, then apply with the commit that made the changes", async () => {
    const investigating = newConcept(ids("i-1", "h-1"));
    expect(await investigating.start({ investigator: "ari", ...valid, at: morning })).toEqual({ investigation: "i-1" });

    const passage = { path: agentsReadme.path, from: 1, to: 1, start: 0, end: 9, text: "Buried three folders deep.", ...comment };
    expect(await investigating.highlight({ investigation: "i-1", investigator: "ari", ...passage, at: morning })).toEqual({ highlight: "h-1" });
    await investigating.modify({ ...draftOf("i-1"), at: morning });
    await investigating.submit({ investigation: "i-1", investigator: "ari", at: morning });
    await investigating.approve({ investigation: "i-1", at: noon });

    // Once approved, it gives the git commands that make its changes.
    expect(await investigating._commands({ investigation: "i-1" })).toEqual(gitCommands(current, operations).map((command) => ({ command })));
    expect(await investigating.apply({ investigation: "i-1", investigator: "ari", commit: applied, at: noon })).toEqual({});

    expect((await investigating._get({ investigation: "i-1" }))[0]).toMatchObject({
      status: "APPLIED",
      appliedCommit: applied,
      operations,
      proposedStructure: proposedFrom(current, operations),
    });
    expect(await investigating._highlights({ investigation: "i-1" })).toEqual([{ highlight: "h-1", ...passage }]);
    await expect(investigating.approve({ investigation: "i-1", at: noon })).rejects.toThrow(InvestigationNotPending);
  });

  test("modifying again replaces the earlier changes rather than adding to them", async () => {
    const investigating = newConcept();
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    await investigating.modify({ ...draftOf("i-1"), operations: [{ kind: "move", from: "README.md", to: "OVERVIEW.md" }], at: morning });
    await investigating.modify({ ...draftOf("i-1"), operations, at: noon });
    expect((await investigating._get({ investigation: "i-1" }))[0]).toMatchObject({ operations, updatedAt: noon });

    // Taking every change back leaves the current structure as the proposal.
    await investigating.modify({ ...draftOf("i-1"), operations: [], at: noon });
    expect((await investigating._get({ investigation: "i-1" }))[0]).toMatchObject({ operations: [], proposedStructure: current });
    await expect(investigating.submit({ investigation: "i-1", investigator: "ari", at: noon })).rejects.toThrow(NoChanges);
    expect((await investigating._get({ investigation: "i-1" }))[0]?.status).toBe("DRAFT");
  });

  test("unhighlight refuses another investigator and a missing investigation, and keeps the highlight", async () => {
    const investigating = newConcept(ids("i-1", "h-1"));
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    await investigating.highlight({ investigation: "i-1", investigator: "ari", path: "README.md", from: 1, to: 1, start: 0, end: 5, text: "Why", ...comment, at: morning });
    const before = await investigating._get({ investigation: "i-1" });

    await expect(investigating.unhighlight({ investigation: "i-1", investigator: "bob", highlight: "h-1", at: noon })).rejects.toThrow(NotInvestigator);
    await expect(investigating.unhighlight({ investigation: "missing", investigator: "ari", highlight: "h-1", at: noon })).rejects.toThrow(
      InvestigationNotFound,
    );
    await expect(investigating.unhighlight({ investigation: "i-1", investigator: "ari", highlight: "h-9", at: noon })).rejects.toThrow(
      HighlightNotFound,
    );

    expect((await investigating._highlights({ investigation: "i-1" })).map(({ highlight }) => highlight)).toEqual(["h-1"]);
    expect(await investigating._get({ investigation: "i-1" })).toEqual(before);
  });

  test("a submitted investigation cannot be discarded, and is still there", async () => {
    const investigating = newConcept();
    await submitted(investigating, "ari", morning);

    await expect(investigating.discard({ investigation: "i-1", investigator: "ari" })).rejects.toThrow(NotDraft);
    expect((await investigating._get({ investigation: "i-1" }))[0]).toMatchObject({ status: "SUBMITTED" });
  });

  test("a refused apply records no commit and leaves the investigation approved", async () => {
    const investigating = newConcept();
    await submitted(investigating, "ari", morning);
    await investigating.approve({ investigation: "i-1", at: morning });
    const before = await investigating._get({ investigation: "i-1" });

    await expect(investigating.apply({ investigation: "i-1", investigator: "bob", commit: applied, at: noon })).rejects.toThrow(NotInvestigator);
    await expect(investigating.apply({ investigation: "i-1", investigator: "ari", commit: "not-a-sha", at: noon })).rejects.toThrow(InvalidCommit);

    expect(await investigating._get({ investigation: "i-1" })).toEqual(before);
    expect(before[0]).toMatchObject({ status: "APPROVED", appliedCommit: "" });
  });

  test("submit takes a suggestion as the only change, but not a comment", async () => {
    const investigating = newConcept(ids("i-1", "h-1", "h-2"));
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    await investigating.modify({ ...draftOf("i-1"), operations: [], at: morning });
    const on = { investigation: "i-1", investigator: "ari", path: "README.md", from: 1, to: 1, start: 0, end: 5, text: "Out of date.", at: noon };

    await investigating.highlight({ ...on, ...comment });
    await expect(investigating.submit({ investigation: "i-1", investigator: "ari", at: noon })).rejects.toThrow(NoChanges);

    await investigating.highlight({ ...on, kind: "SUGGESTION", replacement: "" });
    expect(await investigating.submit({ investigation: "i-1", investigator: "ari", at: noon })).toEqual({});
    expect((await investigating._get({ investigation: "i-1" }))[0]).toMatchObject({ status: "SUBMITTED", operations: [] });
  });

  test("suggestions in one file may touch but not overlap; comments may overlap anything", async () => {
    const investigating = newConcept(ids("i-1", "h-1", "h-2", "h-3", "h-4", "h-5"));
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    const suggest = (range: { path?: string; from: number; to: number; start: number; end: number }) =>
      investigating.highlight({
        investigation: "i-1",
        investigator: "ari",
        path: "README.md",
        ...range,
        text: "Why",
        kind: "SUGGESTION",
        replacement: "new",
        at: noon,
      });

    await suggest({ from: 2, to: 3, start: 4, end: 2 });
    for (const range of [
      { from: 2, to: 2, start: 5, end: 6 },
      { from: 1, to: 2, start: 0, end: 5 },
      { from: 3, to: 4, start: 1, end: 0 },
      { from: 1, to: 5, start: 0, end: 0 },
    ]) {
      await expect(suggest(range)).rejects.toThrow(SuggestionsOverlap);
    }
    // Ending where the first starts, starting where it ends, or in another file is fine.
    await suggest({ from: 1, to: 2, start: 0, end: 4 });
    await suggest({ from: 3, to: 3, start: 2, end: 9 });
    await suggest({ path: "AGENTS.md", from: 2, to: 3, start: 4, end: 2 });
    await investigating.highlight({ investigation: "i-1", investigator: "ari", path: "README.md", from: 2, to: 3, start: 0, end: 9, text: "Also", ...comment, at: noon });
    expect((await investigating._highlights({ investigation: "i-1" })).map(({ highlight }) => highlight)).toEqual(["h-1", "h-2", "h-3", "h-4", "h-5"]);
  });

  test("a suggestion may put new text in at a point, but not twice at the same point", async () => {
    const investigating = newConcept(ids("i-1", "h-1", "h-2", "h-3", "h-4"));
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    const suggest = (range: { from: number; to: number; start: number; end: number }) =>
      investigating.highlight({ investigation: "i-1", investigator: "ari", path: "README.md", ...range, text: "Why", kind: "SUGGESTION", replacement: "new", at: noon });

    await suggest({ from: 2, to: 2, start: 3, end: 3 });
    await expect(suggest({ from: 2, to: 2, start: 3, end: 3 })).rejects.toThrow(SuggestionsOverlap);
    // Inside another suggestion overlaps it; at its edge or elsewhere is fine.
    await suggest({ from: 1, to: 1, start: 0, end: 4 });
    await expect(suggest({ from: 1, to: 1, start: 2, end: 2 })).rejects.toThrow(SuggestionsOverlap);
    await suggest({ from: 1, to: 1, start: 4, end: 4 });
    await suggest({ from: 2, to: 2, start: 4, end: 4 });
    expect(await investigating._highlights({ investigation: "i-1" })).toHaveLength(4);
  });

  test("two overlapping suggestions at once: one is saved and the other is refused", async () => {
    const investigating = newConcept(ids("i-1", "h-1", "h-2", "h-3"));
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    const suggestion = { investigation: "i-1", investigator: "ari", path: "README.md", from: 1, to: 1, start: 0, end: 5, text: "Why", kind: "SUGGESTION" as const, at: noon };

    const results = await Promise.allSettled([
      investigating.highlight({ ...suggestion, replacement: "one" }),
      investigating.highlight({ ...suggestion, replacement: "two" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(SuggestionsOverlap);
    expect(await investigating._highlights({ investigation: "i-1" })).toHaveLength(1);
  });

  test("a highlight saved before suggestions existed reads as a comment", async () => {
    const investigating = newConcept();
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    const old = { highlight: "h-0", path: "README.md", from: 1, to: 1, start: 0, end: 5, text: "Old" };
    await testDb.db.collection("InvestigatingChanges.investigations").updateOne({ _id: "i-1" as never }, { $push: { highlights: old } as never });

    expect(await investigating._highlights({ investigation: "i-1" })).toEqual([{ ...old, ...comment }]);
  });

  test("two submits at once: one succeeds and the other is refused", async () => {
    const investigating = newConcept();
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    await investigating.modify({ ...draftOf("i-1"), at: morning });

    const results = await Promise.allSettled([
      investigating.submit({ investigation: "i-1", investigator: "ari", at: noon }),
      investigating.submit({ investigation: "i-1", investigator: "ari", at: noon }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(NotDraft);
  });

  test("discard removes the investigator's draft and its highlights, and only that", async () => {
    const investigating = newConcept(ids("i-1", "i-2", "h-1"));
    await investigating.start({ investigator: "ari", ...valid, at: morning });
    await investigating.start({ investigator: "ari", ...valid, title: "Another idea", at: morning });
    await investigating.highlight({ investigation: "i-1", investigator: "ari", path: "README.md", from: 1, to: 1, start: 0, end: 5, text: "Why", ...comment, at: noon });

    await expect(investigating.discard({ investigation: "i-1", investigator: "bob" })).rejects.toThrow(NotInvestigator);
    await expect(investigating.discard({ investigation: "missing", investigator: "ari" })).rejects.toThrow(InvestigationNotFound);
    expect(await investigating.discard({ investigation: "i-1", investigator: "ari" })).toEqual({});

    expect(await investigating._get({ investigation: "i-1" })).toEqual([]);
    expect(await investigating._highlights({ investigation: "i-1" })).toEqual([]);
    expect((await investigating._get({ investigation: "i-2" })).length).toBe(1);
    await expect(investigating.discard({ investigation: "i-1", investigator: "ari" })).rejects.toThrow(InvestigationNotFound);
  });

  test("approve approves a submitted investigation, once, and refuses a draft or a missing one", async () => {
    const investigating = newConcept(ids("i-1", "i-2"));
    await submitted(investigating, "ari", morning);
    await investigating.start({ investigator: "ari", ...valid, at: morning });

    expect(await investigating.approve({ investigation: "i-1", at: noon })).toEqual({});
    expect((await investigating._get({ investigation: "i-1" }))[0]).toMatchObject({ status: "APPROVED", updatedAt: noon });
    await expect(investigating.approve({ investigation: "i-1", at: noon })).rejects.toThrow(InvestigationNotPending);

    await expect(investigating.approve({ investigation: "i-2", at: noon })).rejects.toThrow(InvestigationNotPending);
    expect((await investigating._get({ investigation: "i-2" }))[0]).toMatchObject({ status: "DRAFT", updatedAt: morning });
    await expect(investigating.approve({ investigation: "missing", at: noon })).rejects.toThrow(InvestigationNotFound);
  });

  test("two approvals at once: one succeeds and the other is refused", async () => {
    const investigating = newConcept();
    await submitted(investigating, "ari", morning);

    const results = await Promise.allSettled([
      investigating.approve({ investigation: "i-1", at: noon }),
      investigating.approve({ investigation: "i-1", at: noon }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(InvestigationNotPending);
  });

  test("apply records the commit of an approved investigation, once, and only for its investigator", async () => {
    const investigating = newConcept();
    await submitted(investigating, "ari", morning);
    const apply = { investigation: "i-1", investigator: "ari", commit: applied.toUpperCase(), at: noon };

    await expect(investigating.apply(apply)).rejects.toThrow(NotApproved);
    await investigating.approve({ investigation: "i-1", at: morning });
    await expect(investigating.apply({ ...apply, investigator: "bob" })).rejects.toThrow(NotInvestigator);
    await expect(investigating.apply({ ...apply, commit: "e1f2a3b" })).rejects.toThrow(InvalidCommit);
    await expect(investigating.apply({ ...apply, investigation: "missing" })).rejects.toThrow(InvestigationNotFound);

    expect(await investigating.apply(apply)).toEqual({});
    expect((await investigating._get({ investigation: "i-1" }))[0]).toMatchObject({ status: "APPLIED", appliedCommit: applied, updatedAt: noon });
    await expect(investigating.apply(apply)).rejects.toThrow(NotApproved);
  });

  test("_commands answers the git commands for the investigation's changes", async () => {
    const investigating = newConcept(ids("i-1", "i-2"));
    await submitted(investigating, "ari", morning);
    await investigating.start({ investigator: "ari", ...valid, at: morning });

    expect(await investigating._commands({ investigation: "i-1" })).toEqual(gitCommands(current, operations).map((command) => ({ command })));
    expect((await investigating._commands({ investigation: "i-1" })).length).toBeGreaterThan(0);
    expect(await investigating._commands({ investigation: "i-2" })).toEqual([]);
    expect(await investigating._commands({ investigation: "missing" })).toEqual([]);
  });

  test("an unknown investigation answers no rows", async () => {
    const investigating = newConcept();
    expect(await investigating._get({ investigation: "missing" })).toEqual([]);
    expect(await investigating._highlights({ investigation: "missing" })).toEqual([]);
  });

  test("_forRepository and _forCommit list investigations, the most recently changed first, ignoring letter case", async () => {
    const investigating = newConcept(ids("i-1", "i-2", "i-3", "i-4"));
    const other = "d8ab205" + "a".repeat(33);
    await submitted(investigating, "ari", noon);
    await investigating.start({ investigator: "bob", ...valid, title: "Another idea", at: morning });
    await investigating.start({ investigator: "ari", ...valid, owner: "octocat", name: "Hello-World", at: morning });
    await investigating.start({ investigator: "ari", ...valid, commit: other, title: "Another commit", at: morning });

    expect(await investigating._forRepository({ owner: "SophieeLin", name: "papernet" })).toEqual([
      { investigation: "i-1", investigator: "ari", commit: c6d4a4c6, title: "Organize the agents docs", status: "SUBMITTED", updatedAt: noon },
      { investigation: "i-2", investigator: "bob", commit: c6d4a4c6, title: "Another idea", status: "DRAFT", updatedAt: morning },
      { investigation: "i-4", investigator: "ari", commit: other, title: "Another commit", status: "DRAFT", updatedAt: morning },
    ]);
    expect(await investigating._forCommit({ ...paperNet, commit: c6d4a4c6.toUpperCase() })).toEqual([
      { investigation: "i-1", investigator: "ari", title: "Organize the agents docs", status: "SUBMITTED", updatedAt: noon },
      { investigation: "i-2", investigator: "bob", title: "Another idea", status: "DRAFT", updatedAt: morning },
    ]);
    expect(await investigating._forRepository({ owner: "nobody", name: "nothing" })).toEqual([]);
  });
});
