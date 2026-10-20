import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { InvalidRepository, NoPushAccess, RepositoryAccessConcept } from "./RepositoryAccess.ts";
import spec from "@design/concepts/RepositoryAccess.md" with { type: "text" };

export const repositoryAccess = registerConcept({
  class: RepositoryAccessConcept,
  spec,
  refusals: {
    INVALID_REPOSITORY: InvalidRepository,
    NO_PUSH_ACCESS: NoPushAccess,
  },
  floors: {
    mongo: ({ db }: { db: Db }) => new RepositoryAccessConcept(db),
  },
});
