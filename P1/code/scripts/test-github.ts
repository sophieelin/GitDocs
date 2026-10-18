// Reads a public GitHub repository and prints its documentation tree.
//
//   bun scripts/test-github.ts <owner>/<name> [commit-sha]
//
// Uses the newest commit unless a SHA is given. Set GITHUB_TOKEN for a higher rate limit.
import { GitHubError, gitHubApiFromEnv } from "../src/github/GitHubApi.ts";
import { buildDocumentationTree, type DocumentationFolder } from "../src/github/documentationTree.ts";

const [repositoryArg, shaArg] = process.argv.slice(2);
const [owner, name] = repositoryArg?.split("/") ?? [];
if (!owner || !name) {
  console.error("Usage: bun scripts/test-github.ts <owner>/<name> [commit-sha]");
  process.exit(1);
}

const api = gitHubApiFromEnv();
const repository = { owner, name };

try {
  const commits = await api.listCommits(repository);
  console.log(`${owner}/${name}: ${commits.length} recent commits`);
  for (const commit of commits.slice(0, 10)) {
    console.log(`  ${commit.sha.slice(0, 7)}  ${commit.message.split("\n")[0]}`);
  }

  const sha = shaArg ?? commits[0]?.sha;
  if (!sha) {
    console.log("\nThe repository has no commits.");
    process.exit(0);
  }

  const tree = await api.getTree(repository, sha);
  const documentation = buildDocumentationTree(tree.entries);
  console.log(`\nDocumentation at ${sha.slice(0, 7)}:`);
  if (documentation.folders.length === 0 && documentation.files.length === 0) {
    console.log("  (no Markdown files)");
  } else {
    print(documentation, 1);
  }
  if (tree.truncated) console.log("\nWarning: GitHub returned only part of this repository's tree.");
} catch (error) {
  if (!(error instanceof GitHubError)) throw error;
  console.error(`${error.constructor.name}: ${error.message}`);
  process.exit(1);
}

function print(folder: DocumentationFolder, depth: number): void {
  const indent = "  ".repeat(depth);
  for (const child of folder.folders) {
    console.log(`${indent}${child.name}/`);
    print(child, depth + 1);
  }
  for (const file of folder.files) console.log(`${indent}${file.name}`);
}
