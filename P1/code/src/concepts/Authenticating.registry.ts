import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { AuthenticatingConcept, InvalidIdentity, UsernameTaken } from "./Authenticating.ts";
import spec from "@design/concepts/Authenticating.md" with { type: "text" };

export const authenticating = registerConcept({
  class: AuthenticatingConcept,
  spec,
  refusals: {
    INVALID_IDENTITY: InvalidIdentity,
    USERNAME_TAKEN: UsernameTaken,
  },
  floors: {
    mongo: ({ db }: { db: Db }) => new AuthenticatingConcept(db),
  },
});
