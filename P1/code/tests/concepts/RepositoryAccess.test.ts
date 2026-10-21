import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { InvalidRepository, NoPushAccess, RepositoryAccessConcept } from "../../src/concepts/RepositoryAccess.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let access: RepositoryAccessConcept;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  access = new RepositoryAccessConcept(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

const noon = new Date("2026-10-20T12:00:00Z");
const minutes = (count: number) => new Date(noon.getTime() + count * 60_000);
const paperNet = { owner: "sophieelin", name: "PaperNet" };

describe("RepositoryAccess", () => {
  test("its principle: a recorded push grant authorizes that user for that repository for 30 minutes", async () => {
    await expect(access.authorize({ user: "ari", ...paperNet, at: noon })).rejects.toThrow(NoPushAccess);

    await access.record({ user: "ari", ...paperNet, canPush: true, at: noon });
    expect(await access.authorize({ user: "ari", ...paperNet, at: minutes(29) })).toEqual({});
    // Owner and name match without regard to case, as on GitHub.
    expect(await access._canPush({ user: "ari", owner: "SophieELin", name: "papernet", at: noon })).toEqual({ canPush: true });

    await expect(access.authorize({ user: "bob", ...paperNet, at: noon })).rejects.toThrow(NoPushAccess);
    await expect(access.authorize({ user: "ari", owner: "sophieelin", name: "Other", at: noon })).rejects.toThrow(NoPushAccess);
    await expect(access.authorize({ user: "ari", ...paperNet, at: minutes(30) })).rejects.toThrow(NoPushAccess);
  });

  test("a newer answer replaces the older one", async () => {
    await access.record({ user: "ari", ...paperNet, canPush: true, at: noon });
    await access.record({ user: "ari", ...paperNet, canPush: false, at: minutes(1) });

    expect(await access._canPush({ user: "ari", ...paperNet, at: minutes(2) })).toEqual({ canPush: false });
    await access.record({ user: "ari", ...paperNet, canPush: true, at: minutes(40) });
    expect(await access._canPush({ user: "ari", ...paperNet, at: minutes(60) })).toEqual({ canPush: true });
    expect(await testDb.db.collection("RepositoryAccess.grants").countDocuments()).toBe(1);
  });

  test("record refuses a repository with no owner or name", async () => {
    await expect(access.record({ user: "ari", owner: "", name: "PaperNet", canPush: true, at: noon })).rejects.toThrow(InvalidRepository);
    await expect(access.record({ user: "ari", owner: "sophieelin", name: " ", canPush: true, at: noon })).rejects.toThrow(InvalidRepository);
    expect(await testDb.db.collection("RepositoryAccess.grants").countDocuments()).toBe(0);
  });

  test("a recorded refusal does not authorize, and a refused authorize records nothing", async () => {
    await access.record({ user: "ari", ...paperNet, canPush: false, at: noon });

    await expect(access.authorize({ user: "ari", ...paperNet, at: noon })).rejects.toThrow(NoPushAccess);
    await expect(access.authorize({ user: "bob", ...paperNet, at: noon })).rejects.toThrow(NoPushAccess);
    expect(await access._canPush({ user: "ari", ...paperNet, at: noon })).toEqual({ canPush: false });
    expect(await testDb.db.collection("RepositoryAccess.grants").countDocuments()).toBe(1);
  });

  test("grants for different users of one repository are separate", async () => {
    await access.record({ user: "ari", ...paperNet, canPush: true, at: noon });
    await access.record({ user: "bob", ...paperNet, canPush: false, at: noon });

    expect(await access.authorize({ user: "ari", ...paperNet, at: noon })).toEqual({});
    await expect(access.authorize({ user: "bob", ...paperNet, at: noon })).rejects.toThrow(NoPushAccess);
  });
});
