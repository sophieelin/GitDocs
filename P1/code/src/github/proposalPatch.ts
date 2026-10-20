import { formatPatch, structuredPatch, type StructuredPatch } from "diff";
import type { DocumentationFile, DocumentationFolder } from "./documentationTree.ts";
import { applyOperations, type Operation } from "./structureOperations.ts";

/**
 * Text to put in place of the text from character `start` of line `from` up
 * to, not including, character `end` of line `to`, in `path` at the proposal's
 * commit. Lines count from 1, characters from 0.
 */
export interface Suggestion {
  path: string;
  from: number;
  to: number;
  start: number;
  end: number;
  replacement: string;
}

/** Where each documentation file ends up: `from` is its path at the commit, or null for a new file. */
export interface Placed {
  from: string | null;
  to: string;
}

function files(folder: DocumentationFolder): DocumentationFile[] {
  return [...folder.files, ...folder.folders.flatMap(files)];
}

/**
 * Every documentation file the changes leave, with the path it had at the
 * commit and its path after them; or undefined when the changes do not fit
 * the structure. A moved folder takes the files in it along.
 */
export function placeFiles(tree: DocumentationFolder, operations: Operation[]): Placed[] | undefined {
  if ("error" in applyOperations(tree, operations)) return undefined;
  const placed: Placed[] = files(tree).map((file) => ({ from: file.path, to: file.path }));
  for (const operation of operations) {
    if (operation.kind === "createFile") placed.push({ from: null, to: operation.path });
    if (operation.kind !== "move") continue;
    for (const file of placed) {
      if (file.to === operation.from) file.to = operation.to;
      else if (file.to.startsWith(`${operation.from}/`)) file.to = operation.to + file.to.slice(operation.from.length);
    }
  }
  return placed;
}

/**
 * The text with each suggestion made, or an error when one is not in the text
 * or two overlap. A column past the end of its line means the end of the line.
 */
export function applySuggestions(text: string, suggestions: Suggestion[]): { text: string } | { error: string } {
  const lineStarts = [0];
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) lineStarts.push(index + 1);
  const lineEnd = (line: number) => (line < lineStarts.length ? lineStarts[line] - 1 : text.length);
  const offset = (line: number, column: number) => Math.min(lineStarts[line - 1] + column, lineEnd(line));

  const spans = [];
  for (const suggestion of suggestions) {
    if (suggestion.from < 1 || suggestion.to > lineStarts.length || suggestion.from > suggestion.to) {
      return { error: `A suggestion in ${suggestion.path} is on lines the file does not have.` };
    }
    spans.push({ start: offset(suggestion.from, suggestion.start), end: offset(suggestion.to, suggestion.end), replacement: suggestion.replacement });
  }
  // New text put in where a replaced range starts comes before it.
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 1; index < spans.length; index++) {
    if (spans[index].start < spans[index - 1].end) return { error: "Two suggestions in one file overlap." };
  }
  // From the end, so the offsets before each one still hold.
  let result = text;
  for (const span of spans.reverse()) result = result.slice(0, span.start) + span.replacement + result.slice(span.end);
  return { text: result };
}

/** The paths whose text at the commit a patch with these suggestions needs. */
export function pathsToRead(suggestions: Suggestion[]): string[] {
  return [...new Set(suggestions.map((suggestion) => suggestion.path))];
}

/**
 * A patch that `git apply` takes at the repository's root, at the proposal's
 * commit: it renames and moves documentation files, creates new ones empty,
 * and makes the suggested edits. `texts` holds the text at the commit of every
 * path in `pathsToRead(suggestions)`. Folders are left out, because git does
 * not keep empty ones. Answers an error when the changes or the suggestions do
 * not fit, and an empty string when there is nothing to change.
 */
export function proposalPatch({
  structure,
  operations,
  suggestions,
  texts,
}: {
  structure: DocumentationFolder;
  operations: Operation[];
  suggestions: Suggestion[];
  texts: Map<string, string>;
}): { patch: string } | { error: string } {
  const placed = placeFiles(structure, operations);
  if (!placed) return { error: "The changes do not fit the documentation structure." };

  const edited = new Map<string, string>();
  for (const path of pathsToRead(suggestions)) {
    const text = texts.get(path);
    if (text === undefined) return { error: `The text of ${path} is missing.` };
    const made = applySuggestions(text, suggestions.filter((suggestion) => suggestion.path === path));
    if ("error" in made) return made;
    if (made.text !== text) edited.set(path, made.text);
  }

  // Git names the two sides of a change `a/` and `b/`.
  const change = (from: string, to: string, text: string, changed: string): StructuredPatch => ({
    ...structuredPatch(`a/${from}`, `b/${to}`, text, changed),
    isGit: true,
  });
  const patches: StructuredPatch[] = [];
  const moved = new Set<string>();
  for (const { from, to } of placed) {
    if (from === null) {
      patches.push({ ...change(to, to, "", ""), isCreate: true, newMode: "100644" });
      continue;
    }
    moved.add(from);
    const text = texts.get(from) ?? "";
    const changed = edited.get(from) ?? text;
    if (from === to && changed === text) continue;
    patches.push({ ...change(from, to, text, changed), isRename: from !== to });
  }
  // Suggestions on files that are not documentation, which the structure does not move.
  for (const [path, changed] of edited) {
    if (!moved.has(path)) patches.push(change(path, path, texts.get(path)!, changed));
  }
  return { patch: patches.length === 0 ? "" : formatPatch(patches) };
}
