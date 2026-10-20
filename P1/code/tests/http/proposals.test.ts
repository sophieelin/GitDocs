import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { applyOperations, gitCommands } from "../../src/github/structureOperations.ts";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

let testDb: TestDb;
let api: ReturnType<typeof testApi>;
let ari: string;
let bob: string;

// Example inputs for these tests only.
const paperNet = { owner: "sophieelin", name: "PaperNet" };
const commit = "6d4a4c6" + "b".repeat(33);
const appliedCommit = "e1f2a3b" + "c".repeat(33);
const readme = { name: "README.md", path: "csail_hack/lib/agents/README.md" };
const currentStructure = {
  name: "",
  path: "",
  files: [],
  folders: [
    {
      name: "csail_hack",
      path: "csail_hack",
      files: [],
      folders: [{ name: "lib", path: "csail_hack/lib", files: [], folders: [{ name: "agents", path: "csail_hack/lib/agents", files: [readme], folders: [] }] }],
    },
  ],
};
/** Moves the agents README to the root. */
const operations = [{ kind: "move" as const, from: readme.path, to: "AGENTS.md" }];
const proposedStructure = (applyOperations(currentStructure, operations) as { tree: unknown }).tree;
const commands = gitCommands(currentStructure, operations).map((command) => ({ command }));

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

function startRequest(session: string, changes: Record<string, unknown> = {}) {
  return api.post("/proposals/start", { session, ...paperNet, commit, title: "Organize the agents docs", currentStructure, ...changes });
}

async function start(session: string, title = "Organize the agents docs", changes: Record<string, unknown> = {}): Promise<string> {
  const { status, body } = await startRequest(session, { title, ...changes });
  if (status !== 200) throw new Error(`start failed: ${status} ${JSON.stringify(body)}`);
  return body.proposal as string;
}

function modify(session: string, proposal: string, changes: Record<string, unknown> = {}) {
  return api.post("/proposals/modify", {
    session,
    proposal,
    title: "Organize the agents docs",
    operations,
    rationale: "The agents README is the first thing a reader needs.",
    ...changes,
  });
}

/** Submits with bob as the reviewer. */
function submit(session: string, proposal: string) {
  return api.post("/proposals/submit", { session, proposal, reviewer: "bob" });
}

/** A proposal by ari, saved and submitted for bob. */
async function submitted(title = "Organize the agents docs", changes: Record<string, unknown> = {}): Promise<string> {
  const proposal = await start(ari, title, changes);
  await modify(ari, proposal, { title });
  const { status, body } = await submit(ari, proposal);
  if (status !== 200) throw new Error(`submit failed: ${status} ${JSON.stringify(body)}`);
  return proposal;
}

/** Bob approves the review of `proposal`. */
async function approve(proposal: string) {
  const { review } = (await get(ari, proposal)).body.proposal as { review: string };
  const { status, body } = await api.post("/reviews/approve", { session: bob, review });
  if (status !== 200) throw new Error(`approve failed: ${status} ${JSON.stringify(body)}`);
}

function get(session: string, proposal: string) {
  return api.post("/proposals/get", { session, proposal });
}

function apply(session: string, proposal: string, sha = appliedCommit) {
  return api.post("/proposals/apply", { session, proposal, commit: sha });
}

