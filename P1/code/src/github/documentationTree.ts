import type { TreeEntry } from "./types.ts";

export interface DocumentationFile {
  name: string;
  /** Path from the repository root, such as `docs/api/user.md`. */
  path: string;
}

export interface DocumentationFolder {
  /** Empty for the repository root. */
  name: string;
  /** Empty for the repository root. */
  path: string;
  folders: DocumentationFolder[];
  files: DocumentationFile[];
}

const MARKDOWN = /\.(md|markdown)$/i;

/**
 * Nests a repository's Markdown files into folders, keeping their real paths.
 * Documentation can live anywhere, not only under `docs/`, and a folder appears
 * only if it contains Markdown somewhere inside it.
 */
export function buildDocumentationTree(entries: TreeEntry[]): DocumentationFolder {
  return buildFileTree(entries, (path) => MARKDOWN.test(path));
}

/**
 * Nests a repository's files into folders, keeping their real paths. With no
 * filter, every file is kept, as in the investigation's Code Structure panel.
 * A folder appears only if it contains a kept file somewhere inside it.
 */
export function buildFileTree(entries: TreeEntry[], keep: (path: string) => boolean = () => true): DocumentationFolder {
  const root: DocumentationFolder = { name: "", path: "", folders: [], files: [] };

  for (const entry of entries) {
    if (entry.type !== "file" || !keep(entry.path)) continue;
    const parts = entry.path.split("/");
    const fileName = parts.pop()!;
    let folder = root;
    for (const part of parts) {
      let child = folder.folders.find((f) => f.name === part);
      if (!child) {
        child = { name: part, path: folder.path ? `${folder.path}/${part}` : part, folders: [], files: [] };
        folder.folders.push(child);
      }
      folder = child;
    }
    folder.files.push({ name: fileName, path: entry.path });
  }

  sortFolder(root);
  return root;
}

function sortFolder(folder: DocumentationFolder): void {
  folder.folders.sort((a, b) => a.name.localeCompare(b.name));
  folder.files.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of folder.folders) sortFolder(child);
}
