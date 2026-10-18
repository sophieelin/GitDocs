/**
 * Runtime endpoint validators shared by the composition modules.
 *
 * Generated TypeScript types only constrain callers that compile against the
 * wire contract; these functions reject the untyped values a real request can
 * carry. Error responses are written by the HTTP handler and never pass
 * through an output validator.
 */
import type { EndpointValidator } from "@mit-sdg/sync-engine/boundary";

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when `value` has exactly these keys, no more and no fewer. */
export function hasOnly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function validator(accepts: (value: Record<string, unknown>) => boolean, detail: string): EndpointValidator {
  return (value) => (record(value) && accepts(value) ? { ok: true } : { ok: false, detail });
}

/** Sessions are sent in the JSON body, not in a cookie. */
function hasSession(value: Record<string, unknown>): boolean {
  return typeof value.session === "string" && value.session.length > 0 && value.session.length <= 128;
}

export const credentialsInput = validator(
  (value) =>
    hasOnly(value, ["username", "password"]) &&
    typeof value.username === "string" &&
    typeof value.password === "string" &&
    value.username.length <= 32 &&
    value.password.length <= 128,
  "username and password must be bounded strings",
);

export const sessionOnlyInput = validator(
  (value) => hasOnly(value, ["session"]) && hasSession(value),
  "session must be a non-empty string",
);

export const usernameOutput = validator(
  (value) => hasOnly(value, ["username"]) && typeof value.username === "string",
  "response must contain a username",
);

export const signedOutOutput = validator(
  (value) => hasOnly(value, ["signedOut"]) && value.signedOut === true,
  "response must confirm sign-out",
);

export const issuedSessionOutput = validator(
  (value) =>
    hasOnly(value, ["account", "session", "expiresAt"]) &&
    typeof value.account === "string" &&
    typeof value.session === "string" &&
    value.expiresAt instanceof Date,
  "response must contain account, session, and Date expiry",
);
