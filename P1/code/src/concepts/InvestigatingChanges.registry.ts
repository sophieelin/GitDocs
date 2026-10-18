import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import {
  InvalidAffectedDocumentation,
  InvalidCommit,
  InvalidEvidence,
  InvalidRepository,
  InvalidTitle,
  InvestigatingChangesConcept,
} from "./InvestigatingChanges.ts";
import spec from "@design/concepts/InvestigatingChanges.md" with { type: "text" };

export const investigatingChanges = registerConcept({
  class: InvestigatingChangesConcept,
  spec,
  refusals: {
    INVALID_REPOSITORY: InvalidRepository,
    INVALID_COMMIT: InvalidCommit,
    INVALID_TITLE: InvalidTitle,
    INVALID_AFFECTED_DOCUMENTATION: InvalidAffectedDocumentation,
    INVALID_EVIDENCE: InvalidEvidence,
  },
  floors: {
    mongo: ({ db }: { db: Db }) => new InvestigatingChangesConcept(db),
  },
});
