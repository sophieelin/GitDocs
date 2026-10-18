import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

let testDb: TestDb;
let api: ReturnType<typeof testApi>;
let ari: string;
let bob: string;

const paperNet = { owner: "sophieelin", name: "PaperNet" };
const d8ab205 = "d8ab205" + "a".repeat(33);
const c6d4a4c6 = "6d4a4c6" + "b".repeat(33);

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

async function open(session: string, commit: string, repository = paperNet) {
  return api.post("/investigations/open", { session, ...repository, commit });
}

describe("/investigations/open", () => {
  test("opens an investigation, with the signed-in user as investigator", async () => {
    const opened = await open(ari, d8ab205);
    expect(opened.status).toBe(200);
    const id = opened.body.investigation as string;

    const { status, body } = await api.post("/investigations/get", { session: ari, investigation: id });
    expect(status).toBe(200);
    expect(body).toMatchObject({ investigation: id, ...paperNet, commit: d8ab205, investigator: "ari" });
    expect(Math.abs(new Date(body.openedAt as string).getTime() - Date.now())).toBeLessThan(60_000);
  });

  test("the same commit, by the same or another user, is the same investigation", async () => {
    const first = await open(ari, d8ab205);
    const again = await open(ari, d8ab205);
    const byBob = await open(bob, d8ab205);

    expect(again.body.investigation).toBe(first.body.investigation);
    expect(byBob.body.investigation).toBe(first.body.investigation);
    const { body } = await api.post("/investigations/get", { session: bob, investigation: first.body.investigation });
    expect(body.investigator).toBe("ari");
  });

  test("a request cannot choose its own investigator", async () => {
    expect((await api.post("/investigations/open", { session: ari, ...paperNet, commit: d8ab205, investigator: "bob" })).status).toBe(400);
  });

  test("a short or invalid SHA is a 400", async () => {
    expect(await open(ari, "d8ab205")).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    expect(await open(ari, "z".repeat(40))).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
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
    const id = (await open(ari, d8ab205)).body.investigation;

    expect((await api.post("/investigations/get", { session: bob, investigation: id })).status).toBe(200);
  });
});

describe("/investigations/list", () => {
  test("lists the repository's investigations, newest first, with who opened each", async () => {
    await open(ari, d8ab205);
    await new Promise((r) => setTimeout(r, 5));
    await open(bob, c6d4a4c6);

    const { status, body } = await api.post("/investigations/list", { session: ari, ...paperNet });
    expect(status).toBe(200);
    const list = (body.repository as { investigations: { commit: string; investigator: string }[] }).investigations;
    expect(list.map((i) => [i.commit, i.investigator])).toEqual([
      [c6d4a4c6, "bob"],
      [d8ab205, "ari"],
    ]);
  });

  test("shows only that repository's investigations", async () => {
    await open(ari, d8ab205);
    await open(ari, c6d4a4c6, { owner: "octocat", name: "Hello-World" });

    const paper = await api.post("/investigations/list", { session: ari, ...paperNet });
    const hello = await api.post("/investigations/list", { session: ari, owner: "octocat", name: "Hello-World" });
    const empty = await api.post("/investigations/list", { session: ari, owner: "someone", name: "else" });
    const commits = (r: typeof paper) => (r.body.repository as { investigations: { commit: string }[] }).investigations.map((i) => i.commit);

    expect(commits(paper)).toEqual([d8ab205]);
    expect(commits(hello)).toEqual([c6d4a4c6]);
    expect(empty).toEqual({ status: 200, body: { repository: { investigations: [] } } });
  });
});

test("every investigation endpoint needs an active session", async () => {
  const id = (await open(ari, d8ab205)).body.investigation;
  await api.post("/auth/sign-out", { session: ari });

  expect((await open(ari, c6d4a4c6)).status).toBe(401);
  expect((await api.post("/investigations/get", { session: ari, investigation: id })).status).toBe(401);
  expect((await api.post("/investigations/list", { session: "invented", ...paperNet })).status).toBe(401);
  // Nothing was opened by the refused request.
  const list = await api.post("/investigations/list", { session: bob, ...paperNet });
  expect((list.body.repository as { investigations: unknown[] }).investigations).toHaveLength(1);
});
