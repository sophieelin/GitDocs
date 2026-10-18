import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { authenticating } from "./concepts/Authenticating.registry.ts";
import { investigatingChanges } from "./concepts/InvestigatingChanges.registry.ts";
import { restructuringDocumentation } from "./concepts/RestructuringDocumentation.registry.ts";
import { sessioning } from "./concepts/Sessioning.registry.ts";

export const applicationConceptSet = conceptSet({
  Authenticating: authenticating,
  Sessioning: sessioning,
  InvestigatingChanges: investigatingChanges,
  RestructuringDocumentation: restructuringDocumentation,
});
export const { concepts } = applicationConceptSet;
