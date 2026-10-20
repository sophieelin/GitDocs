/**
 * Restructuring is this reaction, not a concept: approving a review approves
 * its investigation, which from then on gives the git commands that carry it
 * out. InvestigatingChanges stays the authority on the status; a review only
 * asks it to change.
 */
import { reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { InvestigatingChanges, ReviewingDocumentation } = concepts;

const ApprovalApprovesInvestigation = reaction(({ review, at, proposal }) =>
  when(ReviewingDocumentation.approve({ review, at }).responds({}))
    .where(ReviewingDocumentation._get({ review }).is({ proposal }))
    .then(InvestigatingChanges.approve({ investigation: proposal, at })),
);

export const composition = { ApprovalApprovesInvestigation };
