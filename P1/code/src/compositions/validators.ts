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

/** A non-empty string no longer than `max`. */
function text(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/** A repository's owner and name, as GitHub limits them. */
function hasRepository(value: Record<string, unknown>): boolean {
  return text(value.owner, 100) && text(value.name, 100);
}

export const openInvestigationInput = validator(
  (value) => hasOnly(value, ["session", "owner", "name", "commit"]) && hasSession(value) && hasRepository(value) && text(value.commit, 64),
  "session, owner, name, and commit must be bounded strings",
);

export const investigationIdInput = validator(
  (value) => hasOnly(value, ["session", "investigation"]) && hasSession(value) && text(value.investigation, 128),
  "session and investigation must be bounded strings",
);

export const repositoryInput = validator(
  (value) => hasOnly(value, ["session", "owner", "name"]) && hasSession(value) && hasRepository(value),
  "session, owner, and name must be bounded strings",
);

export const openedInvestigationOutput = validator(
  (value) => hasOnly(value, ["investigation"]) && typeof value.investigation === "string",
  "response must contain an investigation identity",
);

export const investigationOutput = validator(
  (value) =>
    hasOnly(value, ["investigation", "owner", "name", "commit", "investigator", "openedAt"]) &&
    ["investigation", "owner", "name", "commit", "investigator"].every((key) => typeof value[key] === "string") &&
    value.openedAt instanceof Date,
  "response must contain an investigation's repository, commit, investigator, and Date opened",
);

export const repositoryInvestigationsOutput = validator(
  (value) => {
    const repository = value.repository;
    return (
      hasOnly(value, ["repository"]) &&
      record(repository) &&
      hasOnly(repository, ["investigations"]) &&
      Array.isArray(repository.investigations) &&
      repository.investigations.every(
        (item) =>
          record(item) &&
          hasOnly(item, ["investigation", "commit", "investigator", "openedAt"]) &&
          typeof item.investigation === "string" &&
          typeof item.commit === "string" &&
          typeof item.investigator === "string" &&
          item.openedAt instanceof Date,
      )
    );
  },
  "response must contain the repository's investigations",
);
