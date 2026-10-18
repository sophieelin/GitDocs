/** A public GitHub repository, as in `owner/name`. */
export interface RepositoryRef {
  owner: string;
  name: string;
}

export interface Commit {
  sha: string;
  message: string;
}

export interface TreeEntry {
  /** Path from the repository root, such as `docs/setup.md`. */
  path: string;
  type: "file" | "directory";
}

/** Every file and directory in a repository at one commit. */
export interface RepositoryTree {
  sha: string;
  entries: TreeEntry[];
  /** True when GitHub returned only part of a very large tree. */
  truncated: boolean;
}
