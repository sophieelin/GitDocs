import { CommitNotFound, GitHubNotFound } from "../../src/github/GitHubApi.ts";
import type { GitHubFetcher } from "../../src/github/GitHubFetcher.ts";
import type {
  ChangedFile,
  Commit,
  CommitDetails,
  RepositoryRef,
  RepositoryTree,
  TreeEntry,
} from "../../src/github/types.ts";

export interface StubRepository {
  /** Newest first, as GitHub returns them. */
  commits: Commit[];
  /** Tree entries at each commit SHA. */
  trees: Record<string, TreeEntry[]>;
  /** The files each commit changed. A commit with none listed changed nothing. */
  changes?: Record<string, ChangedFile[]>;
  /** File text by path, the same at every commit. A file not listed reads as `# <path>`. */
  files?: Record<string, string>;
}

/** The author and date every stub commit reports. */
export const stubAuthor = { author: "octo-dev", date: "2026-09-12T10:00:00Z" };

/**
 * A `GitHubFetcher` with fixed data, so tests run without the network.
 * It throws the same errors as `GitHubApi` for unknown repositories and commits.
 */
export class StubGitHubFetcher implements GitHubFetcher {
  /** Every call, in order, so tests can check what was requested. */
  readonly calls: string[] = [];

  constructor(private readonly repositories: Record<string, StubRepository> = { "sophieelin/my-repo": myRepo }) {}

  async listCommits(repository: RepositoryRef): Promise<Commit[]> {
    this.calls.push(`listCommits ${key(repository)}`);
    return [...this.find(repository).commits];
  }

  async getTree(repository: RepositoryRef, sha: string): Promise<RepositoryTree> {
    this.calls.push(`getTree ${key(repository)} ${sha}`);
    const entries = this.find(repository).trees[sha];
    if (!entries) throw new CommitNotFound(`Commit ${sha} does not exist in this repository.`);
    return { sha, entries: [...entries], truncated: false };
  }

  async getCommit(repository: RepositoryRef, sha: string): Promise<CommitDetails> {
    this.calls.push(`getCommit ${key(repository)} ${sha}`);
    const found = this.find(repository);
    const commit = found.commits.find((c) => c.sha === sha);
    if (!commit) throw new CommitNotFound(`Commit ${sha} does not exist in this repository.`);
    const files = (found.changes?.[sha] ?? []).map((file) => ({ ...file }));
    return { sha, message: commit.message, ...stubAuthor, files, truncated: false };
  }

  async getFile(repository: RepositoryRef, sha: string, path: string): Promise<string> {
    this.calls.push(`getFile ${key(repository)} ${sha} ${path}`);
    const found = this.find(repository);
    const entries = found.trees[sha];
    if (!entries) throw new CommitNotFound(`Commit ${sha} does not exist in this repository.`);
    if (!entries.some((entry) => entry.type === "file" && entry.path === path)) {
      throw new GitHubNotFound("The repository is private or does not exist, or the commit does not exist.");
    }
    return found.files?.[path] ?? `# ${path}\n`;
  }

  private find(repository: RepositoryRef): StubRepository {
    const found = this.repositories[key(repository)];
    if (!found) throw new GitHubNotFound("The repository is private or does not exist, or the commit does not exist.");
    return found;
  }
}

function key({ owner, name }: RepositoryRef): string {
  return `${owner}/${name}`;
}

const file = (path: string): TreeEntry => ({ path, type: "file" });
const dir = (path: string): TreeEntry => ({ path, type: "directory" });

const documentation: TreeEntry[] = [
  file("README.md"),
  dir("docs"),
  dir("docs/getting-started"),
  file("docs/getting-started/overview.md"),
  dir("docs/api"),
  file("docs/api/user.md"),
  file("docs/api/auth.md"),
  dir("docs/guides"),
  file("docs/guides/deployment.md"),
];

/** Commit SHAs in the default stub repository. */
export const myRepoCommits = {
  initial: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  /** "Restructured user and service layers", as in the UI sketches. */
  refactor: "3f4e2a7c1d9b8e6f5a4b3c2d1e0f9a8b7c6d5e4f",
};

/** The repository from the UI sketches, before and after the user and service layers were restructured. */
export const myRepo: StubRepository = {
  commits: [
    { sha: myRepoCommits.refactor, message: "Restructured user and service layers" },
    { sha: myRepoCommits.initial, message: "Initial commit" },
  ],
  trees: {
    [myRepoCommits.initial]: [
      ...documentation,
      dir("src"),
      file("src/user_service.py"),
      file("src/auth_service.py"),
      file("src/models.py"),
    ],
    [myRepoCommits.refactor]: [
      ...documentation,
      dir("src"),
      dir("src/user"),
      file("src/user/user_service.py"),
      file("src/user/auth_service.py"),
      dir("src/models"),
      file("src/models/user.py"),
      file("src/models/post.py"),
      dir("src/services"),
      file("src/services/email.py"),
      file("src/services/storage.py"),
    ],
  },
  changes: {
    // The first commit adds every file, documentation and code.
    [myRepoCommits.initial]: [
      ...documentation
        .filter((entry) => entry.type === "file")
        .map((entry): ChangedFile => ({ path: entry.path, status: "added", additions: 10, deletions: 0, patch: "@@ -0,0 +1 @@\n+# Docs" })),
      { path: "src/user_service.py", status: "added", additions: 40, deletions: 0 },
      { path: "src/auth_service.py", status: "added", additions: 30, deletions: 0 },
      { path: "src/models.py", status: "added", additions: 25, deletions: 0 },
    ],
    // The refactor moves code and changes no documentation: the case GitDocs is for.
    [myRepoCommits.refactor]: [
      { path: "src/user/user_service.py", previousPath: "src/user_service.py", status: "renamed", additions: 0, deletions: 0 },
      { path: "src/user/auth_service.py", previousPath: "src/auth_service.py", status: "renamed", additions: 2, deletions: 1, patch: "@@ -1,3 +1,4 @@\n-from user_service import User\n+from user.user_service import User\n+\n def sign_in():" },
      { path: "src/models.py", status: "removed", additions: 0, deletions: 25 },
      { path: "src/models/user.py", status: "added", additions: 15, deletions: 0 },
      { path: "src/models/post.py", status: "added", additions: 10, deletions: 0 },
      { path: "src/services/email.py", status: "added", additions: 20, deletions: 0 },
      { path: "src/services/storage.py", status: "added", additions: 18, deletions: 0 },
    ],
  },
};
