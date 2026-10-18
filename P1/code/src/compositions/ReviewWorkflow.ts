/**
 * Reactions that keep a proposal's status in step with its review's decision.
 * RestructuringDocumentation stays the authority on the status; a review only
 * asks it to change.
 */
import { reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { RestructuringDocumentation, ReviewingDocumentation } = concepts;

const ApprovalApprovesProposal = reaction(({ review, at, proposal }) =>
  when(ReviewingDocumentation.approve({ review, at }).responds({}))
    .where(ReviewingDocumentation._get({ review }).is({ proposal }))
    .then(RestructuringDocumentation.approve({ restructuring: proposal, at })),
);

export const composition = { ApprovalApprovesProposal };
