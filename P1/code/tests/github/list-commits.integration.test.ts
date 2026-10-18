import { describe, expect, test } from "bun:test";
import { GitHubApi, GitHubNotFound } from "../../src/github/GitHubApi.ts";

// Calls the real GitHub API. Run with: GITHUB_INTEGRATION=1 bun test tests/github
const enabled = process.env.GITHUB_INTEGRATION === "1";

describe.skipIf(!enabled)("GitHubApi.listCommits against GitHub", () => {
  const api = new GitHubApi({ token: process.env.GITHUB_TOKEN });

  test("lists real commits for a public repository", async () => {
    const commits = await api.listCommits({ owner: "octocat", name: "Hello-World" });

    // Only check the shape, so the test keeps passing when new commits are pushed.
    expect(commits.length).toBeGreaterThan(0);
    for (const commit of commits) {
      expect(commit.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(commit.message.length).toBeGreaterThan(0);
    }
  });

  test("refuses a repository that does not exist", async () => {
    await expect(api.listCommits({ owner: "octocat", name: "no-such-repo-gittrace" })).rejects.toBeInstanceOf(
      GitHubNotFound,
    );
  });
});
