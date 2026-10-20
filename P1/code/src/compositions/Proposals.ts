/**
 * Proposals: starting one of a commit, saving the draft, highlighting text,
 * submitting or discarding it, marking it applied, and reading one or a list.
 * A proposal is an investigation together with its review, and its identity is
 * the investigation's.
 *
 * Every endpoint resolves the session first, so the author is always the
 * signed-in account. Changing a proposal needs no view, because
 * InvestigatingChanges refuses anyone but its author. Reading does: a draft is
 * visible only to its author, and a submitted proposal to every signed-in account.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, is, no, now, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { TheReviewOf } from "./Policy.ts";
import {
  applyProposalInput,
  commitInput,
  commitProposalsOutput,
  highlightProposalInput,
  modifyProposalInput,
  proposalHighlightOutput,
  proposalIdentityOutput,
  proposalIdInput,
  proposalOutput,
  repositoryInput,
  repositoryProposalsOutput,
  reviewQueueOutput,
  startProposalInput,
  submitProposalInput,
  unhighlightProposalInput,
} from "./validators.ts";

const { Authenticating, InvestigatingChanges, RepositoryAccess, ReviewingDocumentation, Sessioning } = concepts;

/**
 * The branch for a proposal that does not exist. An endpoint that reads the
 * proposal's repository first, to check push access, needs it, because then no
 * action is left to refuse the missing proposal.
 */
function Missing<T>({ proposal }: { proposal: T }) {
  return where(no(InvestigatingChanges._get({ investigation: proposal as never })))
    .then(respond({ error: "INVESTIGATION_NOT_FOUND" }))
    .named("missing");
}

/** Every status after a draft. */
const SUBMITTED = ["SUBMITTED", "APPROVED", "APPLIED"];

/** The statuses in which a proposal gives its git commands. */
const APPROVED = ["APPROVED", "APPLIED"];

const ProposalIsSubmitted = view(
  "(proposal) is submitted",
  ({ proposal }, _outputs, { status }) =>
    where(InvestigatingChanges._get({ investigation: proposal }).is({ status }), is.among(status, SUBMITTED)),
).holds();

const ProposalIsApproved = view(
  "(proposal) is approved",
  ({ proposal }, _outputs, { status }) =>
    where(InvestigatingChanges._get({ investigation: proposal }).is({ status }), is.among(status, APPROVED)),
).holds();

const ProposalIsDraftByUser = view(
  "(proposal) is a draft by (user)",
  ({ proposal, user }, _outputs, _bindings) =>
    where(InvestigatingChanges._get({ investigation: proposal }).is({ status: "DRAFT", investigator: user })),
).holds();

const ProposalIsDraftByOther = view(
  "(proposal) is a draft by someone other than (user)",
  ({ proposal, user }, _outputs, _bindings) =>
    where(
      InvestigatingChanges._get({ investigation: proposal }).is({ status: "DRAFT" }),
      InvestigatingChanges._get({ investigation: proposal }).is.not({ investigator: user }),
    ),
).holds();

/** The decision of a proposal's review, for the rows of a list. */
const ReviewDecision = former("the review decision of (proposal)", ({ proposal }, { decision }) =>
  where(TheReviewOf({ proposal }).is({ decision })).form({ decision }),
).optional();

/**
 * One proposal with both of its structures, its changes, and its highlights in
 * the order added, and its review if it has one (`null` fields if not). The
 * git commands are listed only once the proposal is approved.
 */
