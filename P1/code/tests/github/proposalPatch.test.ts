import { describe, expect, test } from "bun:test";
import type { DocumentationFolder } from "../../src/github/documentationTree.ts";
import { applySuggestions, placeFiles, proposalPatch, type Suggestion } from "../../src/github/proposalPatch.ts";

const structure: DocumentationFolder = {
  name: "",
  path: "",
  files: [{ name: "README.md", path: "README.md" }],
  folders: [{ name: "docs", path: "docs", files: [{ name: "agents.md", path: "docs/agents.md" }], folders: [] }],
};

const readme = "# PaperNet\nSee the agents docs.\nOld line here.\n";
const agents = "# Agents\nThe agent lives in lib.\n";

function suggestion(fields: Partial<Suggestion>): Suggestion {
  return { path: "README.md", from: 1, to: 1, start: 0, end: 1, replacement: "", ...fields };
}

describe("placeFiles", () => {
  test("follows each file through renames, folder moves, and new files", () => {
    expect(
      placeFiles(structure, [
        { kind: "move", from: "docs", to: "guides" },
        { kind: "createFile", path: "guides/new.md" },
        { kind: "move", from: "guides/new.md", to: "NEW.md" },
        { kind: "move", from: "README.md", to: "INDEX.md" },
      ]),
    ).toEqual([
      { from: "README.md", to: "INDEX.md" },
      { from: "docs/agents.md", to: "guides/agents.md" },
      { from: null, to: "NEW.md" },
    ]);
  });

  test("answers undefined for changes that do not fit", () => {
    expect(placeFiles(structure, [{ kind: "move", from: "nowhere.md", to: "here.md" }])).toBeUndefined();
  });
});

describe("applySuggestions", () => {
  test("replaces text within a line, across lines, and deletes", () => {
    const made = applySuggestions(readme, [
      suggestion({ from: 3, to: 3, start: 0, end: 3, replacement: "New" }),
      suggestion({ from: 1, to: 2, start: 2, end: 3, replacement: "Paper docs. See" }),
    ]);
    expect(made).toEqual({ text: "# Paper docs. See the agents docs.\nNew line here.\n" });
    expect(applySuggestions(readme, [suggestion({ from: 2, to: 3, start: 0, end: 0 })])).toEqual({ text: "# PaperNet\nOld line here.\n" });
  });

  test("puts new text in at a point, including where a replaced range starts or ends", () => {
    const made = applySuggestions("one two three", [
      suggestion({ start: 4, end: 7, replacement: "2" }),
      suggestion({ start: 4, end: 4, replacement: "and " }),
      suggestion({ start: 7, end: 7, replacement: "," }),
      suggestion({ start: 13, end: 13, replacement: "!" }),
    ]);
    expect(made).toEqual({ text: "one and 2, three!" });
  });

  test("a column past the end of its line is the end of the line", () => {
    expect(applySuggestions("ab\ncd", [suggestion({ start: 1, end: 99, replacement: "X" })])).toEqual({ text: "aX\ncd" });
  });

  test("refuses lines the text does not have, and overlapping suggestions", () => {
    expect(applySuggestions(readme, [suggestion({ from: 9, to: 9 })])).toHaveProperty("error");
    expect(
      applySuggestions(readme, [suggestion({ start: 0, end: 5 }), suggestion({ start: 4, end: 6 })]),
    ).toEqual({ error: "Two suggestions in one file overlap." });
  });
});

describe("proposalPatch", () => {
  const texts = new Map([
    ["README.md", readme],
    ["docs/agents.md", agents],
    ["main.py", "print('hi')\n"],
  ]);

  test("renames, creates, and edits in one git patch", () => {
    const result = proposalPatch({
      structure,
      operations: [
        { kind: "move", from: "README.md", to: "INDEX.md" },
        { kind: "createFile", path: "NEW.md" },
      ],
      suggestions: [
        suggestion({ from: 3, to: 3, start: 0, end: 3, replacement: "New" }),
        suggestion({ path: "main.py", start: 7, end: 9, replacement: "bye" }),
      ],
      texts,
    });
    expect("patch" in result).toBe(true);
    const { patch } = result as { patch: string };
    expect(patch).toContain("diff --git a/README.md b/INDEX.md\nrename from README.md\nrename to INDEX.md\n");
    expect(patch).toContain("-Old line here.\n+New line here.\n");
    expect(patch).toContain("diff --git a/NEW.md b/NEW.md\nnew file mode 100644\n");
    expect(patch).toContain("diff --git a/main.py b/main.py\n");
    expect(patch).toContain("-print('hi')\n+print('bye')\n");
    // The agents doc is neither moved nor edited.
    expect(patch).not.toContain("agents.md");
  });

  test("a rename with no edits has no hunk", () => {
    const result = proposalPatch({ structure, operations: [{ kind: "move", from: "docs", to: "guides" }], suggestions: [], texts: new Map() });
    expect(result).toEqual({ patch: expect.stringContaining("rename from docs/agents.md\nrename to guides/agents.md\n") });
    expect((result as { patch: string }).patch).not.toContain("@@");
  });

  test("nothing to change is an empty patch, and folders are left out", () => {
    expect(proposalPatch({ structure, operations: [{ kind: "createFolder", path: "empty" }], suggestions: [], texts })).toEqual({ patch: "" });
    expect(proposalPatch({ structure, operations: [], suggestions: [suggestion({ replacement: "#" })], texts })).toEqual({ patch: "" });
  });

  test("answers an error for a missing text, or changes that do not fit", () => {
    expect(proposalPatch({ structure, operations: [], suggestions: [suggestion({})], texts: new Map() })).toEqual({
      error: "The text of README.md is missing.",
    });
    expect(proposalPatch({ structure, operations: [{ kind: "removeFolder", path: "docs" }], suggestions: [], texts })).toHaveProperty("error");
  });
});
