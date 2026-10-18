import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

let testDb: TestDb;
let api: ReturnType<typeof testApi>;
let ari: string;
let bob: string;
let investigation: string;

// Example inputs for these tests only.
const paperNet = { owner: "sophieelin", name: "PaperNet" };
const commit = "6d4a4c6" + "b".repeat(33);
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
const proposedStructure = { name: "", path: "", files: [readme], folders: [] };

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  api = testApi(testDb.db);
  ari = await api.register("ari");
  bob = await api.register("bob");
  const submitted = await api.post("/investigations/submit", {
    session: ari,
    ...paperNet,
    commit,
    title: "Agents moved under lib/",
    affected: [{ path: readme.path, reason: "Hard to find this deep." }],
    evidence: ["lib/agents/ gained its own README in this commit"],
  });
  investigation = submitted.body.investigation as string;
});

afterAll(async () => {
  await testDb.close();
});

async function create(session: string, title = "Organize the agents docs"): Promise<string> {
  const { status, body } = await api.post("/proposals/create", { session, investigation, title, currentStructure });
  if (status !== 200) throw new Error(`create failed: ${status} ${JSON.stringify(body)}`);
  return body.proposal as string;
}

function modify(session: string, proposal: string, changes: Record<string, unknown> = {}) {
  return api.post("/proposals/modify", {
    session,
    proposal,
    title: "Organize the agents docs",
    proposedStructure,
    rationale: "The agents README is the first thing a reader needs.",
    ...changes,
  });
}

/** Submits with bob as the reviewer. */
function submit(session: string, proposal: string) {
  return api.post("/proposals/submit", { session, proposal, reviewer: "bob" });
}

async function get(session: string, proposal: string) {
  return api.post("/proposals/get", { session, proposal });
}

describe("/proposals/create", () => {
  test("starts a draft by the signed-in user, with the investigation's repository and commit", async () => {
    const proposal = await create(ari);

    const { status, body } = await get(ari, proposal);
    expect(status).toBe(200);
    expect(body.proposal).toMatchObject({
      proposal,
      author: "ari",
      investigation,
      ...paperNet,
      commit,
      title: "Organize the agents docs",
      rationale: "",
      status: "DRAFT",
      currentStructure,
      proposedStructure: currentStructure,
    });
  });

  test("an investigation that does not exist is a 404", async () => {
    expect(
      await api.post("/proposals/create", { session: ari, investigation: "missing", title: "Anything", currentStructure }),
    ).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
  });

  test("an empty title or a malformed structure is a 400", async () => {
    for (const changes of [{ title: "" }, { currentStructure: { name: "", path: "" } }]) {
      const { status } = await api.post("/proposals/create", { session: ari, investigation, title: "A title", currentStructure, ...changes });
      expect(status).toBe(400);
    }
  });

  test("a request cannot choose its own author or commit", async () => {
    for (const extra of [{ author: "bob" }, { commit: "d8ab205" + "a".repeat(33) }]) {
      const { status } = await api.post("/proposals/create", { session: ari, investigation, title: "A title", currentStructure, ...extra });
      expect(status).toBe(400);
    }
  });
});

describe("/proposals/modify and /proposals/submit", () => {
  test("saving changes the draft and keeps the current structure", async () => {
    const proposal = await create(ari);

    expect(await modify(ari, proposal)).toEqual({ status: 200, body: { proposal } });
    const { body } = await get(ari, proposal);
    expect(body.proposal).toMatchObject({
      rationale: "The agents README is the first thing a reader needs.",
      currentStructure,
      proposedStructure,
      status: "DRAFT",
    });
  });

  test("submitting without a rationale is a 409; with one it is pending approval, once", async () => {
    const proposal = await create(ari);
    expect(await submit(ari, proposal)).toEqual({ status: 409, body: { error: "CONFLICT" } });
    expect(((await get(ari, proposal)).body.proposal as { review: string | null }).review).toBeNull();

    await modify(ari, proposal);
    expect(await submit(ari, proposal)).toEqual({ status: 200, body: { proposal } });
    expect((await get(ari, proposal)).body.proposal).toMatchObject({ status: "PENDING_APPROVAL", reviewer: "bob", decision: "PENDING" });

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
    const proposal = await create(ari);

    expect(await api.post("/proposals/discard", { session: ari, proposal })).toEqual({ status: 200, body: { proposal } });
    expect((await get(ari, proposal)).status).toBe(404);
    expect((await api.post("/proposals/discard", { session: ari, proposal })).status).toBe(404);
  });

  test("a submitted proposal cannot be discarded", async () => {
    const proposal = await create(ari);
    await modify(ari, proposal);
    await submit(ari, proposal);

    expect((await api.post("/proposals/discard", { session: ari, proposal })).status).toBe(409);
  });
});

describe("/proposals/get", () => {
  test("another user gets a 404 for a draft, and can read it once it is submitted", async () => {
    const proposal = await create(ari);
    await modify(ari, proposal);

    expect(await get(bob, proposal)).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await get(bob, "missing")).toEqual({ status: 404, body: { error: "NOT_FOUND" } });

    await submit(ari, proposal);
    for (const session of [ari, bob]) {
      const { status, body } = await get(session, proposal);
      expect(status).toBe(200);
      expect(body.proposal).toMatchObject({ author: "ari", status: "PENDING_APPROVAL", currentStructure, proposedStructure });
    }
  });
});

describe("/proposals/list", () => {
  function list(session: string, repository = paperNet) {
    return api.post("/proposals/list", { session, ...repository });
  }

  test("lists every submitted proposal and only the requester's own drafts", async () => {
    const submitted = await create(ari, "Submitted by ari");
    await modify(ari, submitted, { title: "Submitted by ari" });
    await submit(ari, submitted);
    const arisDraft = await create(ari, "Ari's draft");
    const bobsDraft = await create(bob, "Bob's draft");

    const forAri = await list(ari);
    expect(forAri.status).toBe(200);
    expect(forAri.body.repository).toMatchObject({
      submitted: [{ proposal: submitted, author: "ari", investigation, commit, title: "Submitted by ari" }],
      drafts: [{ proposal: arisDraft, investigation, commit, title: "Ari's draft" }],
    });

    const forBob = (await list(bob)).body.repository as { submitted: { proposal: string }[]; drafts: { proposal: string }[] };
    expect(forBob.submitted.map((item) => item.proposal)).toEqual([submitted]);
    expect(forBob.drafts.map((item) => item.proposal)).toEqual([bobsDraft]);
  });

  test("another repository's proposals are not listed", async () => {
    await create(ari);
    expect((await list(ari, { owner: "octocat", name: "Hello-World" })).body).toEqual({
      repository: { submitted: [], drafts: [] },
    });
  });
});
