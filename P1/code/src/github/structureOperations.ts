import type { DocumentationFile, DocumentationFolder } from "./documentationTree.ts";

/**
 * One change to a documentation structure. A rename is a move within its
 * folder. Paths are from the repository root, as in the documentation tree.
 */
export type Operation =
  | { kind: "move"; from: string; to: string }
  | { kind: "createFile"; path: string }
  | { kind: "createFolder"; path: string }
  | { kind: "removeFolder"; path: string };

export type Applied = { tree: DocumentationFolder } | { error: string; index: number };

/** The most changes one list may hold, so a proposal stays well under Mongo's document limit. */
const MAX_OPERATIONS = 1000;
const MAX_PATH = 1000;

const MARKDOWN = /\.(md|markdown)$/i;

/** Sorts names as people read them, as the documentation tree does. */
const byName = new Intl.Collator(undefined, { numeric: true }).compare;

function isPath(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value.length <= MAX_PATH;
}

/**
 * The changes with only their known fields, or undefined when the value is not
 * a list of changes: every change needs a known kind and its paths.
 */
export function parseOperations(value: unknown): Operation[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_OPERATIONS) return undefined;
  const operations: Operation[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) return undefined;
    const { kind, from, to, path } = candidate as Record<string, unknown>;
    if (kind === "move" && isPath(from) && isPath(to)) operations.push({ kind, from, to });
    else if ((kind === "createFile" || kind === "createFolder" || kind === "removeFolder") && isPath(path)) {
      operations.push({ kind, path });
    } else return undefined;
  }
  return operations;
}

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

type Located = { parent: DocumentationFolder; file?: DocumentationFile; folder?: DocumentationFolder };

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

/** Where a new entry at `path` would go: its folder, or a sentence saying why it cannot go there. */
function placeFor(root: DocumentationFolder, path: string): { parent: DocumentationFolder; name: string } | { error: string } {
  const parent = folderAt(root, parentOf(path));
  if (!parent) return { error: "That folder is not in the proposed structure." };
  const name = nameOf(path);
  const problem = nameProblem(name);
  if (problem) return { error: problem };
  // Rejects spellings such as `/docs/a.md` that would not match the tree's own paths.
  if (join(parent.path, name) !== path) return { error: "That is not a path in the proposed structure." };
  return { parent, name };
}

/** Applies one change to `root` in place, or answers why it does not fit. */
function applyOne(root: DocumentationFolder, operation: Operation): string | null {
  switch (operation.kind) {
    case "move": {
      const { from, to } = operation;
      const found = locate(root, from);
      if (!found) return "That file or folder is not in the proposed structure.";
      if (from === to) return "It is already there.";
      if (found.folder && to.startsWith(`${from}/`)) return "A folder cannot be moved into itself.";
      const place = placeFor(root, to);
      if ("error" in place) return place.error;
      const { parent, name } = place;
      if (isTaken(parent, name)) {
        return parent === found.parent
          ? `There is already a “${name}” in that folder.`
          : `There is already a “${name}” in that folder. Rename one of them first.`;
      }
      if (found.file) {
        if (!MARKDOWN.test(name)) return "A documentation file's name must end in .md or .markdown.";
        found.parent.files = found.parent.files.filter((file) => file !== found.file);
        found.file.name = name;
        found.file.path = to;
        parent.files.push(found.file);
      } else if (found.folder) {
        found.parent.folders = found.parent.folders.filter((folder) => folder !== found.folder);
        found.folder.name = name;
        relocate(found.folder, to);
        parent.folders.push(found.folder);
      }
      sort(parent);
      return null;
    }
    case "createFile":
    case "createFolder": {
      const place = placeFor(root, operation.path);
      if ("error" in place) return place.error;
      const { parent, name } = place;
      if (isTaken(parent, name)) return `There is already a “${name}” in that folder.`;
      if (operation.kind === "createFile") {
        if (!MARKDOWN.test(name)) return "A documentation file's name must end in .md or .markdown.";
        parent.files.push({ name, path: operation.path });
      } else {
        parent.folders.push({ name, path: operation.path, folders: [], files: [] });
      }
      sort(parent);
      return null;
    }
    case "removeFolder": {
      const found = locate(root, operation.path);
      if (!found?.folder) return "That folder is not in the proposed structure.";
      if (found.folder.files.length > 0 || found.folder.folders.length > 0) {
        return "Only an empty folder can be removed. Move its contents out first.";
      }
      found.parent.folders = found.parent.folders.filter((folder) => folder !== found.folder);
      return null;
    }
  }
}