test("the whole cycle: start, highlight, save, submit, approve, read the commands, and mark it applied", async () => {
  const proposal = await start(ari);
  const highlighted = await api.post("/proposals/highlight", {
    session: ari,
    proposal,
    file: readme.path,
    from: 1,
    to: 1,
    start: 0,
    end: 8,
    text: "Hard to find this deep.",
  });
  expect(highlighted.status).toBe(200);
  expect(await modify(ari, proposal)).toEqual({ status: 200, body: { proposal } });
  expect(((await get(ari, proposal)).body.proposal as { commands: unknown[] }).commands).toEqual([]);

  expect(await submit(ari, proposal)).toEqual({ status: 200, body: { proposal } });
  expect((await get(bob, proposal)).body.proposal).toMatchObject({ status: "SUBMITTED", reviewer: "bob", decision: "PENDING", commands: [] });
  // Not approved yet, so it cannot be applied.
  expect(await apply(ari, proposal)).toEqual({ status: 409, body: { error: "CONFLICT" } });

  await approve(proposal);
  expect((await get(ari, proposal)).body.proposal).toMatchObject({ status: "APPROVED", decision: "APPROVED", appliedCommit: "", commands });
  expect(commands.length).toBeGreaterThan(0);

  expect(await apply(ari, proposal, appliedCommit.toUpperCase())).toEqual({ status: 200, body: { proposal } });
  const { body } = await get(bob, proposal);
  expect(body.proposal).toMatchObject({
    proposal,
    author: "ari",
    status: "APPLIED",
    appliedCommit,
    operations,
    proposedStructure,
    commands,
    highlights: [{ highlight: highlighted.body.highlight, path: readme.path, from: 1, to: 1, start: 0, end: 8, text: "Hard to find this deep." }],
  });
  expect((await apply(ari, proposal)).status).toBe(409);
});

describe("/proposals/start", () => {
  test("starts a draft by the signed-in user, with no changes, whose proposed structure is the current one", async () => {
    const proposal = await start(ari);

    const { status, body } = await get(ari, proposal);
    expect(status).toBe(200);
    expect(body.proposal).toEqual({
      proposal,
      author: "ari",
      ...paperNet,
      commit,
      title: "Organize the agents docs",
      rationale: "",
      status: "DRAFT",
      appliedCommit: "",
      currentStructure,
      operations: [],
      proposedStructure: currentStructure,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      review: null,
      reviewer: null,
      decision: null,
      highlights: [],
      commands: [],
    });
  });

  test("an empty title, a short commit, or a malformed structure is a 400", async () => {
    for (const changes of [{ title: "" }, { commit: "6d4a4c6" }, { currentStructure: { name: "", path: "" } }]) {
      expect((await startRequest(ari, changes)).status).toBe(400);
    }
  });

  test("a request cannot choose its own author or start time", async () => {
    for (const extra of [{ investigator: "bob" }, { author: "bob" }, { at: "2020-01-01T00:00:00.000Z" }]) {
      expect((await startRequest(ari, extra)).status).toBe(400);
    }
  });
});

describe("/proposals/modify and /proposals/submit", () => {
  test("saving sets the changes and works out the proposed structure from them", async () => {
    const proposal = await start(ari);

    expect(await modify(ari, proposal)).toEqual({ status: 200, body: { proposal } });
    expect((await get(ari, proposal)).body.proposal).toMatchObject({
      rationale: "The agents README is the first thing a reader needs.",
      currentStructure,
      operations,
      proposedStructure,
      status: "DRAFT",
    });
  });

  test("changes that do not fit the structure, or are not a list of changes, are a 400", async () => {
    const proposal = await start(ari);
    expect(await modify(ari, proposal, { operations: [{ kind: "move", from: "nowhere.md", to: "here.md" }] })).toEqual({
      status: 400,
      body: { error: "INVALID_REQUEST" },
    });
    expect((await modify(ari, proposal, { operations: "move it" })).status).toBe(400);
    expect((await modify(ari, proposal, { proposedStructure: currentStructure })).status).toBe(400);
    expect((await get(ari, proposal)).body.proposal).toMatchObject({ operations: [], proposedStructure: currentStructure });
  });

  test("submitting without a change or a rationale is a 409; with both it is submitted, once", async () => {
    const proposal = await start(ari);
    expect(await submit(ari, proposal)).toEqual({ status: 409, body: { error: "CONFLICT" } });
    await modify(ari, proposal, { rationale: "" });
    expect(await submit(ari, proposal)).toEqual({ status: 409, body: { error: "CONFLICT" } });
    expect(((await get(ari, proposal)).body.proposal as { review: string | null }).review).toBeNull();

    await modify(ari, proposal);
    expect(await submit(ari, proposal)).toEqual({ status: 200, body: { proposal } });
    expect((await get(ari, proposal)).body.proposal).toMatchObject({ status: "SUBMITTED", reviewer: "bob", decision: "PENDING" });

    expect((await submit(ari, proposal)).status).toBe(409);
    expect((await modify(ari, proposal, { title: "Too late" })).status).toBe(409);
  });

  test("a proposal that does not exist is a 404", async () => {
    expect((await modify(ari, "missing")).status).toBe(404);
    expect((await submit(ari, "missing")).status).toBe(404);
  });
});

