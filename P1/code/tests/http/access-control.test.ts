/**
 * Access control over the HTTP handler, with no frontend: two signed-in
 * accounts, A and B, and requests with no session or an ended one.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

let testDb: TestDb;
let api: ReturnType<typeof testApi>;
let a: string;
let b: string;
let draft: string;

// Example inputs for these tests only.
const structure = { name: "", path: "", files: [{ name: "README.md", path: "README.md" }], folders: [] };
const draftChanges = { title: "Organize the agents docs", proposedStructure: structure, rationale: "A's reasons." };

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  api = testApi(testDb.db);
  a = await api.register("a-user");
  b = await api.register("b-user");
  const investigation = await api.post("/investigations/submit", {
    session: a,
    owner: "sophieelin",
    name: "PaperNet",
    commit: "6d4a4c6" + "b".repeat(33),
    title: "Agents moved under lib/",
    affected: [{ path: "README.md", reason: "Out of date." }],
    evidence: ["The commit moved the agents."],
  });
  const created = await api.post("/proposals/create", {
    session: a,
    investigation: investigation.body.investigation,
    title: draftChanges.title,
    currentStructure: structure,
  });
  draft = created.body.proposal as string;
  await api.post("/proposals/modify", { session: a, proposal: draft, ...draftChanges });
});

afterAll(async () => {
  await testDb.close();
});

async function readBack() {
  const { status, body } = await api.post("/proposals/get", { session: a, proposal: draft });
  expect(status).toBe(200);
  return body.proposal as Record<string, unknown>;
}

describe("another account", () => {
  test("B cannot modify A's draft, and it is unchanged", async () => {
    const before = await readBack();

    expect(
      await api.post("/proposals/modify", { session: b, proposal: draft, title: "B's title", proposedStructure: structure, rationale: "B's reasons." }),
    ).toEqual({ status: 403, body: { error: "FORBIDDEN" } });
    expect(await readBack()).toEqual(before);
  });

  test("B cannot submit A's draft, and it is still a draft", async () => {
    expect(await api.post("/proposals/submit", { session: b, proposal: draft, reviewer: "b-user" })).toEqual({
      status: 403,
      body: { error: "FORBIDDEN" },
    });
    expect((await readBack()).status).toBe("DRAFT");
  });

  test("B cannot discard A's draft", async () => {
    expect((await api.post("/proposals/discard", { session: b, proposal: draft })).status).toBe(403);
    expect((await readBack()).status).toBe("DRAFT");
  });
});

describe("reviews", () => {
  let c: string;

  beforeEach(async () => {
    c = await api.register("c-user");
  });

  async function submitFor(reviewer: string) {
    return api.post("/proposals/submit", { session: a, proposal: draft, reviewer });
  }

  test("A cannot name themselves as reviewer, and the draft is not submitted or reviewed", async () => {
    expect(await submitFor("a-user")).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    expect(await readBack()).toMatchObject({ status: "DRAFT", review: null });
  });

  test("A cannot approve their own proposal through B's review, and it stays pending", async () => {
    await submitFor("b-user");
    const { review } = await readBack();
    expect(await api.post("/reviews/approve", { session: a, review })).toEqual({ status: 403, body: { error: "FORBIDDEN" } });
    expect((await readBack()).status).toBe("PENDING_APPROVAL");
  });

  test("C cannot approve the review A asked B for", async () => {
    await submitFor("b-user");
    const { review } = await readBack();
    expect(await api.post("/reviews/approve", { session: c, review })).toEqual({ status: 403, body: { error: "FORBIDDEN" } });
    expect((await readBack()).status).toBe("PENDING_APPROVAL");
  });
});

describe("no session or an ended session", () => {
  const requests = (session?: string) => {
    const withSession = (body: Record<string, unknown>) => (session === undefined ? body : { session, ...body });
    return [
      ["/proposals/modify", withSession({ proposal: draft, ...draftChanges, title: "Changed" })],
      ["/proposals/submit", withSession({ proposal: draft, reviewer: "b-user" })],
      ["/proposals/discard", withSession({ proposal: draft })],
      ["/proposals/get", withSession({ proposal: draft })],
      ["/proposals/list", withSession({ owner: "sophieelin", name: "PaperNet" })],
      ["/proposals/under-review", withSession({ owner: "sophieelin", name: "PaperNet" })],
      ["/reviews/get", withSession({ review: "any" })],
      ["/reviews/approve", withSession({ review: "any" })],
    ] as const;
  };

  test("an ended session is a 401, and nothing changes", async () => {
    const ended = await api.signIn("a-user");
    await api.post("/auth/sign-out", { session: ended });

    for (const [path, body] of requests(ended)) {
      expect(await api.post(path, body)).toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    }
    expect(await readBack()).toMatchObject({ title: draftChanges.title, status: "DRAFT" });
  });

  test("an invented session is a 401", async () => {
    for (const [path, body] of requests("invented")) {
      expect((await api.post(path, body)).status).toBe(401);
    }
  });

  test("a request with no session is refused", async () => {
    for (const [path, body] of requests()) {
      expect((await api.post(path, body)).status).toBe(400);
    }
    expect(await readBack()).toMatchObject({ title: draftChanges.title, status: "DRAFT" });
  });
});
