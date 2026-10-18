/**
 * Reviews of submitted proposals: reading one and approving it. A review is
 * opened when its proposal is submitted, for the reviewer the author names
 * (see `/proposals/submit`).
 *
 * Every endpoint resolves the session first, so the reviewer is always the
 * signed-in account. Approving needs no view: ReviewingDocumentation refuses
 * anyone but the reviewer.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { former, no, now, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { ProposalDetail } from "./Proposals.ts";
import { proposalOutput, reviewIdInput, reviewOutput } from "./validators.ts";

const { ReviewingDocumentation, Sessioning } = concepts;

/** One review with its proposal, so a review screen needs only one request. */
const ReviewDetail = former(
  "a review with its proposal",
  ({ review }, { proposal, reviewer, decision, openedAt, updatedAt }) =>
    where(ReviewingDocumentation._get({ review }).is({ proposal, reviewer, decision, openedAt, updatedAt })).form({
      review,
      reviewer,
      decision,
      openedAt,
      updatedAt,
      proposal: ProposalDetail({ proposal }),
    }),
);

const GetReview = endpoint(
  "/reviews/get",
  ({ session, user, review }) =>
    receive({ session, review })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(
        where(ReviewingDocumentation._get({ review }))
          .then(respond({ review: ReviewDetail({ review }) }))
          .named("found"),
        where(no(ReviewingDocumentation._get({ review })))
          .then(respond({ error: "REVIEW_NOT_FOUND" }))
          .named("missing"),
      ),
  {
    input: { required: ["session", "review"] },
    validators: { input: reviewIdInput, output: reviewOutput },
  },
);

/**
 * Answers once the approval reaction has run, so the response shows the
 * proposal's real status rather than assuming it was approved.
 */
const ApproveReview = endpoint(
  "/reviews/approve",
  ({ session, user, review, at, proposal }) =>
    receive({ session, review })
      .then(Sessioning.current({ session }).responds({ subject: user }))
      .then(where(now(at)).then(ReviewingDocumentation.approve({ review, reviewer: user, at }).responds({})))
      .afterFlowSettles()
      .where(ReviewingDocumentation._get({ review }).is({ proposal }))
      .then(respond({ proposal: ProposalDetail({ proposal }) })),
  {
    input: { required: ["session", "review"] },
    validators: { input: reviewIdInput, output: proposalOutput },
  },
);

export const composition = {
  Reading: { GetReview, ReviewDetail },
  Deciding: { ApproveReview },
};
