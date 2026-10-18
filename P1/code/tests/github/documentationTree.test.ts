import { describe, expect, test } from "bun:test";
import { buildDocumentationTree, buildFileTree } from "../../src/github/documentationTree.ts";
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

  test("sorts numbered names by their number", () => {
    const tree = buildDocumentationTree([
      file("documentation/10-instances.md"),
      file("documentation/2-options.md"),
      file("documentation/1-promise.md"),
      file("documentation/quick-start.md"),
      file("chapter-10/a.md"),
      file("chapter-9/a.md"),
    ]);

    expect(tree.folders.map((f) => f.name)).toEqual(["chapter-9", "chapter-10", "documentation"]);
    expect(tree.folders[2]!.files.map((f) => f.name)).toEqual([
      "1-promise.md",
      "2-options.md",
      "10-instances.md",
      "quick-start.md",
    ]);
  });

  test("leaves out GitHub's .github/ folder, but keeps it in the code structure", () => {
    const entries = [
      file(".github/PULL_REQUEST_TEMPLATE.md"),
      file(".github/ISSUE_TEMPLATE/1-bug-report.md"),
      file(".github/workflows/test.yml"),
      file("docs/.github-notes.md"),
      file("README.md"),
    ];

    const docs = buildDocumentationTree(entries);
    expect(docs.files.map((f) => f.path)).toEqual(["README.md"]);
    expect(docs.folders.map((f) => f.path)).toEqual(["docs"]);

    const code = buildFileTree(entries);
    expect(code.folders.map((f) => f.path)).toEqual([".github", "docs"]);
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

describe("buildFileTree", () => {
  test("keeps every file, code and documentation, in its folders", () => {
    const tree = buildFileTree([dir("src"), file("src/index.ts"), file("src/util/log.ts"), file("README.md")]);

    expect(tree.files.map((f) => f.path)).toEqual(["README.md"]);
    expect(tree.folders[0]!.files.map((f) => f.path)).toEqual(["src/index.ts"]);
    expect(tree.folders[0]!.folders[0]!.files.map((f) => f.path)).toEqual(["src/util/log.ts"]);
  });

  test("leaves out empty directories", () => {
    expect(buildFileTree([dir("empty"), file("a.ts")]).folders).toEqual([]);
  });
});
