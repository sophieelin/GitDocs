import type { DocumentationFolder } from "../github.ts";
import { applyOperations, type Operation } from "../../../src/github/structureOperations.ts";

export type { Operation };

/**
 * Edits of a documentation tree, used by the proposal editor. Each takes the
 * tree and returns a new one, leaving the given tree untouched, together with
 * the changes to record (none when nothing changed); or refuses with a
 * sentence to show. The tree is built by the same `applyOperations` the server
 * uses, so the editor and the saved proposal cannot disagree.
 */
export type Edit = { tree: DocumentationFolder; operations: Operation[] } | { error: string };

function join(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

function parentOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** The editor names one entry at a time, so a name may not hold a path. */
function nameProblem(name: string): string | null {
  if (name === "") return "Give it a name.";
  if (name.includes("/")) return "A name cannot contain “/”.";
  return null;
}

function edit(tree: DocumentationFolder, operation: Operation): Edit {
  const applied = applyOperations(tree, [operation]);
  return "error" in applied ? { error: applied.error } : { tree: applied.tree, operations: [operation] };
}

/** Renames the file or folder at `path`. A file must stay Markdown, so it stays documentation. */
export function rename(tree: DocumentationFolder, path: string, newName: string): Edit {
  const name = newName.trim();
  const problem = nameProblem(name);
  if (problem) return { error: problem };
  if (name === nameOf(path)) {
    return exists(tree, path) ? { tree, operations: [] } : { error: "That file or folder is not in the proposed structure." };
  }
  return edit(tree, { kind: "move", from: path, to: join(parentOf(path), name) });
}

/** Moves the file or folder at `path` into the folder at `folderPath` (`""` is the root). */
export function move(tree: DocumentationFolder, path: string, folderPath: string): Edit {
  if (folderPath === parentOf(path) && exists(tree, path)) return { error: "It is already in that folder." };
  return edit(tree, { kind: "move", from: path, to: join(folderPath, nameOf(path)) });
}

/** Adds an empty folder named `name` inside the folder at `parentPath` (`""` is the root). */
export function createFolder(tree: DocumentationFolder, parentPath: string, name: string): Edit {
  const trimmed = name.trim();
  const problem = nameProblem(trimmed);
  if (problem) return { error: problem };
  return edit(tree, { kind: "createFolder", path: join(parentPath, trimmed) });
}

/** Adds an empty Markdown file named `name` inside the folder at `parentPath`; the author writes it after applying. */
export function createFile(tree: DocumentationFolder, parentPath: string, name: string): Edit {
  const trimmed = name.trim();
  const problem = nameProblem(trimmed);
  if (problem) return { error: problem };
  return edit(tree, { kind: "createFile", path: join(parentPath, trimmed) });
}

/** Removes the folder at `path`, which must be empty: a proposal reorganizes documentation, it never deletes it. */
export function removeFolder(tree: DocumentationFolder, path: string): Edit {
  return edit(tree, { kind: "removeFolder", path });
}

/** True when the tree has a file or folder at `path`. */
function exists(tree: DocumentationFolder, path: string): boolean {
  let folder: DocumentationFolder | undefined = tree;
  const parts = path.split("/");
  const last = parts.pop();
  for (const part of parts) {
    folder = folder.folders.find((child) => child.name === part);
    if (!folder) return false;
  }
  return folder.files.some((file) => file.name === last) || folder.folders.some((child) => child.name === last);
}

/** Every folder's path, the root (`""`) first, for choosing where to move something. */
export function folderPaths(tree: DocumentationFolder): string[] {
  const paths: string[] = [];
  function visit(folder: DocumentationFolder): void {
    paths.push(folder.path);
    for (const child of folder.folders) visit(child);
  }
  visit(tree);
  return paths;
}
