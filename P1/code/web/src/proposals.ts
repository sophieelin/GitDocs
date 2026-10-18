import { api } from "./api.ts";
import type { DocumentationFolder } from "./github.ts";
import type { RepositoryRef } from "./repository.ts";
import { sessionInput } from "./session.ts";

/**
 * The proposal endpoints, with the session added. Like the generated client,
 * these never throw for an API error: they return `{ error }`.
 */
export function createProposal(investigation: string, title: string, currentStructure: DocumentationFolder) {
  return api.proposals.create({ ...sessionInput(), investigation, title, currentStructure });
}

export function modifyProposal(
  proposal: string,
  draft: { title: string; proposedStructure: DocumentationFolder; rationale: string },
) {
  return api.proposals.modify({ ...sessionInput(), proposal, ...draft });
}

export function submitProposal(proposal: string) {
  return api.proposals.submit({ ...sessionInput(), proposal });
}

export function discardProposal(proposal: string) {
  return api.proposals.discard({ ...sessionInput(), proposal });
}

export function getProposal(proposal: string) {
  return api.proposals.get({ ...sessionInput(), proposal });
}

export function listProposals(repository: RepositoryRef) {
  return api.proposals.list({ ...sessionInput(), ...repository });
}

/** The messages for a proposal change, by error category. */
export const proposalErrorMessages = {
  NOT_FOUND: "This proposal no longer exists.",
  FORBIDDEN: "Only the proposal's author can change it.",
  CONFLICT: "This proposal has been submitted and can no longer change.",
  INVALID_REQUEST: "Check the title and the proposed structure.",
};
