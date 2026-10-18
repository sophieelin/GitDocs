import { router } from "./router.ts";
import { clearSession } from "./session.ts";

/**
 * The API sends only an error category, never the concept's own code, so each
 * call site gives its own sentence per category: `CONFLICT` means "username
 * taken" on register but "already submitted" on a proposal.
 */
export type ErrorMessages = Partial<Record<string, string>>;

export const GENERAL_ERROR = "Something went wrong. Try again.";

/** The sentence to show for an API error, falling back to a general one with the error name. */
export function errorMessage(error: string, messages: ErrorMessages = {}): string {
  return messages[error] ?? `${GENERAL_ERROR} (${error})`;
}

/**
 * For every call except sign-in: `UNAUTHORIZED` means the session has ended, so
 * forget it and go to sign-in. Returns true when it handled the error.
 */
export function handleEndedSession(error: string): boolean {
  if (error !== "UNAUTHORIZED") return false;
  clearSession();
  void router.push({ path: "/sign-in", query: { redirect: router.currentRoute.value.fullPath } });
  return true;
}