describe("/proposals/discard", () => {
  test("removes the author's draft", async () => {
    const proposal = await start(ari);

    expect(await api.post("/proposals/discard", { session: ari, proposal })).toEqual({ status: 200, body: { proposal } });
    expect((await get(ari, proposal)).status).toBe(404);
    expect((await api.post("/proposals/discard", { session: ari, proposal })).status).toBe(404);
  });

  test("a submitted proposal cannot be discarded", async () => {
    const proposal = await submitted();
    expect((await api.post("/proposals/discard", { session: ari, proposal })).status).toBe(409);
  });
});

describe("/proposals/highlight and /proposals/unhighlight", () => {
  function highlight(session: string, proposal: string, changes: Record<string, unknown> = {}) {
    return api.post("/proposals/highlight", {
      session,
      proposal,
      file: readme.path,
      from: 2,
      to: 3,
      start: 4,
      end: 11,
      text: "This should move with the agents docs.",
      ...changes,
    });
  }

  test("the author highlights text in a file, sees it in the proposal, and removes it", async () => {
    const proposal = await start(ari);

    const added = await highlight(ari, proposal);
    expect(added.status).toBe(200);
    const id = added.body.highlight as string;
    expect(added.body).toEqual({ proposal, highlight: id });
    expect((await get(ari, proposal)).body.proposal).toMatchObject({
      highlights: [{ highlight: id, path: readme.path, from: 2, to: 3, start: 4, end: 11, text: "This should move with the agents docs." }],
    });

    expect(await api.post("/proposals/unhighlight", { session: ari, proposal, highlight: id })).toEqual({ status: 200, body: { proposal } });
    expect((await get(ari, proposal)).body.proposal).toMatchObject({ highlights: [] });
    expect((await api.post("/proposals/unhighlight", { session: ari, proposal, highlight: id })).status).toBe(404);
  });

  test("a highlight with no comment or no valid range of text is a 400", async () => {
    const proposal = await start(ari);
    const bad = [
      { text: "  " },
      { from: 0 },
      { from: 4, to: 3 },
      { to: 2.5 },
      { start: -1 },
      { end: 1.5 },
      // On one line, the text must not end before it starts.
      { from: 3, to: 3, start: 6, end: 6 },
      { start: undefined },
      { path: readme.path },
    ];
    for (const changes of bad) {
      expect((await highlight(ari, proposal, changes)).status).toBe(400);
    }
    expect((await get(ari, proposal)).body.proposal).toMatchObject({ highlights: [] });
  });

  test("only the author highlights, and only on a draft", async () => {
    const proposal = await start(ari);
    expect((await highlight(bob, proposal)).status).toBe(403);
    expect((await highlight(ari, "missing")).status).toBe(404);

    const id = (await highlight(ari, proposal)).body.highlight as string;
    expect((await api.post("/proposals/unhighlight", { session: bob, proposal, highlight: id })).status).toBe(403);

    await modify(ari, proposal);
    await submit(ari, proposal);
    expect((await highlight(ari, proposal)).status).toBe(409);
    expect((await api.post("/proposals/unhighlight", { session: ari, proposal, highlight: id })).status).toBe(409);
    // The reviewer reads the highlights.
    expect(((await get(bob, proposal)).body.proposal as { highlights: unknown[] }).highlights).toHaveLength(1);
  });
});

