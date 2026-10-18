/**
 * Restructuring proposals: starting one from a submitted investigation, saving
 * the draft, submitting it, discarding it, and reading one.
 *
 * Every endpoint resolves the session first, so the author is always the
 * signed-in account. Changing a proposal needs no view, because the concept
 * refuses anyone but its author. Reading does: a draft is visible only to its
 * author, and a submitted proposal to every signed-in account.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, is, no, now, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { TheReviewOf } from "./Policy.ts";
import {
  createProposalInput,
  modifyProposalInput,
  proposalIdentityOutput,
  proposalIdInput,
  proposalOutput,
  repositoryInput,
  repositoryProposalsOutput,
  reviewQueueOutput,
  submitProposalInput,
} from "./validators.ts";

const { Authenticating, InvestigatingChanges, RestructuringDocumentation, ReviewingDocumentation, Sessioning } = concepts;

/** Every status after a draft: pending approval or approved. */
const SUBMITTED = ["PENDING_APPROVAL", "APPROVED"];

const ProposalIsSubmitted = view(
  "(proposal) is submitted",
  ({ proposal }, _outputs, { status }) =>
    where(RestructuringDocumentation._get({ restructuring: proposal }).is({ status }), is.among(status, SUBMITTED)),
).holds();

const ProposalIsDraftByUser = view(
  "(proposal) is a draft by (user)",
  ({ proposal, user }, _outputs, _bindings) =>
    where(RestructuringDocumentation._get({ restructuring: proposal }).is({ status: "DRAFT", author: user })),
).holds();

const ProposalIsDraftByOther = view(
  "(proposal) is a draft by someone other than (user)",
  ({ proposal, user }, _outputs, _bindings) =>
    where(
      RestructuringDocumentation._get({ restructuring: proposal }).is({ status: "DRAFT" }),
      RestructuringDocumentation._get({ restructuring: proposal }).is.not({ author: user }),
    ),
).holds();

/** One proposal with both of its structures, and its review if it has one (`null` fields if not). */
const ProposalDetail = former(
  "a proposal with its current and proposed structures",
  (
    { proposal },
    {
      author,
      investigation,
      owner,
      name,
      commit,
      title,
      rationale,
      status,
      currentStructure,
      proposedStructure,
      createdAt,
      updatedAt,
      review,
      reviewer,
      decision,
    },
  ) =>
    where(
      RestructuringDocumentation._get({ restructuring: proposal }).is({
        author,
        investigation,
        owner,
        name,
        commit,
        title,
        rationale,
        status,
        currentStructure,
        proposedStructure,
        createdAt,
        updatedAt,
      }),
      whether(TheReviewOf({ proposal }).is({ review, reviewer, decision })),
    ).form({
      review,
      reviewer,
      decision,
      proposal,
      author,
      investigation,
      owner,
      name,
      commit,
      title,
      rationale,
      status,
      currentStructure,
      proposedStructure,
      createdAt,
      updatedAt,
    }),
);

/**
 * The proposals of a repository that `user` may see: every submitted one, and
 * the user's own drafts. Two lists, because a condition cannot say "or".
 */
const RepositoryProposals = former(
  "the proposals of a repository that (user) may see",
  ({ owner, name, user }, { proposal, author, investigation, commit, title, status, updatedAt }) =>
    form({
      submitted: each(
        RestructuringDocumentation._forRepository({ owner, name }).is({
          restructuring: proposal,
          author,
          investigation,
          commit,
          title,
          status,
          updatedAt,
        }),
      )
        .where(is.among(status, SUBMITTED))
        .arranged(updatedAt, "descending")
        .form({ proposal, author, investigation, commit, title, status, updatedAt }),
      drafts: each(
        RestructuringDocumentation._forRepository({ owner, name }).is({
          restructuring: proposal,
          author: user,
          investigation,
          commit,
          title,
          status: "DRAFT",
          updatedAt,
        }),
      )
        .arranged(updatedAt, "descending")
        .form({ proposal, investigation, commit, title, updatedAt }),
    }),
);

