import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import {
  HighlightNotFound,
  InvalidCommit,
  InvalidHighlight,
  InvalidOperations,
  InvalidRepository,
  InvalidStructure,
  InvalidTitle,
  InvestigatingChangesConcept,
  InvestigationNotFound,
  InvestigationNotPending,
  NotApproved,
  NotDraft,
  NoChanges,
  NotInvestigator,
  RationaleMissing,
  SuggestionsOverlap,
} from "./InvestigatingChanges.ts";
import spec from "@design/concepts/InvestigatingChanges.md" with { type: "text" };

export const investigatingChanges = registerConcept({
  class: InvestigatingChangesConcept,
  spec,
  refusals: {
    INVALID_REPOSITORY: InvalidRepository,
    INVALID_COMMIT: InvalidCommit,
    INVALID_TITLE: InvalidTitle,
    INVALID_STRUCTURE: InvalidStructure,
    INVESTIGATION_NOT_FOUND: InvestigationNotFound,
    NOT_INVESTIGATOR: NotInvestigator,
    NOT_DRAFT: NotDraft,
    INVALID_OPERATIONS: InvalidOperations,
    INVALID_HIGHLIGHT: InvalidHighlight,
    HIGHLIGHT_NOT_FOUND: HighlightNotFound,
    SUGGESTIONS_OVERLAP: SuggestionsOverlap,
    NO_CHANGES: NoChanges,
    RATIONALE_MISSING: RationaleMissing,
    INVESTIGATION_NOT_PENDING: InvestigationNotPending,
    NOT_APPROVED: NotApproved,
  },
  floors: {
    mongo: ({ db }: { db: Db }) => new InvestigatingChangesConcept(db),
  },
});
