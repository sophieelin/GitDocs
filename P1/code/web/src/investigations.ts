import { api } from "./api.ts";
import type { RepositoryRef } from "./repository.ts";
import { sessionInput } from "./session.ts";

/** Lines `from` to `to` (1-based) of one documentation file, and why they do not work. */
export interface Highlight {
  path: string;
  from: number;
  to: number;
  comment: string;
}

/**
 * The investigation endpoints, with the session added. Like the generated
 * client, these never throw for an API error: they return `{ error }`.
 */
export function submitInvestigation(
  repository: RepositoryRef,
  commit: string,
  submission: { title: string; highlights: Highlight[] },
) {
  return api.investigations.submit({ ...sessionInput(), ...repository, commit, ...submission });
}

export function getInvestigation(investigation: string) {
  return api.investigations.get({ ...sessionInput(), investigation });
}

export function listInvestigations(repository: RepositoryRef) {
  return api.investigations.list({ ...sessionInput(), ...repository });
}

export function listCommitInvestigations(repository: RepositoryRef, commit: string) {
  return api.investigations["for-commit"]({ ...sessionInput(), ...repository, commit });
}

/** "Oct 18, 2026, 9:05 AM" in the viewer's own time zone. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