const ProposalDetail = former(
  "a proposal with its current and proposed structures",
  (
    { proposal },
    {
      author,
      owner,
      name,
      commit,
      title,
      rationale,
      status,
      appliedCommit,
      currentStructure,
      operations,
      proposedStructure,
      createdAt,
      updatedAt,
      review,
      reviewer,
      decision,
      highlight,
      path,
      from,
      to,
      start,
      end,
      text,
      kind,
      replacement,
      command,
    },
  ) =>
    where(
      InvestigatingChanges._get({ investigation: proposal }).is({
        investigator: author,
        owner,
        name,
        commit,
        title,
        rationale,
        status,
        appliedCommit,
        currentStructure,
        operations,
        proposedStructure,
        createdAt,
        updatedAt,
      }),
      whether(TheReviewOf({ proposal }).is({ review, reviewer, decision })),
    ).form({
      proposal,
      author,
      owner,
      name,
      commit,
      title,
      rationale,
      status,
      appliedCommit,
      currentStructure,
      operations,
      proposedStructure,
      createdAt,
      updatedAt,
      review,
      reviewer,
      decision,
      highlights: each(
        InvestigatingChanges._highlights({ investigation: proposal }).is({
          highlight,
          path,
          from,
          to,
          start,
          end,
          text,
          kind,
          replacement,
        }),
      ).form({ highlight, path, from, to, start, end, text, kind, replacement }),
      // Empty until the proposal is approved, so no one acts on a change that has not been reviewed.
      commands: each(InvestigatingChanges._commands({ investigation: proposal }).is({ command }))
        .where(ProposalIsApproved({ proposal }))
        .form({ command }),
    }),
);

/**
 * The proposals of a repository that `user` may see: every submitted one, and
 * the user's own drafts. Two lists, because a condition cannot say "or".
 */
const RepositoryProposals = former(
  "the proposals of a repository that (user) may see",
  ({ owner, name, user }, { proposal, author, commit, title, status, updatedAt }) =>
    form({
      submitted: each(
        InvestigatingChanges._forRepository({ owner, name }).is({
          investigation: proposal,
          investigator: author,
          commit,
          title,
          status,
          updatedAt,
        }),
      )
        .where(is.among(status, SUBMITTED))
        .arranged(updatedAt, "descending")
        .form({ proposal, author, commit, title, status, updatedAt })
        .splicing(whether(ReviewDecision({ proposal }))),
      drafts: each(
        InvestigatingChanges._forRepository({ owner, name }).is({
          investigation: proposal,
          investigator: user,
          commit,
          title,
          status: "DRAFT",
          updatedAt,
        }),
      )
        .arranged(updatedAt, "descending")
        .form({ proposal, commit, title, updatedAt }),
    }),
);

/** The same as RepositoryProposals, for one commit's proposals. */
const CommitProposals = former(
  "the proposals of a commit that (user) may see",
  ({ owner, name, commit, user }, { proposal, author, title, status, updatedAt }) =>
    form({
      submitted: each(
        InvestigatingChanges._forCommit({ owner, name, commit }).is({
          investigation: proposal,
          investigator: author,
          title,
          status,
          updatedAt,
        }),
      )
        .where(is.among(status, SUBMITTED))
        .arranged(updatedAt, "descending")
        .form({ proposal, author, title, status, updatedAt })
        .splicing(whether(ReviewDecision({ proposal }))),
      drafts: each(
        InvestigatingChanges._forCommit({ owner, name, commit }).is({
          investigation: proposal,
          investigator: user,
          title,
          status: "DRAFT",
          updatedAt,
        }),
      )
        .arranged(updatedAt, "descending")
        .form({ proposal, title, updatedAt }),
    }),
);

/** A repository's submitted proposals whose author named `user` as reviewer, the longest waiting first. */
const ReviewQueue = former(
  "the proposals of a repository waiting for (user)'s review",
  ({ owner, name, user }, { proposal, author, commit, title, updatedAt }) =>
    form({
      proposals: each(
        InvestigatingChanges._forRepository({ owner, name }).is({
          investigation: proposal,
          investigator: author,
          commit,
          title,
          status: "SUBMITTED",
          updatedAt,
        }),
      )
        .where(TheReviewOf({ proposal }).is({ reviewer: user }))
        .arranged(updatedAt, "ascending")
        .form({ proposal, author, commit, title, updatedAt }),
    }),
);

const StartProposal = endpoint(
  "/proposals/start",
  ({ session, user, owner, name, commit, title, currentStructure, at, proposal }) =>
    receive({ session, owner, name, commit, title, currentStructure })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(now(at))
          .then(RepositoryAccess.authorize({ user, owner, name, at }).responds({}))
          .then(
            InvestigatingChanges.start({ investigator: user, owner, name, commit, title, currentStructure, at }).responds({
              investigation: proposal,
            }),
          )
          .then(respond({ proposal })),
      ),
  {
    input: { required: ["session", "owner", "name", "commit", "title", "currentStructure"] },
    validators: { input: startProposalInput, output: proposalIdentityOutput },
  },
);

