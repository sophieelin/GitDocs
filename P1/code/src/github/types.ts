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

/** How a commit changed one file. */
export type ChangeStatus = "added" | "modified" | "removed" | "renamed" | "copied";

export interface ChangedFile {
  path: string;
  /** The file's path before a rename or copy. */
  previousPath?: string;
  status: ChangeStatus;
  additions: number;
  deletions: number;
  /** The unified diff. GitHub leaves it out for binary files and very large changes. */
  patch?: string;
}

/** One commit and what it changed. */
export interface CommitDetails {
  sha: string;
  message: string;
  author: string;
  /** When the change was authored, as an ISO string. */
  date: string;
  files: ChangedFile[];
  /** True when GitHub listed only some of the changed files (it lists at most 300 at once). */
  truncated: boolean;
}

/** Every file and directory in a repository at one commit. */
export interface RepositoryTree {
  sha: string;
  entries: TreeEntry[];
  /** True when GitHub returned only part of a very large tree. */
  truncated: boolean;
}
