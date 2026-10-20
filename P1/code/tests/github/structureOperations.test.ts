import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildDocumentationTree, type DocumentationFolder } from "../../src/github/documentationTree.ts";
import { applyOperations, gitCommands, parseOperations, type Applied, type Operation } from "../../src/github/structureOperations.ts";

// Example tree for these tests only: one overloaded payments page, as in a module split.
function sample(): DocumentationFolder {
  return {
    name: "",
    path: "",
    files: [{ name: "README.md", path: "README.md" }],
    folders: [
      {
        name: "docs",
        path: "docs",
        files: [{ name: "payments.md", path: "docs/payments.md" }],
        folders: [{ name: "api", path: "docs/api", files: [{ name: "users.md", path: "docs/api/users.md" }], folders: [] }],
      },
      { name: "empty", path: "empty", files: [], folders: [] },
    ],
  };
}

function tree(applied: Applied): DocumentationFolder {
  if ("error" in applied) throw new Error(`refused at ${applied.index}: ${applied.error}`);
  return applied.tree;
}

function refusal(applied: Applied): { error: string; index: number } {
  if (!("error" in applied)) throw new Error("expected a refusal");
  return applied;
}

/** Every file path in the tree, sorted, to compare structures without caring about order. */
function filePaths(folder: DocumentationFolder): string[] {
  const paths = folder.files.map((file) => file.path);
  for (const child of folder.folders) paths.push(...filePaths(child));
  return paths.sort();
}

describe("parseOperations", () => {
  test("keeps each change's known fields", () => {
    expect(
      parseOperations([
        { kind: "move", from: "a.md", to: "b.md", extra: 1 },
        { kind: "createFile", path: "c.md" },
        { kind: "createFolder", path: "d" },
        { kind: "removeFolder", path: "e" },
      ]),
    ).toEqual([
      { kind: "move", from: "a.md", to: "b.md" },
      { kind: "createFile", path: "c.md" },
      { kind: "createFolder", path: "d" },
      { kind: "removeFolder", path: "e" },
    ]);
  });

  test("an empty list is a list of changes", () => {
    expect(parseOperations([])).toEqual([]);
  });

  test("refuses anything that is not a list of known changes", () => {
    expect(parseOperations("move")).toBeUndefined();
    expect(parseOperations([{ kind: "delete", path: "a.md" }])).toBeUndefined();
    expect(parseOperations([{ kind: "move", from: "a.md" }])).toBeUndefined();
    expect(parseOperations([{ kind: "createFile", path: "" }])).toBeUndefined();
    expect(parseOperations([null])).toBeUndefined();
    expect(parseOperations(Array.from({ length: 1001 }, () => ({ kind: "createFolder", path: "x" })))).toBeUndefined();
  });
});

describe("applyOperations", () => {
  test("renames a file within its folder", () => {
    const result = tree(applyOperations(sample(), [{ kind: "move", from: "docs/payments.md", to: "docs/billing.md" }]));
    expect(result.folders[0]!.files).toEqual([{ name: "billing.md", path: "docs/billing.md" }]);
  });

  test("moves a folder, carrying its files' paths along", () => {
    const result = tree(applyOperations(sample(), [{ kind: "move", from: "docs/api", to: "api" }]));
    expect(filePaths(result)).toEqual(["README.md", "api/users.md", "docs/payments.md"]);
  });

  test("splits a page: new files and a folder, in order", () => {
    const result = tree(
      applyOperations(sample(), [
        { kind: "createFolder", path: "docs/payments" },
        { kind: "move", from: "docs/payments.md", to: "docs/payments/processing.md" },
        { kind: "createFile", path: "docs/payments/refunds.md" },
        { kind: "createFile", path: "docs/payments/billing.md" },
        { kind: "removeFolder", path: "empty" },
      ]),
    );
    expect(filePaths(result)).toEqual([
      "README.md",
      "docs/api/users.md",
      "docs/payments/billing.md",
      "docs/payments/processing.md",
      "docs/payments/refunds.md",
    ]);
    expect(result.folders.map((folder) => folder.name)).toEqual(["docs"]);
  });

  test("leaves the given tree untouched", () => {
    const original = sample();
    applyOperations(original, [{ kind: "move", from: "docs/api", to: "api" }]);
    expect(original).toEqual(sample());
  });

  test("refuses the first change that does not fit, saying which", () => {
    const refused = refusal(
      applyOperations(sample(), [
        { kind: "createFolder", path: "guides" },
        { kind: "move", from: "missing.md", to: "guides/missing.md" },
      ]),
    );
    expect(refused).toEqual({ error: "That file or folder is not in the proposed structure.", index: 1 });
  });

  test("refuses a file that would stop being Markdown", () => {
    expect(refusal(applyOperations(sample(), [{ kind: "move", from: "README.md", to: "README.txt" }])).error).toBe(
      "A documentation file's name must end in .md or .markdown.",
    );
    expect(refusal(applyOperations(sample(), [{ kind: "createFile", path: "notes.txt" }])).error).toBe(
      "A documentation file's name must end in .md or .markdown.",
    );
  });

  test("refuses a name that is already taken", () => {
    expect(refusal(applyOperations(sample(), [{ kind: "createFolder", path: "docs" }])).error).toBe(
      "There is already a “docs” in that folder.",
    );
    expect(refusal(applyOperations(sample(), [{ kind: "move", from: "docs/api/users.md", to: "README.md" }])).error).toBe(
      "There is already a “README.md” in that folder. Rename one of them first.",
    );
  });

  test("refuses moving a folder into itself, or anything onto itself", () => {
    expect(refusal(applyOperations(sample(), [{ kind: "move", from: "docs", to: "docs/api/docs" }])).error).toBe(
      "A folder cannot be moved into itself.",
    );
    expect(refusal(applyOperations(sample(), [{ kind: "move", from: "README.md", to: "README.md" }])).error).toBe(
      "It is already there.",
    );
  });

  test("removes only an empty folder", () => {
    expect(refusal(applyOperations(sample(), [{ kind: "removeFolder", path: "docs" }])).error).toBe(
      "Only an empty folder can be removed. Move its contents out first.",
    );
    expect(refusal(applyOperations(sample(), [{ kind: "removeFolder", path: "README.md" }])).error).toBe(
      "That folder is not in the proposed structure.",
    );
  });

  test("refuses a path that is not spelled as the tree spells it, or whose folder is missing", () => {
    expect(refusal(applyOperations(sample(), [{ kind: "createFile", path: "/new.md" }])).error).toBe(
      "That is not a path in the proposed structure.",
    );
    expect(refusal(applyOperations(sample(), [{ kind: "createFile", path: "guides/new.md" }])).error).toBe(
      "That folder is not in the proposed structure.",
    );
  });
});

