import { reactive, readonly } from "vue";
import type { AccessResponse } from "../../src/github/signInRoutes.ts";
import type { RepositoryRef } from "./repository.ts";
import { sessionInput } from "./session.ts";

/** What GitHub last said about each repository, by `owner/name` in lowercase; missing until it is asked. */
const state = reactive<Record<string, boolean>>({});

const key = ({ owner, name }: RepositoryRef) => `${owner}/${name}`.toLowerCase();

/**
 * Asks GitHub, with the user's own sign-in, whether they can push to the
 * repository. The server remembers the answer for 30 minutes, and changing or
 * approving proposals needs it, so this is asked whenever a repository's
 * workspace opens and again while it stays open. Never throws: an error is
 * `{ error }`, as from the other API calls.
 */
export async function checkAccess(repository: RepositoryRef): Promise<AccessResponse | { error: string }> {
  try {
    const response = await fetch("/api/github/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sessionInput(), ...repository }),
    });
    const body = (await response.json()) as AccessResponse | { error: string };
    if (!("error" in body)) state[key(repository)] = body.canPush;
    return body;
  } catch {
    return { error: "NETWORK_ERROR" };
  }
}

/** Whether the user can push to `repository`, or undefined until GitHub has been asked. */
export function canPush(repository: RepositoryRef): boolean | undefined {
  return readonly(state)[key(repository)];
}
