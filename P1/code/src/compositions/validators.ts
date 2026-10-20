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


/** A non-empty string no longer than `max`. */
function text(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/** A repository's owner and name, as GitHub limits them. */
function hasRepository(value: Record<string, unknown>): boolean {
  return text(value.owner, 100) && text(value.name, 100);
}

export const repositoryInput = validator(
  (value) => hasOnly(value, ["session", "owner", "name"]) && hasSession(value) && hasRepository(value),
  "session, owner, and name must be bounded strings",
);

export const commitInput = validator(
  (value) => hasOnly(value, ["session", "owner", "name", "commit"]) && hasSession(value) && hasRepository(value) && text(value.commit, 64),
  "session, owner, name, and commit must be bounded strings",
);

/**
 * The concept checks a structure's shape and size; this only requires an object,
 * as a documentation tree's root folder is.
 */
function hasStructure(value: unknown): boolean {
  return record(value);
}

/** The concept checks that each change fits the structure; this only requires a bounded list of objects. */
function hasOperations(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 1000 && value.every(record);
}

export const startProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "owner", "name", "commit", "title", "currentStructure"]) &&
    hasSession(value) &&
    hasRepository(value) &&
    text(value.commit, 64) &&
    typeof value.title === "string" &&
    value.title.length <= 200 &&
    hasStructure(value.currentStructure),
  "session, owner, name, and commit must be bounded strings, title a string, and currentStructure a documentation folder",
);

export const modifyProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "proposal", "title", "operations", "rationale"]) &&
    hasSession(value) &&
    text(value.proposal, 128) &&
    typeof value.title === "string" &&
    value.title.length <= 200 &&
    hasOperations(value.operations) &&
    typeof value.rationale === "string" &&
    value.rationale.length <= 10_000,
  "session and proposal must be bounded strings, title and rationale strings, and operations a list of changes",
);

/** The concept checks the lines and text; this only rejects values a real request should never carry. */
export const highlightProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "proposal", "file", "from", "to", "start", "end", "text", "kind", "replacement"]) &&
    hasSession(value) &&
    text(value.proposal, 128) &&
    typeof value.file === "string" &&
    value.file.length <= 1000 &&
    ["from", "to", "start", "end"].every((key) => typeof value[key] === "number") &&
    typeof value.text === "string" &&
    value.text.length <= 2000 &&
    (value.kind === "COMMENT" || value.kind === "SUGGESTION") &&
    typeof value.replacement === "string" &&
    value.replacement.length <= 20_000,
  "session and proposal must be bounded strings, file, text, and replacement strings, kind COMMENT or SUGGESTION, and from, to, start, and end numbers",
);

export const unhighlightProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "proposal", "highlight"]) && hasSession(value) && text(value.proposal, 128) && text(value.highlight, 128),
  "session, proposal, and highlight must be bounded strings",
);

export const proposalHighlightOutput = validator(
  (value) => hasOnly(value, ["proposal", "highlight"]) && typeof value.proposal === "string" && typeof value.highlight === "string",
  "response must contain the proposal's and the new highlight's identities",
);

/** The concept checks that the commit is a full SHA. */
export const applyProposalInput = validator(
  (value) => hasOnly(value, ["session", "proposal", "commit"]) && hasSession(value) && text(value.proposal, 128) && text(value.commit, 64),
  "session, proposal, and commit must be bounded strings",
);

export const proposalIdInput = validator(
  (value) => hasOnly(value, ["session", "proposal"]) && hasSession(value) && text(value.proposal, 128),
  "session and proposal must be bounded strings",
);

/** The reviewer is a username, a GitHub login of at most 39 characters; the composition checks that it is registered. */
export const submitProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "proposal", "reviewer"]) && hasSession(value) && text(value.proposal, 128) && text(value.reviewer, 39),
  "session, proposal, and reviewer must be bounded strings",
);

/** Every proposal change answers the proposal's identity. */
export const proposalIdentityOutput = validator(
  (value) => hasOnly(value, ["proposal"]) && typeof value.proposal === "string",
  "response must contain a proposal identity",
);

/** A string, or `null` where an optional part such as a proposal's review is absent. */
function textOrNull(value: unknown): boolean {
  return value === null || typeof value === "string";
}

/**
 * A proposal with both of its structures, its changes, its highlights, its git
 * commands, and its review's identity, reviewer, and decision.
 */