describe("gitCommands", () => {
  test("a move into a folder the structure has needs no mkdir", () => {
    expect(gitCommands(sample(), [{ kind: "move", from: "README.md", to: "docs/README.md" }])).toEqual([
      "git mv 'README.md' 'docs/README.md'",
    ]);
  });

  test("a new folder is made once, then files move into it", () => {
    expect(
      gitCommands(sample(), [
        { kind: "createFolder", path: "docs/payments" },
        { kind: "move", from: "docs/payments.md", to: "docs/payments/processing.md" },
        { kind: "createFile", path: "docs/payments/refunds.md" },
      ]),
    ).toEqual([
      "mkdir -p 'docs/payments'",
      "git mv 'docs/payments.md' 'docs/payments/processing.md'",
      "touch 'docs/payments/refunds.md'",
      "git add 'docs/payments/refunds.md'",
    ]);
  });

  test("a moved folder moves its documentation files one by one", () => {
    expect(gitCommands(sample(), [{ kind: "move", from: "docs", to: "guides" }])).toEqual([
      "mkdir -p 'guides'",
      "git mv 'docs/payments.md' 'guides/payments.md'",
      "mkdir -p 'guides/api'",
      "git mv 'docs/api/users.md' 'guides/api/users.md'",
    ]);
  });

  test("a removed folder is rmdir", () => {
    expect(gitCommands(sample(), [{ kind: "removeFolder", path: "empty" }])).toEqual(["rmdir 'empty'"]);
  });

  test("quotes paths with spaces and single quotes", () => {
    expect(gitCommands(sample(), [{ kind: "createFile", path: "Ari's notes.md" }])).toEqual([
      "touch 'Ari'\\''s notes.md'",
      "git add 'Ari'\\''s notes.md'",
    ]);
  });

  test("answers no commands when the changes do not fit", () => {
    expect(gitCommands(sample(), [{ kind: "move", from: "missing.md", to: "found.md" }])).toEqual([]);
  });

  test("running the commands in a clone gives the proposed structure and leaves code in place", () => {
    const repo = mkdtempSync(join(tmpdir(), "structure-operations-"));
    try {
      const files = ["README.md", "docs/payments.md", "docs/api/users.md", "docs/api/client.ts"];
      for (const file of files) {
        mkdirSync(dirname(join(repo, file)), { recursive: true });
        writeFileSync(join(repo, file), `${file}\n`);
      }
      const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: repo });
      git("init", "-q");
      git("add", ".");
      git("-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qm", "start");

      const current = buildDocumentationTree(files.map((path) => ({ path, type: "file" as const })));
      const operations: Operation[] = [
        { kind: "move", from: "docs/api", to: "api" },
        { kind: "createFolder", path: "docs/payments" },
        { kind: "move", from: "docs/payments.md", to: "docs/payments/processing.md" },
        { kind: "createFile", path: "docs/payments/refunds.md" },
        { kind: "move", from: "README.md", to: "docs/README.md" },
      ];
      const script = gitCommands(current, operations).join("\n");
      const run = Bun.spawnSync(["sh", "-e", "-c", script], { cwd: repo });
      expect(run.exitCode).toBe(0);

      const listed = new TextDecoder().decode(git("ls-files").stdout).trim().split("\n");
      const after = buildDocumentationTree(listed.map((path) => ({ path, type: "file" as const })));
      expect(filePaths(after)).toEqual(filePaths(tree(applyOperations(current, operations))));
      expect(listed).toContain("docs/api/client.ts");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
