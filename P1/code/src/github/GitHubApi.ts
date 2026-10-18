import type { GitHubFetcher } from "./GitHubFetcher.ts";
import type {
  ChangedFile,
  ChangeStatus,
  Commit,
  CommitDetails,
  RepositoryRef,
  RepositoryTree,
  TreeEntry,
} from "./types.ts";

/** Base class for every error the adapter throws. */
export class GitHubError extends Error {}

export class InvalidRepositoryName extends GitHubError {}
export class InvalidCommitSha extends GitHubError {}

/** GitHub answered 404: the repository is private or does not exist, or the commit does not exist. */
export class GitHubNotFound extends GitHubError {}

/** The repository exists, but the commit does not. GitHub answers 422 for this, not 404. */
export class CommitNotFound extends GitHubNotFound {}

export class GitHubRateLimited extends GitHubError {}

/** Any other unsuccessful response, or GitHub could not be reached. */
export class GitHubRequestFailed extends GitHubError {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// GitHub's own rules: owners are letters, digits, and hyphens; repository names may also use `.` and `_`.
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const SHA = /^[0-9a-f]{7,40}$/i;

type GitHubCommit = { sha: string; commit: { message: string } };
type GitHubCommitDetails = {
  sha: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string } | null;
  files?: {
    filename: string;
    previous_filename?: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }[];
};

/** GitHub lists at most this many changed files in one answer. */
const MAX_LISTED_FILES = 300;

function changeStatus(status: string): ChangeStatus {
  if (status === "added" || status === "removed" || status === "renamed" || status === "copied") return status;
  // GitHub also says "changed" (for example, only the file mode) or "unchanged"; both read as modified.
  return "modified";
}
type GitHubTree = { tree: { path: string; type: "blob" | "tree" | "commit" }[]; truncated: boolean };

export interface GitHubApiOptions {
  /** Optional; public repositories work without one, at a lower rate limit. */
  token?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

/** Reads public repositories through GitHub's REST API. */
export class GitHubApi implements GitHubFetcher {
  private readonly token: string | undefined;
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;

  constructor({ token, baseUrl = "https://api.github.com", fetch: fetchImpl = fetch }: GitHubApiOptions = {}) {
    this.token = token || undefined;
    this.baseUrl = baseUrl;
    this.fetch = fetchImpl;
  }

  async listCommits(repository: RepositoryRef): Promise<Commit[]> {
    const response = await this.request(`${repoPath(repository)}/commits?per_page=30`);
    // An empty repository has no commits; GitHub answers 409 instead of an empty list.
    if (response.status === 409) return [];
    const commits = await this.parse<GitHubCommit[]>(response);
    return commits.map(({ sha, commit }) => ({ sha, message: commit.message }));
  }

  async getTree(repository: RepositoryRef, sha: string): Promise<RepositoryTree> {
    if (!SHA.test(sha)) throw new InvalidCommitSha(`"${sha}" is not a commit SHA.`);
    const response = await this.request(`${repoPath(repository)}/git/trees/${sha}?recursive=1`);
    if (response.status === 422) throw new CommitNotFound(`Commit ${sha} does not exist in this repository.`);
    const tree = await this.parse<GitHubTree>(response);
    const entries: TreeEntry[] = [];
    for (const { path, type } of tree.tree) {
      // "commit" entries are submodules, which point into other repositories.
      if (type === "blob") entries.push({ path, type: "file" });
      else if (type === "tree") entries.push({ path, type: "directory" });
    }
    return { sha, entries, truncated: tree.truncated };
  }

  async getCommit(repository: RepositoryRef, sha: string): Promise<CommitDetails> {
    if (!SHA.test(sha)) throw new InvalidCommitSha(`"${sha}" is not a commit SHA.`);
    const response = await this.request(`${repoPath(repository)}/commits/${sha}?per_page=${MAX_LISTED_FILES}`);
    if (response.status === 422) throw new CommitNotFound(`Commit ${sha} does not exist in this repository.`);
    const commit = await this.parse<GitHubCommitDetails>(response);
    const files = (commit.files ?? []).map((file): ChangedFile => ({
      path: file.filename,
      ...(file.previous_filename ? { previousPath: file.previous_filename } : {}),
      status: changeStatus(file.status),
      additions: file.additions,
      deletions: file.deletions,
      ...(file.patch !== undefined ? { patch: file.patch } : {}),
    }));
    return {
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.author?.login ?? commit.commit.author?.name ?? "unknown",
      date: commit.commit.author?.date ?? "",
      files,
      truncated: files.length >= MAX_LISTED_FILES,
    };
  }

  async getFile(repository: RepositoryRef, sha: string, path: string): Promise<string> {
    if (!SHA.test(sha)) throw new InvalidCommitSha(`"${sha}" is not a commit SHA.`);
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    // The raw media type answers the file's bytes rather than base64 inside JSON.
    const response = await this.request(`${repoPath(repository)}/contents/${encoded}?ref=${sha}`, "application/vnd.github.raw+json");
    if (response.status === 422) throw new CommitNotFound(`Commit ${sha} does not exist in this repository.`);
    if (!response.ok) await this.parse(response);
    return await response.text();
  }

  private async request(path: string, accept = "application/vnd.github+json"): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "GitDocs",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    // TODO: retry unsuccessful responses (5xx, rate limits, network errors) with backoff.
    // For now every request is sent once, and any failure is thrown to the caller.
    try {
      return await this.fetch(`${this.baseUrl}${path}`, { headers });
    } catch (error) {
      throw new GitHubRequestFailed(`Could not reach GitHub: ${(error as Error).message}`);
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    if (response.ok) return (await response.json()) as T;
    if (response.status === 404) {
      throw new GitHubNotFound("The repository is private or does not exist, or the commit does not exist.");
    }
    const rateLimited =
      response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
    if (rateLimited) throw new GitHubRateLimited("GitHub's rate limit was reached. Try again later or set GITHUB_TOKEN.");
    throw new GitHubRequestFailed(`GitHub answered ${response.status} ${response.statusText}.`, response.status);
  }
}

/** The adapter configured from the environment. This is the only place that reads GITHUB_TOKEN. */
export function gitHubApiFromEnv(): GitHubApi {
  return new GitHubApi({ token: process.env.GITHUB_TOKEN });
}

function repoPath({ owner, name }: RepositoryRef): string {
  if (!OWNER.test(owner) || !NAME.test(name) || name === "." || name === "..") {
    throw new InvalidRepositoryName(`"${owner}/${name}" is not a valid GitHub repository name.`);
  }
  return `/repos/${owner}/${name}`;
}