function isProposalDetail(detail: unknown): boolean {
  return (
    record(detail) &&
    hasOnly(detail, [
      "proposal",
      "author",
      "owner",
      "name",
      "commit",
      "title",
      "rationale",
      "status",
      "appliedCommit",
      "currentStructure",
      "operations",
      "proposedStructure",
      "createdAt",
      "updatedAt",
      "review",
      "reviewer",
      "decision",
      "highlights",
      "commands",
    ]) &&
    ["proposal", "author", "owner", "name", "commit", "title", "rationale", "status", "appliedCommit"].every(
      (key) => typeof detail[key] === "string",
    ) &&
    ["review", "reviewer", "decision"].every((key) => textOrNull(detail[key])) &&
    hasStructure(detail.currentStructure) &&
    hasOperations(detail.operations) &&
    hasStructure(detail.proposedStructure) &&
    detail.createdAt instanceof Date &&
    detail.updatedAt instanceof Date &&
    Array.isArray(detail.highlights) &&
    detail.highlights.every(
      (item) =>
        record(item) &&
        ["highlight", "path", "text", "kind", "replacement"].every((key) => typeof item[key] === "string") &&
        ["from", "to", "start", "end"].every((key) => typeof item[key] === "number"),
    ) &&
    Array.isArray(detail.commands) &&
    detail.commands.every((item) => record(item) && hasOnly(item, ["command"]) && typeof item.command === "string")
  );
}

export const proposalOutput = validator(
  (value) => hasOnly(value, ["proposal"]) && isProposalDetail(value.proposal),
  "response must contain a proposal with both of its structures and its review",
);

export const reviewIdInput = validator(
  (value) => hasOnly(value, ["session", "review"]) && hasSession(value) && text(value.review, 128),
  "session and review must be bounded strings",
);

export const reviewIdentityOutput = validator(
  (value) => hasOnly(value, ["review"]) && typeof value.review === "string",
  "response must contain a review identity",
);

export const reviewOutput = validator(
  (value) => {
    const detail = value.review;
    return (
      hasOnly(value, ["review"]) &&
      record(detail) &&
      hasOnly(detail, ["review", "reviewer", "decision", "openedAt", "updatedAt", "proposal"]) &&
      ["review", "reviewer", "decision"].every((key) => typeof detail[key] === "string") &&
      detail.openedAt instanceof Date &&
      detail.updatedAt instanceof Date &&
      isProposalDetail(detail.proposal)
    );
  },
  "response must contain a review with its proposal",
);

/**
 * A list of proposal summaries, each with the given text fields and a Date it
 * last changed, and, when `withDecision`, its review's decision (`null` if none).
 */
function proposalSummaries(items: unknown, fields: readonly string[], withDecision = false): boolean {
  return (
    Array.isArray(items) &&
    items.every(
      (item) =>
        record(item) &&
        hasOnly(item, [...fields, "updatedAt", ...(withDecision ? ["decision"] : [])]) &&
        fields.every((field) => typeof item[field] === "string") &&
        item.updatedAt instanceof Date &&
        (!withDecision || textOrNull(item.decision)),
    )
  );
}

/** Every submitted proposal under `key` and the user's own drafts; a commit's lists leave out the commit. */
function visibleProposals(key: string, fields: readonly string[]) {
  return validator(
    (value) => {
      const holder = value[key];
      return (
        hasOnly(value, [key]) &&
        record(holder) &&
        hasOnly(holder, ["submitted", "drafts"]) &&
        proposalSummaries(holder.submitted, ["proposal", "author", ...fields, "title", "status"], true) &&
        proposalSummaries(holder.drafts, ["proposal", ...fields, "title"])
      );
    },
    `response must contain the ${key}'s submitted proposals and the user's drafts`,
  );
}

export const repositoryProposalsOutput = visibleProposals("repository", ["commit"]);
export const commitProposalsOutput = visibleProposals("commit", []);

export const reviewQueueOutput = validator(
  (value) => {
    const holder = value.repository;
    return (
      hasOnly(value, ["repository"]) &&
      record(holder) &&
      hasOnly(holder, ["proposals"]) &&
      proposalSummaries(holder.proposals, ["proposal", "author", "commit", "title"])
    );
  },
  "response must contain the repository's proposals that the user may review",
);
