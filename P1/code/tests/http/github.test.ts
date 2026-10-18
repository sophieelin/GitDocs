import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { GitHubRateLimited } from "../../src/github/GitHubApi.ts";
import type { GitHubFetcher } from "../../src/github/GitHubFetcher.ts";
import { myRepoCommits, StubGitHubFetcher } from "../github/StubGitHubFetcher.ts";
import { openTestDb, type TestDb } from "../test-db.ts";
import { testApi } from "./client.ts";

let testDb: TestDb;
let api: ReturnType<typeof testApi>;
let session: string;

const myRepo = { owner: "sophieelin", name: "my-repo" };

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  api = testApi(testDb.db);
  session = await api.register("ari");
});

afterAll(async () => {
  await testDb.close();
});

describe("/github/commits", () => {
  test("lists a repository's commits, newest first", async () => {
    const { status, body } = await api.post("/github/commits", { session, ...myRepo });

    expect(status).toBe(200);
    expect(body).toEqual({
      commits: [
        { sha: myRepoCommits.refactor, message: "Restructured user and service layers" },
        { sha: myRepoCommits.initial, message: "Initial commit" },
      ],
    });
  });

  test("a repository that does not exist is a 404", async () => {
    expect(await api.post("/github/commits", { session, owner: "sophieelin", name: "missing" })).toEqual({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
  });
});

describe("/github/tree", () => {
  test("returns the documentation tree at a commit", async () => {
    const { status, body } = await api.post("/github/tree", { session, ...myRepo, sha: myRepoCommits.refactor });

    expect(status).toBe(200);
    expect(body.truncated).toBe(false);
    const tree = body.tree as { files: { path: string }[]; folders: { name: string; folders: { name: string }[] }[] };
    expect(tree.files.map((f) => f.path)).toEqual(["README.md"]);
    expect(tree.folders.map((f) => f.name)).toEqual(["docs"]);
    expect(tree.folders[0]!.folders.map((f) => f.name)).toEqual(["api", "getting-started", "guides"]);
  });

  test("the documentation tree leaves out code files", async () => {
    const { body } = await api.post("/github/tree", { session, ...myRepo, sha: myRepoCommits.refactor });

    expect(JSON.stringify(body.tree)).not.toContain(".py");
  });

  test("the code tree has every file at that commit", async () => {
    const before = await api.post("/github/tree", { session, ...myRepo, sha: myRepoCommits.initial });
    const after = await api.post("/github/tree", { session, ...myRepo, sha: myRepoCommits.refactor });
    type Folder = { name: string; files: { path: string }[]; folders: Folder[] };
    const paths = (folder: Folder): string[] => [...folder.files.map((f) => f.path), ...folder.folders.flatMap(paths)];

    expect(paths(before.body.code as Folder)).toContain("src/user_service.py");
    expect(paths(after.body.code as Folder)).toContain("src/user/user_service.py");
    expect(paths(after.body.code as Folder)).toContain("docs/api/user.md");
    expect(paths(after.body.code as Folder)).not.toContain("src/user_service.py");
  });

  test("a commit that does not exist is a 404", async () => {
    expect(await api.post("/github/tree", { session, ...myRepo, sha: "0".repeat(40) })).toEqual({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
  });
});

describe("/github/commit", () => {
  test("returns the commit and every file it changed", async () => {
    const { status, body } = await api.post("/github/commit", { session, ...myRepo, sha: myRepoCommits.refactor });

    expect(status).toBe(200);
    const commit = body.commit as { sha: string; message: string; author: string; files: { path: string; status: string }[] };
    expect(commit).toMatchObject({ sha: myRepoCommits.refactor, message: "Restructured user and service layers", author: "octo-dev" });
    expect(commit.files.map((f) => [f.status, f.path])).toContainEqual(["renamed", "src/user/user_service.py"]);
    expect(commit.files.map((f) => [f.status, f.path])).toContainEqual(["removed", "src/models.py"]);
  });

  test("a commit that changes only code does not change the documentation", async () => {
    const { body } = await api.post("/github/commit", { session, ...myRepo, sha: myRepoCommits.refactor });

    expect(body.changesDocumentation).toBe(false);
  });

  test("a commit that changes Markdown changes the documentation", async () => {
    const { body } = await api.post("/github/commit", { session, ...myRepo, sha: myRepoCommits.initial });

    expect(body.changesDocumentation).toBe(true);
  });

  test("renaming a Markdown file away still changes the documentation", async () => {
    const sha = "c".repeat(40);
    const renamed = new StubGitHubFetcher({
      "sophieelin/my-repo": {
        commits: [{ sha, message: "Move notes" }],
        trees: {},
        changes: { [sha]: [{ path: "notes.txt", previousPath: "docs/notes.md", status: "renamed", additions: 0, deletions: 0 }] },
      },
    });
    const renamedApi = testApi(testDb.db, renamed);
    const renamedSession = await renamedApi.register("dee");

    expect((await renamedApi.post("/github/commit", { session: renamedSession, ...myRepo, sha })).body.changesDocumentation).toBe(true);
  });

  test("a commit that does not exist is a 404", async () => {
    expect(await api.post("/github/commit", { session, ...myRepo, sha: "0".repeat(40) })).toEqual({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
  });

  test("needs an active session", async () => {
    expect((await api.post("/github/commit", { session: "invented", ...myRepo, sha: myRepoCommits.initial })).status).toBe(401);
  });
});

describe("/github/file", () => {
  test("returns a documentation file's text at a commit", async () => {
    const { status, body } = await api.post("/github/file", { session, ...myRepo, sha: myRepoCommits.refactor, path: "docs/api/user.md" });

    expect(status).toBe(200);
    expect(body).toEqual({ path: "docs/api/user.md", text: "# docs/api/user.md\n", truncated: false });
  });

  test("a file that is not at that commit is a 404", async () => {
    expect(await api.post("/github/file", { session, ...myRepo, sha: myRepoCommits.refactor, path: "docs/missing.md" })).toEqual({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
  });

  test("only reads documentation, by a plain relative path", async () => {
    const sha = myRepoCommits.refactor;
    expect((await api.post("/github/file", { session, ...myRepo, sha, path: "src/models/user.py" })).status).toBe(400);
    expect((await api.post("/github/file", { session, ...myRepo, sha, path: "../secrets.md" })).status).toBe(400);
    expect((await api.post("/github/file", { session, ...myRepo, sha, path: "/README.md" })).status).toBe(400);
    expect((await api.post("/github/file", { session, ...myRepo, sha })).status).toBe(400);
  });

  test("needs an active session", async () => {
    expect((await api.post("/github/file", { session: "invented", ...myRepo, sha: myRepoCommits.initial, path: "README.md" })).status).toBe(401);
  });
});

describe("both routes", () => {
  test("need an active session", async () => {
    await api.post("/auth/sign-out", { session });

    expect(await api.post("/github/commits", { session, ...myRepo })).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
    expect(await api.post("/github/tree", { session: "invented", ...myRepo, sha: myRepoCommits.initial })).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
  });

  test("reject malformed input with a 400", async () => {
    expect((await api.post("/github/commits", { session, owner: "sophieelin" })).status).toBe(400);
    expect((await api.post("/github/commits", { session, ...myRepo, extra: 1 })).status).toBe(400);
    expect((await api.post("/github/tree", { session, ...myRepo })).status).toBe(400);
    expect((await api.post("/github/tree", { session, ...myRepo, sha: 7 })).status).toBe(400);
  });

  test("a GitHub outage or rate limit is a 503", async () => {
    const down: GitHubFetcher = {
      listCommits: async () => {
        throw new GitHubRateLimited("rate limited");
      },
      getTree: async () => {
        throw new GitHubRateLimited("rate limited");
      },
    };
    const downApi = testApi(testDb.db, down);
    const downSession = await downApi.register("bob");

    expect(await downApi.post("/github/commits", { session: downSession, ...myRepo })).toEqual({
      status: 503,
      body: { error: "GITHUB_UNAVAILABLE" },
    });
  });

  test("other paths still reach the sync-engine endpoints", async () => {
    expect((await api.post("/auth/current", { session })).body).toEqual({ username: "ari" });
    expect((await api.post("/github/nothing", { session })).status).toBe(404);
  });

  test("only the stub was called, never the network", async () => {
    const stub = new StubGitHubFetcher();
    const stubApi = testApi(testDb.db, stub);
    const stubSession = await stubApi.register("cai");
    await stubApi.post("/github/commits", { session: stubSession, ...myRepo });

    expect(stub.calls).toEqual(["listCommits sophieelin/my-repo"]);
  });
});
