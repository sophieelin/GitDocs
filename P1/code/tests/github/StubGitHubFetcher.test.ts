import { describe, expect, test } from "bun:test";
import { CommitNotFound, GitHubNotFound } from "../../src/github/GitHubApi.ts";
import { buildDocumentationTree } from "../../src/github/documentationTree.ts";
import { StubGitHubFetcher, myRepoCommits } from "./StubGitHubFetcher.ts";

const myRepo = { owner: "sophieelin", name: "my-repo" };

describe("StubGitHubFetcher", () => {
  test("lists commits newest first", async () => {
    const commits = await new StubGitHubFetcher().listCommits(myRepo);

    expect(commits.map((c) => c.sha)).toEqual([myRepoCommits.refactor, myRepoCommits.initial]);
  });

  test("returns the tree at each commit", async () => {
    const stub = new StubGitHubFetcher();
    const before = await stub.getTree(myRepo, myRepoCommits.initial);
    const after = await stub.getTree(myRepo, myRepoCommits.refactor);

    expect(before.sha).toBe(myRepoCommits.initial);
    expect(before.entries).toContainEqual({ path: "src/user_service.py", type: "file" });
    expect(after.entries).toContainEqual({ path: "src/user/user_service.py", type: "file" });
    expect(after.truncated).toBe(false);
  });

  test("gives the documentation structure from the UI sketches", async () => {
    const tree = await new StubGitHubFetcher().getTree(myRepo, myRepoCommits.refactor);
    const docs = buildDocumentationTree(tree.entries).folders.find((f) => f.name === "docs")!;

    expect(docs.folders.map((f) => f.name)).toEqual(["api", "getting-started", "guides"]);
  });

  test("throws the same errors as the real adapter", async () => {
    const stub = new StubGitHubFetcher();

    await expect(stub.listCommits({ owner: "sophieelin", name: "missing" })).rejects.toBeInstanceOf(GitHubNotFound);
    await expect(stub.getTree(myRepo, "0".repeat(40))).rejects.toBeInstanceOf(CommitNotFound);
  });

  test("records each call", async () => {
    const stub = new StubGitHubFetcher();
    await stub.listCommits(myRepo);
    await stub.getTree(myRepo, myRepoCommits.initial);

    expect(stub.calls).toEqual(["listCommits sophieelin/my-repo", `getTree sophieelin/my-repo ${myRepoCommits.initial}`]);
  });

  test("returns copies, so a test cannot change the fixed data", async () => {
    const stub = new StubGitHubFetcher();
    (await stub.listCommits(myRepo)).pop();

    expect(await stub.listCommits(myRepo)).toHaveLength(2);
  });
});