describe("/proposals/apply", () => {
  test("only the author marks an approved proposal applied, with a full commit SHA", async () => {
    const proposal = await submitted();
    await approve(proposal);

    expect(await apply(bob, proposal)).toEqual({ status: 403, body: { error: "FORBIDDEN" } });
    expect(await apply(ari, proposal, "e1f2a3b")).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    expect(await apply(ari, "missing")).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
    expect((await get(ari, proposal)).body.proposal).toMatchObject({ status: "APPROVED", appliedCommit: "" });
  });

  test("a draft cannot be applied", async () => {
    const proposal = await start(ari);
    await modify(ari, proposal);
    expect(await apply(ari, proposal)).toEqual({ status: 409, body: { error: "CONFLICT" } });
  });
});

describe("/proposals/get", () => {
  test("another user gets a 404 for a draft, and can read it once it is submitted", async () => {
    const proposal = await start(ari);
    await modify(ari, proposal);

    expect(await get(bob, proposal)).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await get(bob, "missing")).toEqual({ status: 404, body: { error: "NOT_FOUND" } });

    await submit(ari, proposal);
    for (const session of [ari, bob]) {
      const { status, body } = await get(session, proposal);
      expect(status).toBe(200);
      expect(body.proposal).toMatchObject({ author: "ari", status: "SUBMITTED", currentStructure, proposedStructure, commands: [] });
    }
  });
});

describe("/proposals/list and /proposals/for-commit", () => {
  function list(session: string, repository = paperNet) {
    return api.post("/proposals/list", { session, ...repository });
  }

  function forCommit(session: string, sha = commit) {
    return api.post("/proposals/for-commit", { session, ...paperNet, commit: sha });
  }

  test("list every submitted proposal and only the requester's own drafts, the most recently changed first", async () => {
    const older = await submitted("Submitted first");
    const newer = await submitted("Submitted second");
    await approve(older);
    const arisDraft = await start(ari, "Ari's draft");
    const bobsDraft = await start(bob, "Bob's draft");

    const forAri = await list(ari);
    expect(forAri.status).toBe(200);
    expect(forAri.body.repository).toEqual({
      submitted: [
        { proposal: older, author: "ari", commit, title: "Submitted first", status: "APPROVED", decision: "APPROVED", updatedAt: expect.any(String) },
        { proposal: newer, author: "ari", commit, title: "Submitted second", status: "SUBMITTED", decision: "PENDING", updatedAt: expect.any(String) },
      ],
      drafts: [{ proposal: arisDraft, commit, title: "Ari's draft", updatedAt: expect.any(String) }],
    });

    const ids = (items: { proposal: string }[]) => items.map((item) => item.proposal);
    const forBob = (await list(bob)).body.repository as { submitted: { proposal: string }[]; drafts: { proposal: string }[] };
    expect(ids(forBob.submitted)).toEqual([older, newer]);
    expect(ids(forBob.drafts)).toEqual([bobsDraft]);

    const commitForBob = await forCommit(bob);
    expect(commitForBob.status).toBe(200);
    expect(commitForBob.body.commit).toMatchObject({
      submitted: [{ proposal: older, author: "ari", title: "Submitted first", status: "APPROVED", decision: "APPROVED" }, { proposal: newer }],
      drafts: [{ proposal: bobsDraft, title: "Bob's draft" }],
    });
  });

  test("another repository's or another commit's proposals are not listed", async () => {
    await submitted();
    await start(ari, "Another commit", { commit: "d8ab205" + "a".repeat(33) });

    expect((await list(ari, { owner: "octocat", name: "Hello-World" })).body).toEqual({ repository: { submitted: [], drafts: [] } });
    const other = (await forCommit(ari, "d8ab205" + "a".repeat(33))).body.commit as { submitted: unknown[]; drafts: { title: string }[] };
    expect(other.submitted).toEqual([]);
    expect(other.drafts.map((item) => item.title)).toEqual(["Another commit"]);
  });
});
