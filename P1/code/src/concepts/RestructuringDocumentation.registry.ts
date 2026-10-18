import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import {
  InvalidProposalSource,
  InvalidProposalTitle,
  InvalidStructure,
  NotDraft,
  NotProposalAuthor,
  ProposalNotFound,
  ProposalNotPending,
  RationaleMissing,
  RestructuringDocumentationConcept,
} from "./RestructuringDocumentation.ts";
import spec from "@design/concepts/RestructuringDocumentation.md" with { type: "text" };

export const restructuringDocumentation = registerConcept({
  class: RestructuringDocumentationConcept,
  spec,
  refusals: {
    INVALID_PROPOSAL_SOURCE: InvalidProposalSource,
    INVALID_PROPOSAL_TITLE: InvalidProposalTitle,
    INVALID_STRUCTURE: InvalidStructure,
    PROPOSAL_NOT_FOUND: ProposalNotFound,
    NOT_PROPOSAL_AUTHOR: NotProposalAuthor,
    NOT_DRAFT: NotDraft,
    RATIONALE_MISSING: RationaleMissing,
    PROPOSAL_NOT_PENDING: ProposalNotPending,
  },
  floors: {
    mongo: ({ db }: { db: Db }) => new RestructuringDocumentationConcept(db),
  },
});
