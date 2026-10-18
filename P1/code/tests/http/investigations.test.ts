import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

let testDb: TestDb;
let api: ReturnType<typeof testApi>;
let ari: string;
let bob: string;

// Example inputs for these tests only.
const paperNet = { owner: "sophieelin", name: "PaperNet" };
const firstCommit = "d8ab205" + "a".repeat(33);
const secondCommit = "6d4a4c6" + "b".repeat(33);

const sampleSubmission = {
  ...paperNet,
  commit: firstCommit,
  title: "Agents moved under lib/",
  highlights: [{ path: "csail_hack/README.md", from: 12, to: 18, comment: "Still describes the old layout." }],
};

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  api = testApi(testDb.db);
  ari = await api.register("ari");
  bob = await api.register("bob");
});

afterAll(async () => {
  await testDb.close();
});

function submit(session: string, changes: Partial<typeof sampleSubmission> = {}) {
  return api.post("/investigations/submit", { session, ...sampleSubmission, ...changes });
}

type Summary = { investigation: string; title: string; investigator: string; commit?: string };

describe("/investigations/submit", () => {
  test("records the investigation, with the signed-in user as investigator", async () => {
    const submitted = await submit(ari);
    expect(submitted.status).toBe(200);
    const id = submitted.body.investigation as string;

    const { status, body } = await api.post("/investigations/get", { session: ari, investigation: id });
    expect(status).toBe(200);
    expect(body.investigation).toMatchObject({
      investigation: id,
      ...paperNet,
      commit: firstCommit,
      investigator: "ari",
      title: sampleSubmission.title,
      highlights: sampleSubmission.highlights,
    });
    const submittedAt = new Date((body.investigation as { submittedAt: string }).submittedAt).getTime();
    expect(Math.abs(submittedAt - Date.now())).toBeLessThan(60_000);
  });

  test("a commit can have many investigations", async () => {
    const first = await submit(ari);
    const second = await submit(bob, { title: "A second reading" });

    expect(second.body.investigation).not.toBe(first.body.investigation);
    const { body } = await api.post("/investigations/for-commit", { session: ari, ...paperNet, commit: firstCommit });
    expect((body.commit as { investigations: Summary[] }).investigations.map((i) => [i.title, i.investigator])).toEqual([
      ["A second reading", "bob"],
      [sampleSubmission.title, "ari"],
    ]);
  });

  test("refuses a missing title, no highlights, or a highlight without a comment or valid lines with a 400, and records nothing", async () => {
    const path = "csail_hack/README.md";
    for (const changes of [
      { title: "" },
      { highlights: [] },
      { highlights: [{ path, from: 12, to: 18, comment: "" }] },
      { highlights: [{ path, from: 18, to: 12, comment: "Backwards." }] },
      { highlights: [{ path, from: 0, to: 2, comment: "Line zero." }] },
      { commit: "d8ab205" },
    ]) {
      expect(await submit(ari, changes)).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    }
    const { body } = await api.post("/investigations/list", { session: ari, ...paperNet });
    expect((body.repository as { investigations: unknown[] }).investigations).toEqual([]);
  });

  test("a request cannot choose its own investigator", async () => {
    expect((await api.post("/investigations/submit", { session: ari, ...sampleSubmission, investigator: "bob" })).status).toBe(400);
  });
});

describe("/investigations/get", () => {
  test("an investigation that does not exist is a 404", async () => {
    expect(await api.post("/investigations/get", { session: ari, investigation: "missing" })).toEqual({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
  });

  test("another user can read it, because the repository is shared", async () => {
    const id = (await submit(ari)).body.investigation;

    expect((await api.post("/investigations/get", { session: bob, investigation: id })).status).toBe(200);
  });
});

describe("lists", () => {
  test("a repository's list is newest first, with titles, and only that repository's", async () => {
    await submit(ari);
    await new Promise((r) => setTimeout(r, 5));
    await submit(bob, { commit: secondCommit, title: "README removed" });
    await submit(ari, { owner: "octocat", name: "Hello-World", title: "Elsewhere" });

    const { body } = await api.post("/investigations/list", { session: ari, ...paperNet });
    const list = (body.repository as { investigations: Summary[] }).investigations;
    expect(list.map((i) => [i.title, i.commit, i.investigator])).toEqual([
      ["README removed", secondCommit, "bob"],
      [sampleSubmission.title, firstCommit, "ari"],
    ]);
  });

  test("a commit's list has only that commit's, and is empty when there are none", async () => {
    await submit(ari);

    const other = await api.post("/investigations/for-commit", { session: ari, ...paperNet, commit: secondCommit });
    expect(other).toEqual({ status: 200, body: { commit: { investigations: [] } } });
  });
});

test("every investigation endpoint needs an active session", async () => {
  const id = (await submit(ari)).body.investigation;
  await api.post("/auth/sign-out", { session: ari });

  expect((await submit(ari, { title: "After sign-out" })).status).toBe(401);
  expect((await api.post("/investigations/get", { session: ari, investigation: id })).status).toBe(401);
  expect((await api.post("/investigations/list", { session: "invented", ...paperNet })).status).toBe(401);
  expect((await api.post("/investigations/for-commit", { session: "invented", ...paperNet, commit: firstCommit })).status).toBe(401);
  // Nothing was recorded by the refused request.
  const list = await api.post("/investigations/list", { session: bob, ...paperNet });
  expect((list.body.repository as { investigations: unknown[] }).investigations).toHaveLength(1);
});
