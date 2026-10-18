import { describe, expect, test } from "bun:test";
import { buildDocumentationTree } from "../../src/github/documentationTree.ts";
import type { TreeEntry } from "../../src/github/types.ts";

const file = (path: string): TreeEntry => ({ path, type: "file" });
const dir = (path: string): TreeEntry => ({ path, type: "directory" });

describe("buildDocumentationTree", () => {
  test("keeps Markdown files at the repository root", () => {
    const tree = buildDocumentationTree([file("README.md"), file("CONTRIBUTING.md"), file("package.json")]);

    expect(tree).toEqual({
      name: "",
      path: "",
      folders: [],
      files: [
        { name: "CONTRIBUTING.md", path: "CONTRIBUTING.md" },
        { name: "README.md", path: "README.md" },
      ],
    });
  });

  test("nests files in their folders, keeping real paths", () => {
    const tree = buildDocumentationTree([
      dir("docs"),
      dir("docs/api"),
      file("docs/api/user.md"),
      file("docs/api/auth.md"),
      dir("docs/guides"),
      file("docs/guides/deployment.md"),
    ]);

    expect(tree.files).toEqual([]);
    expect(tree.folders).toEqual([
      {
        name: "docs",
        path: "docs",
        files: [],
        folders: [
          {
            name: "api",
            path: "docs/api",
            folders: [],
            files: [
              { name: "auth.md", path: "docs/api/auth.md" },
              { name: "user.md", path: "docs/api/user.md" },
            ],
          },
          {
            name: "guides",
            path: "docs/guides",
            folders: [],
            files: [{ name: "deployment.md", path: "docs/guides/deployment.md" }],
          },
        ],
      },
    ]);
  });

  test("finds documentation outside docs/", () => {
    const tree = buildDocumentationTree([
      file("README.md"),
      file("csail_hack/lib/agents/README.md"),
      file("csail_hack/lib/agents/run.py"),
    ]);

    const agents = tree.folders[0]!.folders[0]!.folders[0]!;
    expect(agents.path).toBe("csail_hack/lib/agents");
    expect(agents.files).toEqual([{ name: "README.md", path: "csail_hack/lib/agents/README.md" }]);
  });

  test("leaves out folders with no Markdown inside them", () => {
    const tree = buildDocumentationTree([dir("src"), file("src/index.ts"), dir("docs"), file("docs/a.md")]);

    expect(tree.folders.map((f) => f.name)).toEqual(["docs"]);
  });

  test("accepts .markdown and any letter case", () => {
    const tree = buildDocumentationTree([file("NOTES.MD"), file("guide.markdown"), file("notes.txt")]);

    expect(tree.files.map((f) => f.name)).toEqual(["guide.markdown", "NOTES.MD"]);
  });

  test("returns an empty root when there is no Markdown", () => {
    expect(buildDocumentationTree([dir("src"), file("src/index.ts")])).toEqual({
      name: "",
      path: "",
      folders: [],
      files: [],
    });
    expect(buildDocumentationTree([])).toEqual({ name: "", path: "", folders: [], files: [] });
  });
});
