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
import { former, no, now, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import {
  createProposalInput,
  modifyProposalInput,
  proposalIdentityOutput,
  proposalIdInput,
  proposalOutput,
} from "./validators.ts";

const { InvestigatingChanges, RestructuringDocumentation, Sessioning } = concepts;

const ProposalIsSubmitted = view(
  "(proposal) is submitted",
  ({ proposal }, _outputs, _bindings) =>
    where(RestructuringDocumentation._get({ restructuring: proposal }).is({ status: "PENDING_APPROVAL" })),
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

/** One proposal with both of its structures. */
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
    ).form({
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

const SubmitProposal = endpoint(
  "/proposals/submit",
  ({ session, user, proposal, at }) =>
    receive({ session, proposal })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(now(at))
          .then(RestructuringDocumentation.submit({ restructuring: proposal, author: user, at }).responds({}))
          .then(respond({ proposal })),
      ),
  {
    input: { required: ["session", "proposal"] },
    validators: { input: proposalIdInput, output: proposalIdentityOutput },
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

export const composition = {
  Writing: { CreateProposal, ModifyProposal, SubmitProposal, DiscardProposal },
  Reading: { GetProposal, ProposalDetail, ProposalIsSubmitted, ProposalIsDraftByUser, ProposalIsDraftByOther },
};
