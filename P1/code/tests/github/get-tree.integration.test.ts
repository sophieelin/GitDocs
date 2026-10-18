import { describe, expect, test } from "bun:test";
import { CommitNotFound, GitHubApi, GitHubNotFound, InvalidCommitSha } from "../../src/github/GitHubApi.ts";

// Calls the real GitHub API. Run with: GITHUB_INTEGRATION=1 bun test tests/github
const enabled = process.env.GITHUB_INTEGRATION === "1";

const helloWorld = { owner: "octocat", name: "Hello-World" };
// A commit from 2012. Commits never change, so its tree is fixed.
const knownCommit = "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d";

describe.skipIf(!enabled)("GitHubApi.getTree against GitHub", () => {
  const api = new GitHubApi({ token: process.env.GITHUB_TOKEN });

  test("returns the file paths at a known commit", async () => {
    const tree = await api.getTree(helloWorld, knownCommit);

    expect(tree.sha).toBe(knownCommit);
    expect(tree.truncated).toBe(false);
    expect(tree.entries).toEqual([{ path: "README", type: "file" }]);
  });

  test("refuses a commit that does not exist", async () => {
    await expect(api.getTree(helloWorld, "0".repeat(40))).rejects.toBeInstanceOf(CommitNotFound);
  });

  test("refuses a repository that does not exist", async () => {
    await expect(api.getTree({ owner: "octocat", name: "no-such-repo-gitdocs" }, knownCommit)).rejects.toBeInstanceOf(
      GitHubNotFound,
    );
  });
});

// Rejected before any request is sent, so this runs without the network.
describe("GitHubApi.getTree input checks", () => {
  test("refuses a malformed SHA", async () => {
    await expect(new GitHubApi().getTree(helloWorld, "not-a-sha")).rejects.toBeInstanceOf(InvalidCommitSha);
  });
});
