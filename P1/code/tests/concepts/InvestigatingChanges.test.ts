import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  InvalidAffectedDocumentation,
  InvalidCommit,
  InvalidEvidence,
  InvalidRepository,
  InvalidTitle,
  InvestigatingChangesConcept,
} from "../../src/concepts/InvestigatingChanges.ts";
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

/** Hands out the given investigation ids in order. */
function ids(...values: string[]) {
  return () => values.shift() ?? "exhausted";
}

const paperNet = { owner: "sophieelin", name: "PaperNet" };
const d8ab205 = "d8ab205" + "a".repeat(33);
const morning = new Date("2026-10-18T09:00:00.000Z");
const noon = new Date("2026-10-18T12:00:00.000Z");

const valid = {
  ...paperNet,
  commit: d8ab205,
  title: "Agents moved under lib/",
  affected: [{ path: "csail_hack/README.md", reason: "Still describes the old layout." }],
  evidence: ["lib/agents/ gained its own README in this commit"],
};

describe("InvestigatingChanges", () => {
  test("its principle: submit, read back, and list many per commit, newest first", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db, ids("inv-1", "inv-2"));

    expect(await investigating.submit({ investigator: "ari", ...valid, at: morning })).toEqual({ investigation: "inv-1" });
    expect(await investigating._get({ investigation: "inv-1" })).toEqual([
      { investigation: "inv-1", ...paperNet, commit: d8ab205, investigator: "ari", title: "Agents moved under lib/", submittedAt: morning },
    ]);
    expect(await investigating._affected({ investigation: "inv-1" })).toEqual(valid.affected);
    expect(await investigating._evidence({ investigation: "inv-1" })).toEqual([{ text: valid.evidence[0] }]);

    await investigating.submit({ investigator: "bob", ...valid, title: "A second reading", at: noon });
    expect(await investigating._forCommit({ ...paperNet, commit: d8ab205 })).toEqual([
      { investigation: "inv-2", investigator: "bob", title: "A second reading", submittedAt: noon },
      { investigation: "inv-1", investigator: "ari", title: "Agents moved under lib/", submittedAt: morning },
    ]);
    expect((await investigating._forRepository(paperNet)).map((i) => i.investigation)).toEqual(["inv-2", "inv-1"]);
  });

  test("another repository's lists do not include them", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db, ids("inv-1"));
    await investigating.submit({ investigator: "ari", ...valid, at: morning });

    expect(await investigating._forRepository({ owner: "octocat", name: "Hello-World" })).toEqual([]);
    expect(await investigating._forCommit({ owner: "octocat", name: "Hello-World", commit: d8ab205 })).toEqual([]);
  });

  test("the repository and commit are compared without regard to letter case", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db, ids("inv-1"));
    await investigating.submit({ investigator: "ari", ...valid, owner: "SophieeLin", commit: d8ab205.toUpperCase(), at: morning });

    expect((await investigating._forCommit({ owner: "sophieelin", name: "papernet", commit: d8ab205 })).length).toBe(1);
  });

  test("keeps affected documentation and evidence in the order given, trimmed", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db, ids("inv-1"));
    await investigating.submit({
      investigator: "ari",
      ...valid,
      affected: [
        { path: "b.md", reason: "  second  " },
        { path: "a.md", reason: "first" },
      ],
      evidence: ["one", "  two  ", "https://github.com/sophieelin/PaperNet/pull/1"],
      at: morning,
    });

    expect(await investigating._affected({ investigation: "inv-1" })).toEqual([
      { path: "b.md", reason: "second" },
      { path: "a.md", reason: "first" },
    ]);
    expect((await investigating._evidence({ investigation: "inv-1" })).map((e) => e.text)).toEqual([
      "one",
      "two",
      "https://github.com/sophieelin/PaperNet/pull/1",
    ]);
  });

  test("refuses each invalid part, and records nothing", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db);
    const cases: [Partial<typeof valid>, new (message: string) => Error][] = [
      [{ owner: "" }, InvalidRepository],
      [{ commit: "d8ab205" }, InvalidCommit],
      [{ title: "  " }, InvalidTitle],
      [{ title: "x".repeat(121) }, InvalidTitle],
      [{ affected: [] }, InvalidAffectedDocumentation],
      [{ affected: [{ path: "a.md", reason: "" }] }, InvalidAffectedDocumentation],
      [{ affected: [{ path: "", reason: "why" }] }, InvalidAffectedDocumentation],
      [
        {
          affected: [
            { path: "a.md", reason: "one" },
            { path: "a.md", reason: "two" },
          ],
        },
        InvalidAffectedDocumentation,
      ],
      [{ evidence: [] }, InvalidEvidence],
      [{ evidence: ["fine", " "] }, InvalidEvidence],
    ];
    for (const [change, refusal] of cases) {
      await expect(investigating.submit({ investigator: "ari", ...valid, ...change, at: morning })).rejects.toThrow(refusal);
    }
    expect(await investigating._forRepository(paperNet)).toEqual([]);
  });

  test("an unknown investigation answers no rows", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db);

    expect(await investigating._get({ investigation: "missing" })).toEqual([]);
    expect(await investigating._affected({ investigation: "missing" })).toEqual([]);
    expect(await investigating._evidence({ investigation: "missing" })).toEqual([]);
  });

  test("an investigation saved by the earlier open action reads as untitled", async () => {
    await testDb.db.collection("InvestigatingChanges.investigations").insertOne({
      _id: "old-1" as never,
      owner: "sophieelin",
      name: "PaperNet",
      repository: "sophieelin/papernet",
      commit: d8ab205,
      investigator: "ari",
      openedAt: morning,
    });
    const investigating = new InvestigatingChangesConcept(testDb.db);

    expect(await investigating._get({ investigation: "old-1" })).toEqual([
      { investigation: "old-1", ...paperNet, commit: d8ab205, investigator: "ari", title: "Untitled investigation", submittedAt: morning },
    ]);
    expect(await investigating._affected({ investigation: "old-1" })).toEqual([]);
  });
});