const ModifyProposal = endpoint(
  "/proposals/modify",
  ({ session, user, proposal, title, operations, rationale, at, owner, name }) =>
    receive({ session, proposal, title, operations, rationale })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(InvestigatingChanges._get({ investigation: proposal }).is({ owner, name }), now(at))
          .then(RepositoryAccess.authorize({ user, owner, name, at }).responds({}))
          .then(
            InvestigatingChanges.modify({
              investigation: proposal,
              investigator: user,
              title,
              operations,
              rationale,
              at,
            }).responds({}),
          )
          .then(respond({ proposal }))
          .named("found"),
        Missing({ proposal }),
      ),
  {
    input: { required: ["session", "proposal", "title", "operations", "rationale"] },
    validators: { input: modifyProposalInput, output: proposalIdentityOutput },
  },
);

const HighlightProposal = endpoint(
  "/proposals/highlight",
  // The request says `file`, because the boundary owns a request's `path`.
  ({ session, user, proposal, file, from, to, start, end, text, kind, replacement, at, highlight, owner, name }) =>
    receive({ session, proposal, file, from, to, start, end, text, kind, replacement })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(InvestigatingChanges._get({ investigation: proposal }).is({ owner, name }), now(at))
          .then(RepositoryAccess.authorize({ user, owner, name, at }).responds({}))
          .then(
            InvestigatingChanges.highlight({
              investigation: proposal,
              investigator: user,
              path: file,
              from,
              to,
              start,
              end,
              text,
              kind,
              replacement,
              at,
            }).responds({ highlight }),
          )
          .then(respond({ proposal, highlight }))
          .named("found"),
        Missing({ proposal }),
      ),
  {
    input: { required: ["session", "proposal", "file", "from", "to", "start", "end", "text", "kind", "replacement"] },
    validators: { input: highlightProposalInput, output: proposalHighlightOutput },
  },
);

const UnhighlightProposal = endpoint(
  "/proposals/unhighlight",
  ({ session, user, proposal, highlight, at, owner, name }) =>
    receive({ session, proposal, highlight })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(InvestigatingChanges._get({ investigation: proposal }).is({ owner, name }), now(at))
          .then(RepositoryAccess.authorize({ user, owner, name, at }).responds({}))
          .then(InvestigatingChanges.unhighlight({ investigation: proposal, investigator: user, highlight, at }).responds({}))
          .then(respond({ proposal }))
          .named("found"),
        Missing({ proposal }),
      ),
  {
    input: { required: ["session", "proposal", "highlight"] },
    validators: { input: unhighlightProposalInput, output: proposalIdentityOutput },
  },
);

/**
 * Submits the draft and opens its review for the reviewer the author names.
 * The reviewer must be a registered account other than the author. The
 * concept still refuses anyone but the author, so naming a reviewer for
 * someone else's draft submits nothing.
 */
const SubmitProposal = endpoint(
  "/proposals/submit",
  ({ session, user, proposal, reviewer, at, review, owner, name }) =>
    receive({ session, proposal, reviewer })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(
          Authenticating._registered({ username: reviewer }).is({ registered: true }),
          InvestigatingChanges._get({ investigation: proposal }).is.not({ investigator: reviewer }),
          InvestigatingChanges._get({ investigation: proposal }).is({ owner, name }),
          now(at),
        )
          .then(RepositoryAccess.authorize({ user, owner, name, at }).responds({}))
          .then(InvestigatingChanges.submit({ investigation: proposal, investigator: user, at }).responds({}))
          .then(ReviewingDocumentation.open({ proposal, reviewer, at }).responds({ review }))
          .then(respond({ proposal }))
          .named("allowed"),
        where(InvestigatingChanges._get({ investigation: proposal }).is({ investigator: reviewer }))
          .then(respond({ error: "INVALID_REVIEWER" }))
          .named("own-reviewer"),
        where(
          InvestigatingChanges._get({ investigation: proposal }),
          Authenticating._registered({ username: reviewer }).is({ registered: false }),
        )
          .then(respond({ error: "INVALID_REVIEWER" }))
          .named("unknown-reviewer"),
        where(no(InvestigatingChanges._get({ investigation: proposal })))
          .then(respond({ error: "INVESTIGATION_NOT_FOUND" }))
          .named("missing"),
      ),
  {
    input: { required: ["session", "proposal", "reviewer"] },
    validators: { input: submitProposalInput, output: proposalIdentityOutput },
  },
);

