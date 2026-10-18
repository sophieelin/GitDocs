import type { CommitResponse, CommitsResponse, TreeResponse } from "../../src/github/routes.ts";
import { sessionInput } from "./session.ts";

export type { CommitResponse, CommitsResponse, TreeResponse };
export type { ChangedFile } from "../../src/github/types.ts";
export type { DocumentationFolder, DocumentationFile } from "../../src/github/documentationTree.ts";

/** An API error, in the same shape as the sync-engine endpoints' errors. */
export type RouteError = { error: string };

/**
 * Calls the backend's plain GitHub routes (`plan-endpoints.md` E3). They are not
 * sync-engine endpoints, so they are not in the generated client. Like that client,
 * these never throw for an API error: they return `{ error }`.
 */
async function post<T>(path: string, body: object): Promise<T | RouteError> {
  try {
    const response = await fetch(`/api/github/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sessionInput(), ...body }),
    });
    return (await response.json()) as T | RouteError;
  } catch {
    return { error: "NETWORK_ERROR" };
  }
}

export function listCommits(owner: string, name: string) {
  return post<CommitsResponse>("commits", { owner, name });
}

export function readTree(owner: string, name: string, sha: string) {
  return post<TreeResponse>("tree", { owner, name, sha });
}

export function readCommit(owner: string, name: string, sha: string) {
  return post<CommitResponse>("commit", { owner, name, sha });
}

/** Messages shared by every screen that calls these routes. */
export const gitHubErrorMessages = {
  NOT_FOUND: "Repository not found. Only public repositories work.",
  GITHUB_UNAVAILABLE: "GitHub could not be reached. Try again later.",
  NETWORK_ERROR: "GitDocs could not be reached. Check that the backend is running.",
};
