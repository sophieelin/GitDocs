/**
 * Reviews over the HTTP handler: ari writes proposals and names their
 * reviewer when submitting; bob and cyd are other accounts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

let testDb: TestDb;
let api: ReturnType<typeof testApi>;
let ari: string;
let bob: string;
let cyd: string;
let investigation: string;

// Example inputs for these tests only.
const paperNet = { owner: "sophieelin", name: "PaperNet" };
const commit = "6d4a4c6" + "b".repeat(33);
const readme = { name: "README.md", path: "csail_hack/lib/agents/README.md" };
const currentStructure = {
  name: "",
  path: "",
  files: [],
  folders: [{ name: "csail_hack", path: "csail_hack", files: [readme], folders: [] }],
};
const proposedStructure = { name: "", path: "", files: [readme], folders: [] };

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  api = testApi(testDb.db);
  ari = await api.register("ari");
  bob = await api.register("bob");
  cyd = await api.register("cyd");
  const submitted = await api.post("/investigations/submit", {
    session: ari,
    ...paperNet,
    commit,
    title: "Agents moved under lib/",
    highlights: [{ path: readme.path, from: 1, to: 4, comment: "Hard to find this deep." }],
  });
  investigation = submitted.body.investigation as string;
});

afterAll(async () => {
  await testDb.close();
});

/** A saved draft by the account with `session`. */
async function draft(session: string, title = "Organize the agents docs"): Promise<string> {
  const created = await api.post("/proposals/create", { session, investigation, title, currentStructure });
  if (created.status !== 200) throw new Error(`create failed: ${created.status} ${JSON.stringify(created.body)}`);
  const proposal = created.body.proposal as string;
  await api.post("/proposals/modify", { session, proposal, title, proposedStructure, rationale: "Easier to find." });
  return proposal;
}

function submit(session: string, proposal: string, reviewer: string) {
  return api.post("/proposals/submit", { session, proposal, reviewer });
}

/** A proposal by the account with `session`, submitted for `reviewer`. Answers the proposal and its review. */
async function submitted(session: string, reviewer: string, title?: string) {
  const proposal = await draft(session, title);
  const { status, body } = await submit(session, proposal, reviewer);
  if (status !== 200) throw new Error(`submit failed: ${status} ${JSON.stringify(body)}`);
  return { proposal, review: await reviewOf(proposal) };
}

async function detail(proposal: string) {
  const { body } = await api.post("/proposals/get", { session: ari, proposal });
  return body.proposal as { status: string; review: string | null; reviewer: string | null; decision: string | null };
}

async function reviewOf(proposal: string) {
  return (await detail(proposal)).review as string;
}

test("the MVP cycle: ari submits for bob, bob approves, and ari sees Approved", async () => {
  const proposal = await draft(ari);
  expect(await submit(ari, proposal, "bob")).toEqual({ status: 200, body: { proposal } });
  expect(await detail(proposal)).toMatchObject({ status: "PENDING_APPROVAL", reviewer: "bob", decision: "PENDING" });

  const queue = await api.post("/proposals/under-review", { session: bob, ...paperNet });
  expect(queue.body.repository).toMatchObject({ proposals: [{ proposal, author: "ari" }] });

  const review = await reviewOf(proposal);
  const approved = await api.post("/reviews/approve", { session: bob, review });
  expect(approved.status).toBe(200);
  expect(approved.body.proposal).toMatchObject({ proposal, author: "ari", status: "APPROVED", review, reviewer: "bob", decision: "APPROVED" });

  expect(await detail(proposal)).toMatchObject({ status: "APPROVED", decision: "APPROVED" });
  const listed = await api.post("/proposals/list", { session: ari, ...paperNet });
  expect(listed.body.repository).toMatchObject({ submitted: [{ proposal, status: "APPROVED" }] });
});