const DiscardProposal = endpoint(
  "/proposals/discard",
  ({ session, user, proposal }) =>
    receive({ session, proposal })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(InvestigatingChanges.discard({ investigation: proposal, investigator: user }).responds({}))
      .then(respond({ proposal })),
  {
    input: { required: ["session", "proposal"] },
    validators: { input: proposalIdInput, output: proposalIdentityOutput },
  },
);

/** Records the commit that applied an approved proposal. The concept refuses anyone but the author. */
const ApplyProposal = endpoint(
  "/proposals/apply",
  ({ session, user, proposal, commit, at, owner, name }) =>
    receive({ session, proposal, commit })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(InvestigatingChanges._get({ investigation: proposal }).is({ owner, name }), now(at))
          .then(RepositoryAccess.authorize({ user, owner, name, at }).responds({}))
          .then(InvestigatingChanges.apply({ investigation: proposal, investigator: user, commit, at }).responds({}))
          .then(respond({ proposal }))
          .named("found"),
        Missing({ proposal }),
      ),
  {
    input: { required: ["session", "proposal", "commit"] },
    validators: { input: applyProposalInput, output: proposalIdentityOutput },
  },
);

const GetProposal = endpoint(
  "/proposals/get",
  ({ session, user, proposal }) =>
    receive({ session, proposal })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(ProposalIsSubmitted({ proposal }))
          .then(respond({ proposal: ProposalDetail({ proposal }) }))
          .named("submitted"),
        where(ProposalIsDraftByUser({ proposal, user }))
          .then(respond({ proposal: ProposalDetail({ proposal }) }))
          .named("own-draft"),
        // Answered like a missing proposal, so others cannot tell that the draft exists.
        where(ProposalIsDraftByOther({ proposal, user }))
          .then(respond({ error: "INVESTIGATION_NOT_FOUND" }))
          .named("others-draft"),
        where(no(InvestigatingChanges._get({ investigation: proposal })))
          .then(respond({ error: "INVESTIGATION_NOT_FOUND" }))
          .named("missing"),
      ),
  {
    input: { required: ["session", "proposal"] },
    validators: { input: proposalIdInput, output: proposalOutput },
  },
);

const ListProposals = endpoint(
  "/proposals/list",
  ({ session, user, owner, name }) =>
    receive({ session, owner, name })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(respond({ repository: RepositoryProposals({ owner, name, user }) })),
  {
    input: { required: ["session", "owner", "name"] },
    validators: { input: repositoryInput, output: repositoryProposalsOutput },
  },
);

const ListCommitProposals = endpoint(
  "/proposals/for-commit",
  ({ session, user, owner, name, commit }) =>
    receive({ session, owner, name, commit })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(respond({ commit: CommitProposals({ owner, name, commit, user }) })),
  {
    input: { required: ["session", "owner", "name", "commit"] },
    validators: { input: commitInput, output: commitProposalsOutput },
  },
);

const ListProposalsUnderReview = endpoint(
  "/proposals/under-review",
  ({ session, user, owner, name }) =>
    receive({ session, owner, name })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(respond({ repository: ReviewQueue({ owner, name, user }) })),
  {
    input: { required: ["session", "owner", "name"] },
    validators: { input: repositoryInput, output: reviewQueueOutput },
  },
);

export { ProposalDetail };

export const composition = {
  Writing: { StartProposal, ModifyProposal, HighlightProposal, UnhighlightProposal, SubmitProposal, DiscardProposal },
  Applying: { ApplyProposal },
  Reading: {
    GetProposal,
    ListProposals,
    ListCommitProposals,
    ListProposalsUnderReview,
    ProposalDetail,
    RepositoryProposals,
    CommitProposals,
    ReviewQueue,
    ReviewDecision,
    ProposalIsSubmitted,
    ProposalIsApproved,
    ProposalIsDraftByUser,
    ProposalIsDraftByOther,
  },
};
