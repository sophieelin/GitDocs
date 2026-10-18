import type { DocumentationFolder } from "../github.ts";

/**
 * Pure edits of a documentation tree, used by the proposal editor. Each takes
 * the tree and returns a new one, leaving the given tree untouched, or refuses
 * with a sentence to show. Paths are kept equal to the names from the root, so
 * a moved or renamed folder carries its files' paths along.
 */
export type Edit = { tree: DocumentationFolder } | { error: string };

/** Sorts names as people read them, as the documentation tree does. */
const byName = new Intl.Collator(undefined, { numeric: true }).compare;

const MARKDOWN = /\.(md|markdown)$/i;

/** A deep copy. Written out rather than `structuredClone`, which refuses Vue's reactive proxies. */
function copy(folder: DocumentationFolder): DocumentationFolder {
  return {
    name: folder.name,
    path: folder.path,
    folders: folder.folders.map(copy),
    files: folder.files.map((file) => ({ name: file.name, path: file.path })),
  };
}

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

function folderAt(root: DocumentationFolder, path: string): DocumentationFolder | undefined {
  if (path === "") return root;
  let folder: DocumentationFolder | undefined = root;
  for (const part of path.split("/")) {
    folder = folder.folders.find((child) => child.name === part);
    if (!folder) return undefined;
  }
  return folder;
}

function isTaken(folder: DocumentationFolder, name: string): boolean {
  return folder.folders.some((child) => child.name === name) || folder.files.some((file) => file.name === name);
}

function nameProblem(name: string): string | null {
  if (name === "") return "Give it a name.";
  if (name.includes("/")) return "A name cannot contain “/”.";
  if (name === "." || name === "..") return "That name is not allowed.";
  if (name.length > 255) return "Keep the name to 255 characters.";
  return null;
}

/** Sets a folder's path, and its contents' paths below it. */
function relocate(folder: DocumentationFolder, path: string): void {
  folder.path = path;
  for (const file of folder.files) file.path = join(path, file.name);
  for (const child of folder.folders) relocate(child, join(path, child.name));
}

function sort(folder: DocumentationFolder): void {
  folder.folders.sort((a, b) => byName(a.name, b.name));
  folder.files.sort((a, b) => byName(a.name, b.name));
}

type Located = { parent: DocumentationFolder; file?: DocumentationFolder["files"][number]; folder?: DocumentationFolder };

/** The file or folder at `path` in `root`, with the folder that holds it. */
function locate(root: DocumentationFolder, path: string): Located | undefined {
  if (path === "") return undefined;
  const parent = folderAt(root, parentOf(path));
  if (!parent) return undefined;
  const name = nameOf(path);
  const file = parent.files.find((candidate) => candidate.name === name);
  if (file) return { parent, file };
  const folder = parent.folders.find((candidate) => candidate.name === name);
  if (folder) return { parent, folder };
  return undefined;
}

/** Renames the file or folder at `path`. A file must stay Markdown, so it stays documentation. */
export function rename(tree: DocumentationFolder, path: string, newName: string): Edit {
  const root = copy(tree);
  const found = locate(root, path);
  if (!found) return { error: "That file or folder is not in the proposed structure." };
  const name = newName.trim();
  const problem = nameProblem(name);
  if (problem) return { error: problem };
  if (name === nameOf(path)) return { tree: root };
  if (isTaken(found.parent, name)) return { error: `There is already a “${name}” in that folder.` };

  if (found.file) {
    if (!MARKDOWN.test(name)) return { error: "A documentation file's name must end in .md or .markdown." };
    found.file.name = name;
    found.file.path = join(found.parent.path, name);
  } else if (found.folder) {
    found.folder.name = name;
    relocate(found.folder, join(found.parent.path, name));
  }
  sort(found.parent);
  return { tree: root };
}

/** Moves the file or folder at `path` into the folder at `folderPath` (`""` is the root). */
export function move(tree: DocumentationFolder, path: string, folderPath: string): Edit {
  const root = copy(tree);
  const found = locate(root, path);
  if (!found) return { error: "That file or folder is not in the proposed structure." };
  const target = folderAt(root, folderPath);
  if (!target) return { error: "That folder is not in the proposed structure." };
  if (target === found.parent) return { error: "It is already in that folder." };
  if (found.folder && (folderPath === path || folderPath.startsWith(`${path}/`))) {
    return { error: "A folder cannot be moved into itself." };
  }
  const name = nameOf(path);
  if (isTaken(target, name)) return { error: `There is already a “${name}” in that folder. Rename one of them first.` };

  if (found.file) {
    found.parent.files = found.parent.files.filter((file) => file !== found.file);
    found.file.path = join(target.path, name);
    target.files.push(found.file);
  } else if (found.folder) {
    found.parent.folders = found.parent.folders.filter((folder) => folder !== found.folder);
    relocate(found.folder, join(target.path, name));
    target.folders.push(found.folder);
  }
  sort(target);
  return { tree: root };
}

/** Adds an empty folder named `name` inside the folder at `parentPath` (`""` is the root). */
export function createFolder(tree: DocumentationFolder, parentPath: string, name: string): Edit {
  const root = copy(tree);
  const parent = folderAt(root, parentPath);
  if (!parent) return { error: "That folder is not in the proposed structure." };
  const trimmed = name.trim();
  const problem = nameProblem(trimmed);
  if (problem) return { error: problem };
  if (isTaken(parent, trimmed)) return { error: `There is already a “${trimmed}” in that folder.` };
  parent.folders.push({ name: trimmed, path: join(parent.path, trimmed), folders: [], files: [] });
  sort(parent);
  return { tree: root };
}

/** Removes the folder at `path`, which must be empty: a proposal reorganizes documentation, it never deletes it. */
export function removeFolder(tree: DocumentationFolder, path: string): Edit {
  const root = copy(tree);
  const found = locate(root, path);
  if (!found?.folder) return { error: "That folder is not in the proposed structure." };
  if (found.folder.files.length > 0 || found.folder.folders.length > 0) {
    return { error: "Only an empty folder can be removed. Move its contents out first." };
  }
  found.parent.folders = found.parent.folders.filter((folder) => folder !== found.folder);
  return { tree: root };
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
