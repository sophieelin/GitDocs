/**
 * Investigations of a repository's commits: opening one, reading one, and
 * listing a repository's investigations.
 *
 * Every endpoint resolves the session first, so the investigator is always the
 * signed-in account, never a name the request supplies. The repository is a
 * shared workspace, so any signed-in account may read and list its investigations.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, now, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import {
  investigationIdInput,
  investigationOutput,
  openInvestigationInput,
  openedInvestigationOutput,
  repositoryInput,
  repositoryInvestigationsOutput,
} from "./validators.ts";

const { InvestigatingChanges, Sessioning } = concepts;

/** The repository's investigations, the most recently opened first. */
const RepositoryInvestigations = former(
  "the investigations of a repository",
  ({ owner, name }, { investigation, commit, investigator, openedAt }) =>
    form({
      investigations: each(
        InvestigatingChanges._forRepository({ owner, name }).is({ investigation, commit, investigator, openedAt }),
      )
        .arranged(openedAt, "descending")
        .form({ investigation, commit, investigator, openedAt }),
    }),
);

const OpenInvestigation = endpoint(
  "/investigations/open",
  ({ session, user, owner, name, commit, at, investigation }) =>
    receive({ session, owner, name, commit })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(now(at))
          .then(InvestigatingChanges.open({ investigator: user, owner, name, commit, at }).responds({ investigation }))
          .then(respond({ investigation })),
      ),
  {
    input: { required: ["session", "owner", "name", "commit"] },
    validators: { input: openInvestigationInput, output: openedInvestigationOutput },
  },
);

const GetInvestigation = endpoint(
  "/investigations/get",
  ({ session, user, investigation, owner, name, commit, investigator, openedAt }) =>
    receive({ session, investigation })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(InvestigatingChanges._get({ investigation }).is({ owner, name, commit, investigator, openedAt }))
          .then(respond({ investigation, owner, name, commit, investigator, openedAt }))
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

export const composition = {
  Opening: { OpenInvestigation },
  Reading: { GetInvestigation, ListInvestigations, RepositoryInvestigations },
};