describe("naming the reviewer", () => {
  test("the author cannot name themselves, and the proposal stays a draft with no review", async () => {
    const proposal = await draft(ari);
    expect(await submit(ari, proposal, "ari")).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    expect(await detail(proposal)).toMatchObject({ status: "DRAFT", review: null, reviewer: null, decision: null });
  });

  test("an account that does not exist cannot be named", async () => {
    const proposal = await draft(ari);
    expect(await submit(ari, proposal, "nobody")).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    expect(await detail(proposal)).toMatchObject({ status: "DRAFT", review: null });
  });

  test("a request with no reviewer is a 400", async () => {
    const proposal = await draft(ari);
    expect((await api.post("/proposals/submit", { session: ari, proposal })).status).toBe(400);
    expect((await detail(proposal)).status).toBe("DRAFT");
  });

  test("someone else cannot submit ari's draft by naming a reviewer, and no review is opened", async () => {
    const proposal = await draft(ari);
    expect(await submit(bob, proposal, "cyd")).toEqual({ status: 403, body: { error: "FORBIDDEN" } });
    expect(await detail(proposal)).toMatchObject({ status: "DRAFT", review: null });
  });

  test("a missing proposal is a 404", async () => {
    expect(await submit(ari, "missing", "bob")).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
  });
});

describe("/reviews/get", () => {
  test("answers the review with its proposal and both structures", async () => {
    const { proposal, review } = await submitted(ari, "bob");

    const { status, body } = await api.post("/reviews/get", { session: cyd, review });
    expect(status).toBe(200);
    expect(body.review).toMatchObject({
      review,
      reviewer: "bob",
      decision: "PENDING",
      proposal: { proposal, author: "ari", status: "PENDING_APPROVAL", currentStructure, proposedStructure, review, reviewer: "bob" },
    });
  });

  test("a missing review is a 404", async () => {
    expect(await api.post("/reviews/get", { session: bob, review: "missing" })).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
  });
});

describe("/reviews/approve", () => {
  test("only the named reviewer can approve", async () => {
    const { proposal, review } = await submitted(ari, "bob");
    expect(await api.post("/reviews/approve", { session: cyd, review })).toEqual({ status: 403, body: { error: "FORBIDDEN" } });
    expect((await detail(proposal)).status).toBe("PENDING_APPROVAL");
  });

  test("approving twice is a 409, and a missing review is a 404", async () => {
    const { proposal, review } = await submitted(ari, "bob");
    expect((await api.post("/reviews/approve", { session: bob, review })).status).toBe(200);
    expect(await api.post("/reviews/approve", { session: bob, review })).toEqual({ status: 409, body: { error: "CONFLICT" } });
    expect(await api.post("/reviews/approve", { session: bob, review: "missing" })).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
    expect((await detail(proposal)).status).toBe("APPROVED");
  });
});

describe("/proposals/under-review", () => {
  function queue(session: string, repository = paperNet) {
    return api.post("/proposals/under-review", { session, ...repository });
  }

  test("lists only the pending proposals waiting for the requester's review, the longest waiting first", async () => {
    const first = await submitted(ari, "bob", "First");
    const second = await submitted(cyd, "bob", "Second");
    const forCyd = await submitted(ari, "cyd", "For cyd");
    await draft(ari, "Still a draft");
    const approved = await submitted(ari, "bob", "Already approved");
    await api.post("/reviews/approve", { session: bob, review: approved.review });

    const forBob = await queue(bob);
    expect(forBob.status).toBe(200);
    expect(forBob.body.repository).toEqual({
      proposals: [
        expect.objectContaining({ proposal: first.proposal, author: "ari", investigation, commit, title: "First" }),
        expect.objectContaining({ proposal: second.proposal, author: "cyd", title: "Second" }),
      ],
    });

    const ids = async (session: string) => ((await queue(session)).body.repository as { proposals: { proposal: string }[] }).proposals.map((item) => item.proposal);
    expect(await ids(cyd)).toEqual([forCyd.proposal]);
    // The author's own proposals are never waiting for their review.
    expect(await ids(ari)).toEqual([]);
  });

  test("another repository's queue is empty", async () => {
    await submitted(ari, "bob");
    expect((await queue(bob, { owner: "octocat", name: "Hello-World" })).body).toEqual({ repository: { proposals: [] } });
  });
});
