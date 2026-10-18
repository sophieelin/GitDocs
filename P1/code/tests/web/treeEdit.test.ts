import { describe, expect, test } from "bun:test";
import type { DocumentationFolder } from "../../src/github/documentationTree.ts";
import { createFolder, folderPaths, move, removeFolder, rename, type Edit } from "../../web/src/tree/edit.ts";

// Example tree for these tests only.
function sample(): DocumentationFolder {
  return {
    name: "",
    path: "",
    files: [{ name: "index.md", path: "index.md" }],
    folders: [
      {
        name: "docs",
        path: "docs",
        files: [{ name: "setup.md", path: "docs/setup.md" }],
        folders: [{ name: "api", path: "docs/api", files: [{ name: "users.md", path: "docs/api/users.md" }], folders: [] }],
      },
      { name: "empty", path: "empty", files: [], folders: [] },
    ],
  };
}

function tree(edit: Edit): DocumentationFolder {
  if ("error" in edit) throw new Error(`refused: ${edit.error}`);
  return edit.tree;
}

function refusal(edit: Edit): string {
  if (!("error" in edit)) throw new Error("expected a refusal");
  return edit.error;
}

describe("rename", () => {
  test("renames a file and keeps the given tree as it was", () => {
    const before = sample();
    const after = tree(rename(before, "docs/setup.md", "install.md"));
    expect(after.folders[0]!.files).toEqual([{ name: "install.md", path: "docs/install.md" }]);
    expect(before).toEqual(sample());
  });

  test("renaming a folder updates every path below it", () => {
    const after = tree(rename(sample(), "docs", "guide"));
    const guide = after.folders.find((folder) => folder.name === "guide")!;
    expect(guide.path).toBe("guide");
    expect(guide.files[0]!.path).toBe("guide/setup.md");
    expect(guide.folders[0]!.path).toBe("guide/api");
    expect(guide.folders[0]!.files[0]!.path).toBe("guide/api/users.md");
  });

  test("refuses a name collision, an empty or slashed name, a non-Markdown file name, and a missing entry", () => {
    expect(refusal(rename(sample(), "index.md", "docs"))).toContain("already");
    expect(refusal(rename(sample(), "index.md", "  "))).toBe("Give it a name.");
    expect(refusal(rename(sample(), "index.md", "a/b.md"))).toContain("/");
    expect(refusal(rename(sample(), "index.md", "index.txt"))).toContain(".md");
    expect(refusal(rename(sample(), "nowhere.md", "x.md"))).toContain("not in");
  });

  test("the same name changes nothing", () => {
    expect(tree(rename(sample(), "index.md", "index.md"))).toEqual(sample());
  });
});

describe("move", () => {
  test("moves a file into another folder, with its new path", () => {
    const after = tree(move(sample(), "docs/api/users.md", "docs"));
    expect(after.folders[0]!.files.map((file) => file.path)).toEqual(["docs/setup.md", "docs/users.md"]);
    expect(after.folders[0]!.folders[0]!.files).toEqual([]);
  });

  test("moves a folder with everything in it", () => {
    const after = tree(move(sample(), "docs/api", "empty"));
    const empty = after.folders.find((folder) => folder.name === "empty")!;
    expect(empty.folders[0]!.path).toBe("empty/api");
    expect(empty.folders[0]!.files[0]!.path).toBe("empty/api/users.md");
  });

  test("refuses moving a folder into itself or below itself, a collision, and staying put", () => {
    expect(refusal(move(sample(), "docs", "docs"))).toContain("itself");
    expect(refusal(move(sample(), "docs", "docs/api"))).toContain("itself");
    expect(refusal(move(tree(createFolder(sample(), "empty", "api")), "docs/api", "empty"))).toContain("already");
    expect(refusal(move(sample(), "docs/setup.md", "docs"))).toContain("already in");
    expect(refusal(move(sample(), "index.md", "nowhere"))).toContain("not in");
  });
});

describe("createFolder", () => {
  test("adds an empty folder in sorted order", () => {
    const after = tree(createFolder(sample(), "", "concepts"));
    expect(after.folders.map((folder) => folder.path)).toEqual(["concepts", "docs", "empty"]);
  });

  test("refuses a collision with a file or folder, and a bad name", () => {
    expect(refusal(createFolder(sample(), "", "index.md"))).toContain("already");
    expect(refusal(createFolder(sample(), "docs", "api"))).toContain("already");
    expect(refusal(createFolder(sample(), "", ".."))).toContain("not allowed");
  });
});

describe("removeFolder", () => {
  test("removes an empty folder", () => {
    expect(tree(removeFolder(sample(), "empty")).folders.map((folder) => folder.name)).toEqual(["docs"]);
  });

  test("refuses a folder that holds anything, a file, and the root", () => {
    expect(refusal(removeFolder(sample(), "docs"))).toContain("empty");
    expect(refusal(removeFolder(sample(), "index.md"))).toContain("not in");
    expect(refusal(removeFolder(sample(), ""))).toContain("not in");
  });
});

test("folderPaths lists the root first, then every folder", () => {
  expect(folderPaths(sample())).toEqual(["", "docs", "docs/api", "empty"]);
});
