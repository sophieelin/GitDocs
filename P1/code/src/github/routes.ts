/**
 * Plain HTTP routes that read public repositories from GitHub. They are not
 * sync-engine endpoints: they store nothing and make no decisions, so there is
 * no concept behind them (decision of 2026-10-17). They answer JSON POST
 * requests and errors in the same `{ "error": "…" }` shape as the endpoints.
 */
import { hasOnly, record } from "../compositions/validators.ts";
import {
  CommitNotFound,
  GitHubNotFound,
  GitHubRateLimited,
  GitHubRequestFailed,
  InvalidCommitSha,
  InvalidRepositoryName,
} from "./GitHubApi.ts";
import type { GitHubFetcher } from "./GitHubFetcher.ts";
import { buildDocumentationTree, buildFileTree, isDocumentation, type DocumentationFolder } from "./documentationTree.ts";
import type { Commit, CommitDetails } from "./types.ts";

export interface CommitsResponse {
  commits: Commit[];
}

/** One commit and every file it changed, and whether any of them is documentation. */
export interface CommitResponse {
  commit: CommitDetails;
  changesDocumentation: boolean;
}

export interface TreeResponse {
  /** The Markdown files, in their folders: the Documentation Structure. */
  tree: DocumentationFolder;
  /** Every file, in its folders: the Code Structure. */
  code: DocumentationFolder;
  /** True when GitHub returned only part of a very large repository. */
  truncated: boolean;
}

export interface GitHubRoutesOptions {
  github: GitHubFetcher;
  /** Resolves a session to its username, or `undefined` when it is not active. */
  currentUser: (session: string) => Promise<string | undefined>;
  basePath: string;
}

const MAX_BODY_CHARS = 10_000;

/** Answers the GitHub routes, and returns `undefined` for every other path. */
export function createGitHubRoutes({ github, currentUser, basePath }: GitHubRoutesOptions) {
  const commitsPath = `${basePath}/github/commits`;
  const treePath = `${basePath}/github/tree`;
  const commitPath = `${basePath}/github/commit`;

  return async (request: Request): Promise<Response | undefined> => {
    const path = new URL(request.url).pathname;
    if (path !== commitsPath && path !== treePath && path !== commitPath) return undefined;
    if (request.method !== "POST") return error("INVALID_REQUEST", 400);

    const input = await readJson(request);
    const keys = path === commitsPath ? ["session", "owner", "name"] : ["session", "owner", "name", "sha"];
    if (!record(input) || !hasOnly(input, keys) || !keys.every((key) => boundedString(input[key]))) {
      return error("INVALID_REQUEST", 400);
    }

    if ((await currentUser(input.session as string)) === undefined) return error("UNAUTHORIZED", 401);

    const repository = { owner: input.owner as string, name: input.name as string };
    try {
      if (path === commitsPath) {
        return json({ commits: await github.listCommits(repository) } satisfies CommitsResponse);
      }
      if (path === commitPath) {
        const commit = await github.getCommit(repository, input.sha as string);
        return json({
          commit,
          // A rename counts if either the old or the new path is documentation.
          changesDocumentation: commit.files.some(
            (file) => isDocumentation(file.path) || (file.previousPath !== undefined && isDocumentation(file.previousPath)),
          ),
        } satisfies CommitResponse);
      }
      const tree = await github.getTree(repository, input.sha as string);
      return json({
        tree: buildDocumentationTree(tree.entries),
        code: buildFileTree(tree.entries),
        truncated: tree.truncated,
      } satisfies TreeResponse);
    } catch (failure) {
      // A malformed name or SHA is, to the user, the same mistake as a missing one.
      if (
        failure instanceof GitHubNotFound ||
        failure instanceof CommitNotFound ||
        failure instanceof InvalidRepositoryName ||
        failure instanceof InvalidCommitSha
      ) {
        return error("NOT_FOUND", 404);
      }
      if (failure instanceof GitHubRateLimited || failure instanceof GitHubRequestFailed) {
        return error("GITHUB_UNAVAILABLE", 503);
      }
      console.error(failure);
      return error("INTERNAL_ERROR", 500);
    }
  };
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function boundedString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function error(code: string, status: number): Response {
  return json({ error: code }, status);
}
