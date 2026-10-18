/**
 * Investigations of a repository's commits: submitting one, reading one with its
 * highlights, and listing a repository's or a commit's.
 *
 * Every endpoint resolves the session first, so the investigator is always the
 * signed-in account, never a name the request supplies. The repository is a
 * shared workspace, so any signed-in account may read and list its investigations.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, now, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import {
  commitInput,
  commitInvestigationsOutput,
  investigationIdInput,
  investigationOutput,
  repositoryInput,
  repositoryInvestigationsOutput,
  submitInvestigationInput,
  submittedInvestigationOutput,
} from "./validators.ts";

const { InvestigatingChanges, Sessioning } = concepts;

/** One investigation, with its highlights in the order given. */
const InvestigationDetail = former(
  "an investigation with its highlights",
  ({ investigation }, { owner, name, commit, investigator, title, submittedAt, path, from, to, comment }) =>
    where(
      InvestigatingChanges._get({ investigation }).is({ investigation, owner, name, commit, investigator, title, submittedAt }),
    ).form({
      investigation,
      owner,
      name,
      commit,
      investigator,
      title,
      submittedAt,
      highlights: each(InvestigatingChanges._highlights({ investigation }).is({ path, from, to, comment })).form({
        path,
        from,
        to,
        comment,
      }),
    }),
);

/** The repository's investigations, the most recently submitted first. */
const RepositoryInvestigations = former(
  "the investigations of a repository",
  ({ owner, name }, { investigation, commit, investigator, title, submittedAt }) =>
    form({
      investigations: each(
        InvestigatingChanges._forRepository({ owner, name }).is({ investigation, commit, investigator, title, submittedAt }),
      )
        .arranged(submittedAt, "descending")
        .form({ investigation, commit, investigator, title, submittedAt }),
    }),
);

/** One commit's investigations, the most recently submitted first. */
const CommitInvestigations = former(
  "the investigations of a commit",
  ({ owner, name, commit }, { investigation, investigator, title, submittedAt }) =>
    form({
      investigations: each(
        InvestigatingChanges._forCommit({ owner, name, commit }).is({ investigation, investigator, title, submittedAt }),
      )
        .arranged(submittedAt, "descending")
        .form({ investigation, investigator, title, submittedAt }),
    }),
);

const SubmitInvestigation = endpoint(
  "/investigations/submit",
  ({ session, user, owner, name, commit, title, highlights, at, investigation }) =>
    receive({ session, owner, name, commit, title, highlights })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(now(at))
          .then(
            InvestigatingChanges.submit({ investigator: user, owner, name, commit, title, highlights, at }).responds({
              investigation,
            }),
          )
          .then(respond({ investigation })),
      ),
  {
    input: { required: ["session", "owner", "name", "commit", "title", "highlights"] },
    validators: { input: submitInvestigationInput, output: submittedInvestigationOutput },
  },
);

const GetInvestigation = endpoint(
  "/investigations/get",
  ({ session, user, investigation }) =>
    receive({ session, investigation })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(InvestigatingChanges._get({ investigation }))
          .then(respond({ investigation: InvestigationDetail({ investigation }) }))
          .named("found"),
        where(no(InvestigatingChanges._get({ investigation })))
          .then(respond({ error: "INVESTIGATION_NOT_FOUND" }))
          .named("missing"),
      ),
  {
    input: { required: ["session", "investigation"] },
    validators: { input: investigationIdInput, output: investigationOutput },
  },
);

const ListInvestigations = endpoint(
  "/investigations/list",
  ({ session, user, owner, name }) =>
    receive({ session, owner, name })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(respond({ repository: RepositoryInvestigations({ owner, name }) })),
  {
    input: { required: ["session", "owner", "name"] },
    validators: { input: repositoryInput, output: repositoryInvestigationsOutput },
  },
);

const ListCommitInvestigations = endpoint(
  "/investigations/for-commit",
  ({ session, user, owner, name, commit }) =>
    receive({ session, owner, name, commit })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(respond({ commit: CommitInvestigations({ owner, name, commit }) })),
  {
    input: { required: ["session", "owner", "name", "commit"] },
    validators: { input: commitInput, output: commitInvestigationsOutput },
  },
);

export const composition = {
  Submitting: { SubmitInvestigation },
  Reading: {
    GetInvestigation,
    ListInvestigations,
    ListCommitInvestigations,
    InvestigationDetail,
    RepositoryInvestigations,
    CommitInvestigations,
  },
};
