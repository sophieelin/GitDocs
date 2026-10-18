import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { InvalidCommit, InvalidRepository, InvestigatingChangesConcept } from "../../src/concepts/InvestigatingChanges.ts";
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
const c6d4a4c6 = "6d4a4c6" + "b".repeat(33);
const morning = new Date("2026-10-18T09:00:00.000Z");
const noon = new Date("2026-10-18T12:00:00.000Z");

describe("InvestigatingChanges", () => {
  test("its principle: one shared investigation per commit, newest first", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db, ids("inv-1", "inv-2", "unused"));

    expect(await investigating.open({ investigator: "ari", ...paperNet, commit: d8ab205, at: morning })).toEqual({
      investigation: "inv-1",
    });
    // The same commit again, by Ari or by Bo, is the same investigation.
    expect(await investigating.open({ investigator: "ari", ...paperNet, commit: d8ab205, at: noon })).toEqual({
      investigation: "inv-1",
    });
    expect(await investigating.open({ investigator: "bob", ...paperNet, commit: d8ab205, at: noon })).toEqual({
      investigation: "inv-1",
    });
    expect(await investigating._get({ investigation: "inv-1" })).toEqual([
      { investigation: "inv-1", ...paperNet, commit: d8ab205, investigator: "ari", openedAt: morning },
    ]);

    await investigating.open({ investigator: "bob", ...paperNet, commit: c6d4a4c6, at: noon });
    expect(await investigating._forRepository(paperNet)).toEqual([
      { investigation: "inv-2", commit: c6d4a4c6, investigator: "bob", openedAt: noon },
      { investigation: "inv-1", commit: d8ab205, investigator: "ari", openedAt: morning },
    ]);
  });

  test("another repository's list does not include them", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db, ids("inv-1"));
    await investigating.open({ investigator: "ari", ...paperNet, commit: d8ab205, at: morning });

    expect(await investigating._forRepository({ owner: "octocat", name: "Hello-World" })).toEqual([]);
  });

  test("the repository and commit are compared without regard to letter case", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db, ids("inv-1", "unused"));
    await investigating.open({ investigator: "ari", ...paperNet, commit: d8ab205, at: morning });

    expect(
      await investigating.open({ investigator: "bob", owner: "SophieeLin", name: "papernet", commit: d8ab205.toUpperCase(), at: noon }),
    ).toEqual({ investigation: "inv-1" });
    expect((await investigating._forRepository({ owner: "SOPHIEELIN", name: "PAPERNET" })).length).toBe(1);
  });

  test("refuses an empty owner or name", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db);

    await expect(investigating.open({ investigator: "ari", owner: "", name: "PaperNet", commit: d8ab205, at: morning })).rejects.toThrow(
      InvalidRepository,
    );
    await expect(investigating.open({ investigator: "ari", owner: "sophieelin", name: " ", commit: d8ab205, at: morning })).rejects.toThrow(
      "A repository needs an owner and a name.",
    );
  });

  test("refuses anything but a full commit SHA, and stores nothing", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db);

    for (const commit of ["d8ab205", "not-a-sha", "g".repeat(40), ""]) {
      await expect(investigating.open({ investigator: "ari", ...paperNet, commit, at: morning })).rejects.toThrow(InvalidCommit);
    }
    expect(await investigating._forRepository(paperNet)).toEqual([]);
  });

  test("an unknown investigation answers no row", async () => {
    expect(await new InvestigatingChangesConcept(testDb.db)._get({ investigation: "missing" })).toEqual([]);
  });

  test("two people opening the same commit at once get one investigation", async () => {
    const investigating = new InvestigatingChangesConcept(testDb.db, ids("inv-1", "inv-2"));
    const [a, b] = await Promise.all([
      investigating.open({ investigator: "ari", ...paperNet, commit: d8ab205, at: morning }),
      investigating.open({ investigator: "bob", ...paperNet, commit: d8ab205, at: morning }),
    ]);

    expect(a).toEqual(b);
    expect((await investigating._forRepository(paperNet)).length).toBe(1);
  });
});
