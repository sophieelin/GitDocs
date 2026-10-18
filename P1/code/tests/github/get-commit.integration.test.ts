import { describe, expect, test } from "bun:test";
import { CommitNotFound, GitHubApi } from "../../src/github/GitHubApi.ts";

// Calls the real GitHub API. Run with: GITHUB_INTEGRATION=1 bun test tests/github
const enabled = process.env.GITHUB_INTEGRATION === "1";

const helloWorld = { owner: "octocat", name: "Hello-World" };
// A commit from 2012. Commits never change, so what it changed is fixed.
const knownCommit = "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d";

describe.skipIf(!enabled)("GitHubApi.getCommit against GitHub", () => {
  const api = new GitHubApi({ token: process.env.GITHUB_TOKEN });

  test("returns a known commit's message, author, date, and changed files", async () => {
    const commit = await api.getCommit(helloWorld, knownCommit);

    expect(commit.sha).toBe(knownCommit);
    expect(commit.message.split("\n")[0]).toBe("Merge pull request #6 from Spaceghost/patch-1");
    expect(commit.author).toBe("octocat");
    expect(commit.date).toBe("2012-03-06T23:06:50Z");
    expect(commit.files).toHaveLength(1);
    expect(commit.files[0]).toMatchObject({ path: "README", status: "modified", additions: 1, deletions: 1 });
    expect(commit.files[0]!.patch).toContain("@@");
    expect(commit.truncated).toBe(false);
  });

  test("refuses a commit that does not exist", async () => {
    await expect(api.getCommit(helloWorld, "0".repeat(40))).rejects.toBeInstanceOf(CommitNotFound);
  });
});
