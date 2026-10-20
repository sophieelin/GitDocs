import { api } from "./api.ts";
import type { DocumentationFolder } from "./github.ts";
import type { RepositoryRef } from "./repository.ts";
import { sessionInput } from "./session.ts";
import type { Operation } from "./tree/edit.ts";

/**
 * The proposal's comment on text in one file at its commit: from character
 * `start` of line `from` up to character `end` of line `to`. Lines count from
 * 1, characters from 0.
 */
export interface Highlight {
  highlight: string;
  path: string;
  from: number;
  to: number;
  start: number;
  end: number;
  text: string;
}

/**
 * The proposal endpoints, with the session added. Like the generated client,
 * these never throw for an API error: they return `{ error }`.
 */
export function startProposal(repository: RepositoryRef, commit: string, title: string, currentStructure: DocumentationFolder) {
  return api.proposals.start({ ...sessionInput(), ...repository, commit, title, currentStructure });
}

export function modifyProposal(proposal: string, draft: { title: string; operations: Operation[]; rationale: string }) {
  return api.proposals.modify({ ...sessionInput(), proposal, ...draft });
}

/** Submits the draft and asks `reviewer`, another account's username, to review it. */
export function submitProposal(proposal: string, reviewer: string) {
  return api.proposals.submit({ ...sessionInput(), proposal, reviewer });
}

/**
 * Highlights text in `file` at the proposal's commit, from character `start`
 * of line `from` to character `end` of line `to`; saved at once, not on Save.
 */
export function highlightProposal(
  proposal: string,
  highlight: { file: string; from: number; to: number; start: number; end: number; text: string },
) {
  return api.proposals.highlight({ ...sessionInput(), proposal, ...highlight });
}

export function unhighlightProposal(proposal: string, highlight: string) {
  return api.proposals.unhighlight({ ...sessionInput(), proposal, highlight });
}

export function discardProposal(proposal: string) {
  return api.proposals.discard({ ...sessionInput(), proposal });
}

/** Records `commit`, a full SHA, as the commit that made an approved proposal's changes. */
export function applyProposal(proposal: string, commit: string) {
  return api.proposals.apply({ ...sessionInput(), proposal, commit });
}

export function getProposal(proposal: string) {
  return api.proposals.get({ ...sessionInput(), proposal });
}

export function listProposals(repository: RepositoryRef) {
  return api.proposals.list({ ...sessionInput(), ...repository });
}

export function listCommitProposals(repository: RepositoryRef, commit: string) {
  return api.proposals["for-commit"]({ ...sessionInput(), ...repository, commit });
}

/** The repository's proposals waiting for the signed-in user's review. */
export function listReviewQueue(repository: RepositoryRef) {
  return api.proposals["under-review"]({ ...sessionInput(), ...repository });
}

/** Approves the review; answers the proposal with its new status. */
export function approveReview(review: string) {
  return api.reviews.approve({ ...sessionInput(), review });
}

/** The messages for a proposal change, by error category. */
export const proposalErrorMessages = {
  NOT_FOUND: "This proposal no longer exists.",
  FORBIDDEN: "Only the proposal's author can change it.",
  CONFLICT: "This proposal has been submitted and can no longer change.",
  INVALID_REQUEST: "Check the title and the changes to the structure.",
};

/** "Oct 18, 2026, 9:05 AM" in the viewer's own time zone. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
