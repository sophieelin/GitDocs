import type { Commit, RepositoryRef, RepositoryTree } from "./types.ts";

/**
 * Reads public repository data from GitHub. It knows nothing about HTTP routes,
 * MongoDB, or sync-engine, so concepts can be tested with a fake.
 */
export interface GitHubFetcher {
  /** Recent commits on the default branch, newest first. */
  listCommits(repository: RepositoryRef): Promise<Commit[]>;

  /** The repository's complete file tree at `sha`. */
  getTree(repository: RepositoryRef, sha: string): Promise<RepositoryTree>;
}
