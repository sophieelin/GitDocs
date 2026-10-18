import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { composition as investigationsComposition } from "./compositions/Investigations.ts";
import { composition as policyComposition } from "./compositions/Policy.ts";
import { composition as proposalsComposition } from "./compositions/Proposals.ts";
import { composition as reviewsComposition } from "./compositions/Reviews.ts";
import { composition as reviewWorkflowComposition } from "./compositions/ReviewWorkflow.ts";
import { composition as sessionsComposition } from "./compositions/Sessions.ts";
import { applicationConceptSet } from "./concepts.ts";

export interface AssemblyInputs {
  /** Every concept stores its state in this database. */
  db: Db;
}

export function assembleApplication({ db }: AssemblyInputs) {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: applicationConceptSet.implementations("mongo", { db }),
    composition: {
      Sessions: sessionsComposition,
      Investigations: investigationsComposition,
      Proposals: proposalsComposition,
      Policy: policyComposition,
      ReviewWorkflow: reviewWorkflowComposition,
      Reviews: reviewsComposition,
    },
  });
}
