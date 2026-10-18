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

/**
 * The shape of a submission. The concept checks the rules (a title, at least one
 * affected file with a reason, at least one evidence item); this only rejects
 * values a real request should never carry.
 */
export const submitInvestigationInput = validator(
  (value) =>
    hasOnly(value, ["session", "owner", "name", "commit", "title", "affected", "evidence"]) &&
    hasSession(value) &&
    hasRepository(value) &&
    text(value.commit, 64) &&
    typeof value.title === "string" &&
    value.title.length <= 200 &&
    Array.isArray(value.affected) &&
    value.affected.length <= 100 &&
    value.affected.every(
      (item) =>
        record(item) &&
        hasOnly(item, ["path", "reason"]) &&
        typeof item.path === "string" &&
        item.path.length <= 500 &&
        typeof item.reason === "string" &&
        item.reason.length <= 2000,
    ) &&
    Array.isArray(value.evidence) &&
    value.evidence.length <= 100 &&
    value.evidence.every((item) => typeof item === "string" && item.length <= 2000),
  "an investigation needs bounded strings, an affected list of paths with reasons, and an evidence list of texts",
);

export const investigationIdInput = validator(
  (value) => hasOnly(value, ["session", "investigation"]) && hasSession(value) && text(value.investigation, 128),
  "session and investigation must be bounded strings",
);

export const repositoryInput = validator(
  (value) => hasOnly(value, ["session", "owner", "name"]) && hasSession(value) && hasRepository(value),
  "session, owner, and name must be bounded strings",
);

export const commitInput = validator(
  (value) => hasOnly(value, ["session", "owner", "name", "commit"]) && hasSession(value) && hasRepository(value) && text(value.commit, 64),
  "session, owner, name, and commit must be bounded strings",
);

export const submittedInvestigationOutput = validator(
  (value) => hasOnly(value, ["investigation"]) && typeof value.investigation === "string",
  "response must contain an investigation identity",
);

export const investigationOutput = validator(
  (value) => {
    const detail = value.investigation;
    return (
      hasOnly(value, ["investigation"]) &&
      record(detail) &&
      hasOnly(detail, ["investigation", "owner", "name", "commit", "investigator", "title", "submittedAt", "affected", "evidence"]) &&
      ["investigation", "owner", "name", "commit", "investigator", "title"].every((key) => typeof detail[key] === "string") &&
      detail.submittedAt instanceof Date &&
      Array.isArray(detail.affected) &&
      detail.affected.every((item) => record(item) && typeof item.path === "string" && typeof item.reason === "string") &&
      Array.isArray(detail.evidence) &&
      detail.evidence.every((item) => record(item) && typeof item.text === "string")
    );
  },
  "response must contain an investigation with its affected documentation and evidence",
);

/** A list of investigation summaries under `key`, each with the given fields plus title and Date submitted. */
function summaries(key: string, fields: readonly string[]) {
  return validator(
    (value) => {
      const holder = value[key];
      return (
        hasOnly(value, [key]) &&
        record(holder) &&
        hasOnly(holder, ["investigations"]) &&
        Array.isArray(holder.investigations) &&
        holder.investigations.every(
          (item) =>
            record(item) &&
            hasOnly(item, [...fields, "title", "submittedAt"]) &&
            [...fields, "title"].every((field) => typeof item[field] === "string") &&
            item.submittedAt instanceof Date,
        )
      );
    },
    `response must contain the ${key}'s investigations`,
  );
}

export const repositoryInvestigationsOutput = summaries("repository", ["investigation", "commit", "investigator"]);
export const commitInvestigationsOutput = summaries("commit", ["investigation", "investigator"]);

/**
 * The concept checks a structure's shape and size; this only requires an object,
 * as a documentation tree's root folder is.
 */
function hasStructure(value: unknown): boolean {
  return record(value);
}

export const createProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "investigation", "title", "currentStructure"]) &&
    hasSession(value) &&
    text(value.investigation, 128) &&
    typeof value.title === "string" &&
    value.title.length <= 200 &&
    hasStructure(value.currentStructure),
  "session and investigation must be bounded strings, title a string, and currentStructure a documentation folder",
);

export const modifyProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "proposal", "title", "proposedStructure", "rationale"]) &&
    hasSession(value) &&
    text(value.proposal, 128) &&
    typeof value.title === "string" &&
    value.title.length <= 200 &&
    hasStructure(value.proposedStructure) &&
    typeof value.rationale === "string" &&
    value.rationale.length <= 10_000,
  "session and proposal must be bounded strings, title and rationale strings, and proposedStructure a documentation folder",
);

export const proposalIdInput = validator(
  (value) => hasOnly(value, ["session", "proposal"]) && hasSession(value) && text(value.proposal, 128),
  "session and proposal must be bounded strings",
);

/** Every proposal change answers the proposal's identity. */
export const proposalIdentityOutput = validator(
  (value) => hasOnly(value, ["proposal"]) && typeof value.proposal === "string",
  "response must contain a proposal identity",
);

export const proposalOutput = validator(
  (value) => {
    const detail = value.proposal;
    return (
      hasOnly(value, ["proposal"]) &&
      record(detail) &&
      hasOnly(detail, [
        "proposal",
        "author",
        "investigation",
        "owner",
        "name",
        "commit",
        "title",
        "rationale",
        "status",
        "currentStructure",
        "proposedStructure",
        "createdAt",
        "updatedAt",
      ]) &&
      ["proposal", "author", "investigation", "owner", "name", "commit", "title", "rationale", "status"].every(
        (key) => typeof detail[key] === "string",
      ) &&
      hasStructure(detail.currentStructure) &&
      hasStructure(detail.proposedStructure) &&
      detail.createdAt instanceof Date &&
      detail.updatedAt instanceof Date
    );
  },
  "response must contain a proposal with both of its structures",
);
