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
 * highlight, each with a valid range of lines and a comment); this only rejects
 * values a real request should never carry.
 */
export const submitInvestigationInput = validator(
  (value) =>
    hasOnly(value, ["session", "owner", "name", "commit", "title", "highlights"]) &&
    hasSession(value) &&
    hasRepository(value) &&
    text(value.commit, 64) &&
    typeof value.title === "string" &&
    value.title.length <= 200 &&
    Array.isArray(value.highlights) &&
    value.highlights.length <= 200 &&
    value.highlights.every(
      (item) =>
        record(item) &&
        hasOnly(item, ["path", "from", "to", "comment"]) &&
        typeof item.path === "string" &&
        item.path.length <= 500 &&
        typeof item.from === "number" &&
        typeof item.to === "number" &&
        typeof item.comment === "string" &&
        item.comment.length <= 2000,
    ),
  "an investigation needs bounded strings and a highlight list of paths, line ranges, and comments",
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
      hasOnly(detail, ["investigation", "owner", "name", "commit", "investigator", "title", "submittedAt", "highlights"]) &&
      ["investigation", "owner", "name", "commit", "investigator", "title"].every((key) => typeof detail[key] === "string") &&
      detail.submittedAt instanceof Date &&
      Array.isArray(detail.highlights) &&
      detail.highlights.every(
        (item) =>
          record(item) &&
          typeof item.path === "string" &&
          typeof item.from === "number" &&
          typeof item.to === "number" &&
          typeof item.comment === "string",
      )
    );
  },
  "response must contain an investigation with its highlights",
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

/** The concept checks the lines and text; this only rejects values a real request should never carry. */
export const commentOnProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "proposal", "file", "from", "to", "start", "end", "text"]) &&
    hasSession(value) &&
    text(value.proposal, 128) &&
    typeof value.file === "string" &&
    value.file.length <= 1000 &&
    ["from", "to", "start", "end"].every((key) => typeof value[key] === "number") &&
    typeof value.text === "string" &&
    value.text.length <= 2000,
  "session and proposal must be bounded strings, file and text strings, and from, to, start, and end numbers",
);

export const uncommentProposalInput = validator(
  (value) => hasOnly(value, ["session", "proposal", "comment"]) && hasSession(value) && text(value.proposal, 128) && text(value.comment, 128),
  "session, proposal, and comment must be bounded strings",
);

export const proposalCommentOutput = validator(
  (value) => hasOnly(value, ["proposal", "comment"]) && typeof value.proposal === "string" && typeof value.comment === "string",
  "response must contain the proposal's and the new comment's identities",
);

export const proposalIdInput = validator(
  (value) => hasOnly(value, ["session", "proposal"]) && hasSession(value) && text(value.proposal, 128),
  "session and proposal must be bounded strings",
);

/** The reviewer is a username; the composition checks that it is registered. */
export const submitProposalInput = validator(
  (value) =>
    hasOnly(value, ["session", "proposal", "reviewer"]) && hasSession(value) && text(value.proposal, 128) && text(value.reviewer, 32),
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

/** A proposal with both of its structures and its review's identity, reviewer, and decision. */
function isProposalDetail(detail: unknown): boolean {
  return (
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
      "review",
      "reviewer",
      "decision",
      "comments",
    ]) &&
    ["proposal", "author", "investigation", "owner", "name", "commit", "title", "rationale", "status"].every(
      (key) => typeof detail[key] === "string",
    ) &&
    ["review", "reviewer", "decision"].every((key) => textOrNull(detail[key])) &&
    hasStructure(detail.currentStructure) &&
    hasStructure(detail.proposedStructure) &&
    detail.createdAt instanceof Date &&
    detail.updatedAt instanceof Date &&
    Array.isArray(detail.comments) &&
    detail.comments.every(
      (item) =>
        record(item) &&
        ["comment", "path", "text"].every((key) => typeof item[key] === "string") &&
        ["from", "to", "start", "end"].every((key) => typeof item[key] === "number"),
    )
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

/** A list of proposal summaries, each with the given text fields and a Date it last changed. */
function proposalSummaries(items: unknown, fields: readonly string[]): boolean {
  return (
    Array.isArray(items) &&
    items.every(
      (item) =>
        record(item) &&
        hasOnly(item, [...fields, "updatedAt"]) &&
        fields.every((field) => typeof item[field] === "string") &&
        item.updatedAt instanceof Date,
    )
  );
}

export const repositoryProposalsOutput = validator(
  (value) => {
    const holder = value.repository;
    return (
      hasOnly(value, ["repository"]) &&
      record(holder) &&
      hasOnly(holder, ["submitted", "drafts"]) &&
      proposalSummaries(holder.submitted, ["proposal", "author", "investigation", "commit", "title", "status"]) &&
      proposalSummaries(holder.drafts, ["proposal", "investigation", "commit", "title"])
    );
  },
  "response must contain the repository's submitted proposals and the user's drafts",
);

export const reviewQueueOutput = validator(
  (value) => {
    const holder = value.repository;
    return (
      hasOnly(value, ["repository"]) &&
      record(holder) &&
      hasOnly(holder, ["proposals"]) &&
      proposalSummaries(holder.proposals, ["proposal", "author", "investigation", "commit", "title"])
    );
  },
  "response must contain the repository's proposals that the user may review",
);