/** A repository's proposals pending approval whose author named `user` as reviewer, the longest waiting first. */
const ReviewQueue = former(
  "the proposals of a repository waiting for (user)'s review",
  ({ owner, name, user }, { proposal, author, investigation, commit, title, updatedAt }) =>
    form({
      proposals: each(
        RestructuringDocumentation._pendingApproval({ owner, name }).is({
          restructuring: proposal,
          author,
          investigation,
          commit,
          title,
          updatedAt,
        }),
      )
        .where(TheReviewOf({ proposal }).is({ reviewer: user }))
        .arranged(updatedAt, "ascending")
        .form({ proposal, author, investigation, commit, title, updatedAt }),
    }),
);

const CreateProposal = endpoint(
  "/proposals/create",
  ({ session, user, investigation, title, currentStructure, owner, name, commit, at, proposal }) =>
    receive({ session, investigation, title, currentStructure })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(InvestigatingChanges._get({ investigation }).is({ owner, name, commit }), now(at))
          .then(
            RestructuringDocumentation.create({
              author: user,
              investigation,
              owner,
              name,
              commit,
              title,
              currentStructure,
              at,
            }).responds({ restructuring: proposal }),
          )
          .then(respond({ proposal }))
          .named("found"),
        where(no(InvestigatingChanges._get({ investigation })))
          .then(respond({ error: "INVESTIGATION_NOT_FOUND" }))
          .named("missing"),
      ),
  {
    input: { required: ["session", "investigation", "title", "currentStructure"] },
    validators: { input: createProposalInput, output: proposalIdentityOutput },
  },
);

const ModifyProposal = endpoint(
  "/proposals/modify",
  ({ session, user, proposal, title, proposedStructure, rationale, at }) =>
    receive({ session, proposal, title, proposedStructure, rationale })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(now(at))
          .then(
            RestructuringDocumentation.modify({
              restructuring: proposal,
              author: user,
              title,
              proposedStructure,
              rationale,
              at,
            }).responds({}),
          )
          .then(respond({ proposal })),
      ),
  {
    input: { required: ["session", "proposal", "title", "proposedStructure", "rationale"] },
    validators: { input: modifyProposalInput, output: proposalIdentityOutput },
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
  ({ session, user, proposal, reviewer, at, review }) =>
    receive({ session, proposal, reviewer })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(
          Authenticating._registered({ username: reviewer }).is({ registered: true }),
          RestructuringDocumentation._get({ restructuring: proposal }).is.not({ author: reviewer }),
          now(at),
        )
          .then(RestructuringDocumentation.submit({ restructuring: proposal, author: user, at }).responds({}))
          .then(ReviewingDocumentation.open({ proposal, reviewer, at }).responds({ review }))
          .then(respond({ proposal }))
          .named("allowed"),
        where(RestructuringDocumentation._get({ restructuring: proposal }).is({ author: reviewer }))
          .then(respond({ error: "INVALID_REVIEWER" }))
          .named("own-reviewer"),
        where(
          RestructuringDocumentation._get({ restructuring: proposal }),
          Authenticating._registered({ username: reviewer }).is({ registered: false }),
        )
          .then(respond({ error: "INVALID_REVIEWER" }))
          .named("unknown-reviewer"),
        where(no(RestructuringDocumentation._get({ restructuring: proposal })))
          .then(respond({ error: "PROPOSAL_NOT_FOUND" }))
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
      .then(RestructuringDocumentation.discard({ restructuring: proposal, author: user }).responds({}))
      .then(respond({ proposal })),
  {
    input: { required: ["session", "proposal"] },
    validators: { input: proposalIdInput, output: proposalIdentityOutput },
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
          .then(respond({ error: "PROPOSAL_NOT_FOUND" }))
          .named("others-draft"),
        where(no(RestructuringDocumentation._get({ restructuring: proposal })))
          .then(respond({ error: "PROPOSAL_NOT_FOUND" }))
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
  Writing: { CreateProposal, ModifyProposal, SubmitProposal, DiscardProposal },
  Reading: {
    GetProposal,
    ListProposals,
    ListProposalsUnderReview,
    ProposalDetail,
    RepositoryProposals,
    ReviewQueue,
    ProposalIsSubmitted,
    ProposalIsDraftByUser,
    ProposalIsDraftByOther,
  },
};
