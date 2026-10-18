import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { composition as investigationsComposition } from "./compositions/Investigations.ts";
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
    },
  });
}