/**
 * The structure after the changes, in order, leaving the given tree untouched;
 * or the first change that does not fit, with its position and a sentence to
 * show. A proposal reorganizes documentation and adds to it, but never deletes
 * a file.
 */
export function applyOperations(tree: DocumentationFolder, operations: Operation[]): Applied {
  const root = copy(tree);
  for (const [index, operation] of operations.entries()) {
    const error = applyOne(root, operation);
    if (error) return { error, index };
  }
  return { tree: root };
}

/** A path as one shell word: in single quotes, with each single quote written as `'\''`. */
function quote(path: string): string {
  return `'${path.replaceAll("'", `'\\''`)}'`;
}

/** Every file in `folder` and below it, and every folder below it with nothing in it. */
function contents(folder: DocumentationFolder): { files: string[]; emptyFolders: string[] } {
  const files = folder.files.map((file) => file.path);
  const emptyFolders: string[] = [];
  for (const child of folder.folders) {
    if (child.files.length === 0 && child.folders.length === 0) emptyFolders.push(child.path);
    const below = contents(child);
    files.push(...below.files);
    emptyFolders.push(...below.emptyFolders);
  }
  return { files, emptyFolders };
}

function allFolders(folder: DocumentationFolder, into: Set<string>): Set<string> {
  into.add(folder.path);
  for (const child of folder.folders) allFolders(child, into);
  return into;
}

/**
 * The shell commands that make the changes in a clone of the repository, run
 * from its root, or an empty list when the changes do not fit the structure.
 * A moved folder moves its documentation files one by one, so any code in it
 * stays where it is. A folder is made with `mkdir -p` only when the structure
 * does not have it yet, since every folder in the structure holds a file on
 * disk or was made by an earlier command.
 */
export function gitCommands(tree: DocumentationFolder, operations: Operation[]): string[] {
  const root = copy(tree);
  const made = allFolders(root, new Set());
  const commands: string[] = [];

  function ensure(folder: string): void {
    if (made.has(folder)) return;
    commands.push(`mkdir -p ${quote(folder)}`);
    for (let path = folder; !made.has(path); path = parentOf(path)) made.add(path);
  }

  for (const operation of operations) {
    switch (operation.kind) {
      case "move": {
        const found = locate(root, operation.from);
        if (found?.file) {
          ensure(parentOf(operation.to));
          commands.push(`git mv ${quote(operation.from)} ${quote(operation.to)}`);
        } else if (found?.folder) {
          const { files, emptyFolders } = contents(found.folder);
          const moved = (path: string) => operation.to + path.slice(operation.from.length);
          if (files.length === 0 && emptyFolders.length === 0) ensure(operation.to);
          for (const file of files) {
            ensure(parentOf(moved(file)));
            commands.push(`git mv ${quote(file)} ${quote(moved(file))}`);
          }
          for (const folder of emptyFolders) ensure(moved(folder));
        }
        break;
      }
      case "createFile":
        ensure(parentOf(operation.path));
        commands.push(`touch ${quote(operation.path)}`, `git add ${quote(operation.path)}`);
        break;
      case "createFolder":
        ensure(operation.path);
        break;
      case "removeFolder":
        commands.push(`rmdir ${quote(operation.path)}`);
        for (const folder of made) if (folder === operation.path || folder.startsWith(`${operation.path}/`)) made.delete(folder);
        break;
    }
    if (applyOne(root, operation)) return [];
  }
  return commands;
}
