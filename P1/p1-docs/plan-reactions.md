# GitDocs Reactions and Views Plan

## Goal

Plan the composition layer that connects GitDocs's concepts:

- **Reactions** state one application decision each: when one concept's action happens, ask another concept to act.
- **Views** are named, read-only lookups over concept queries. Endpoints and reactions use them for authorization and policy, such as "this user owns this proposal."

This plan goes with `plan.md`, which decides when each step happens: R1–R2 in Phase 4, R3 in Phase 5, R4.1–R4.4 in Phase 6, and R4.5–R4.6 in Phase 7. Backend step numbers below are from an older version of the plan. It does not add a separate round. Each step below names the backend step it belongs to, so reactions and views are built right after the concepts they connect, together with that concept's endpoints (`plan-endpoints.md`).

## Working rules

- One reaction or one view per diff, with a test.
- A reaction is only for a cross-concept decision. A rule that uses only one concept's own state belongs in that concept's action, not in a reaction.
- Name each reaction after the decision it makes (`ApprovalApprovesProposal`), not after a role such as "handler."
- A view used for a security decision must also be enforced by the owner action when a direct call could skip it (see "Authorization across concept boundaries" in the sync-engine design guide).
- Each reaction's design doc records how its cross-concept relation can be temporarily false and how it is repaired, because reactions are not atomic.
- Document every reaction and view in `design/compositions/*.md` with typed links (`reaction:...`), and register the file in `generated.config.ts`.

## Files

| File | Contents |
| ---- | -------- |
| `src/compositions/Policy.ts` | Views shared by several endpoints (ownership, reviewer rights, connected repository) |
| `src/compositions/ReviewWorkflow.ts` | Reactions linking ReviewingDocumentation and RestructuringDocumentation |
| `design/compositions/Policy.md` | The authorization decisions in plain language |
| `design/compositions/ReviewWorkflow.md` | The review workflow decisions, with the false interval and repair for each |
| `tests/compositions/*.test.ts` | Tests against the assembled application, using `mongodb-memory-server` |

# Phase R1: Shared composition test helper

## R1.1 Assembled-application test helper

**Belongs to:** backend step 2.4 (application assembly).

**Diff:** `tests/compositions/app.ts`

- Assemble the application with the Mongo floor and the fake GitHub fetcher (backend step 1.9).
- Expose a way to call a concept action and read concept queries in a test.
- Reset the database between tests with `tests/test-db.ts`.

**Verify:** A trivial test assembles the app and calls one action under `bun run test:memory`.

# Phase R2: Views for repositories (with Phase 4)

## R2.1 View: the user has connected the repository

**Belongs to:** backend phase 4, before step 4.7 (repository endpoints).

**Diff:** `src/compositions/Policy.ts`, `design/compositions/Policy.md`

```ts
const hasConnected = view("(user) has connected (repository)", ({ user, repository }) =>
  where(ConnectingRepositories._connection({ user, repository })),
);
```

Add the opposite view, `(user) has not connected (repository)`, using `no(...)`, so endpoints can answer `REPOSITORY_NOT_CONNECTED` instead of silently dropping the request.

**Used by:** `/repositories/commits`, `/repositories/tree`, `/proposals/create`.

**Verify:** Tests for a connected user, an unconnected user, and an unknown repository.

# Phase R3: Views for proposals (with Phase 5)

## R3.1 View: the user owns the proposal

**Belongs to:** backend phase 5, after step 5.6 (proposal retrieval) and before step 5.9 (proposal endpoints).

**Diff:** `src/compositions/Policy.ts`, `design/compositions/Policy.md`

```ts
const ownsProposal = view("(user) owns (proposal)", ({ user, proposal }) =>
  where(RestructuringDocumentation._get({ restructuring: proposal }).is({ author: user })),
);
```

Add `(user) does not own (proposal)` for the `NOT_PROPOSAL_AUTHOR` answer.

**Used by:** `/proposals/modify`, `/proposals/submit`, `/proposals/discard`.

**Decision to make here:** whether `modify`, `submit`, and `discard` also take the author and refuse a mismatch inside RestructuringDocumentation, like the message-board example's `Commenting.retract`. Recommended: yes, because any direct call to the concept could otherwise skip the view.

**Verify:** Tests for the author, another user, and a missing proposal.

# Phase R4: Views and reactions for reviews (with Phase 6)

## R4.1 View: the user may review the proposal

**Belongs to:** backend step 6.4 (review creation).

**Diff:** `src/compositions/Policy.ts`, `design/compositions/Policy.md`

The MVP rule: any signed-in user except the proposal's author may review a proposal that is pending approval.

```ts
const mayReview = view("(user) may review (proposal)", ({ user, proposal }, {}, { author }) =>
  where(
    RestructuringDocumentation._get({ restructuring: proposal }).is({ author, status: "PENDING_APPROVAL" }),
    // author must differ from user
  ),
);
```

Add the opposite views for `CANNOT_REVIEW_OWN_PROPOSAL` and `PROPOSAL_NOT_PENDING`.

**Used by:** `/reviews/open`.

**Verify:** The author is refused, a second user is allowed, and a draft proposal is refused.

## R4.2 View: the user is the review's reviewer

**Belongs to:** backend step 6.5 (approval).

**Diff:** `src/compositions/Policy.ts`

`(user) reviews (review)`, read from `ReviewingDocumentation._get`. Add `(user) does not review (review)` for `NOT_REVIEWER`.

**Used by:** `/reviews/approve`, `/reviews/request-changes`.

**Verify:** The reviewer is allowed and any other user is refused.

## R4.3 View: the review of a proposal

**Belongs to:** backend step 6.4.

**Diff:** `src/compositions/Policy.ts`

`the review of (proposal)`, marked `.optional()` because a proposal has at most one review. Formers wrap it in `whether(...)`, so a proposal without a review still appears, with an empty review.

**Used by:** the proposal formers in `plan-endpoints.md` and reaction R4.6.

**Verify:** One test with a review and one without.

## R4.4 Reaction: approving the review approves the proposal

**Belongs to:** backend step 6.5.

**Diff:** `src/compositions/ReviewWorkflow.ts`, `design/compositions/ReviewWorkflow.md`

```ts
const ApprovalApprovesProposal = reaction(({ review, proposal }) =>
  when(ReviewingDocumentation.approve({ review }).responds({}))
    .where(ReviewingDocumentation._get({ review }).is({ proposal }))
    .then(RestructuringDocumentation.approve({ restructuring: proposal })),
);
```

- **Trigger:** `ReviewingDocumentation.approve` returns.
- **Condition:** the review's proposal.
- **Effect:** `RestructuringDocumentation.approve`, which stays the authoritative status change.
- **False interval:** between the two actions, the review is approved but the proposal is still pending approval.
- **Failed repair:** if `RestructuringDocumentation.approve` refuses (for example, the proposal was discarded), the review stays approved and the proposal is unchanged. Record this in the design doc. The endpoint shows the proposal's real status, so the user never sees a false "Approved."

**Verify:** A test approves a review and checks that the proposal's status is `APPROVED`. A second test checks the refused case.

## R4.5 Reaction: requesting changes revises the proposal

**Belongs to:** backend step 6.6.

**Diff:** `src/compositions/ReviewWorkflow.ts`, `design/compositions/ReviewWorkflow.md`

```ts
const ChangesRequestedRevisesProposal = reaction(({ review, proposal }) =>
  when(ReviewingDocumentation.requestChanges({ review }).responds({}))
    .where(ReviewingDocumentation._get({ review }).is({ proposal }))
    .then(RestructuringDocumentation.revise({ restructuring: proposal })),
);
```

`revise` moves the proposal back to draft, so the author can edit it with `modify` (the reviewer feedback decision from 2026-10-17).

**Verify:** After a change request, the proposal is a draft and `modify` succeeds.

## R4.6 Reaction: resubmitting reopens the existing review

**Belongs to:** backend step 6.6. This settles the resubmission problem found on 2026-10-17.

**Diff:** `src/compositions/ReviewWorkflow.ts`, `design/compositions/ReviewWorkflow.md`

```ts
const ResubmitReopensReview = reaction(({ proposal, review }) =>
  when(RestructuringDocumentation.submit({ restructuring: proposal }).responds({}))
    .where(theReviewOf({ proposal }).is({ review }))
    .then(ReviewingDocumentation.reopen({ review })),
);
```

- A first submission has no review yet, so the `where` drops the case and nothing happens. The reviewer creates the review later with `/reviews/open`.
- A resubmission reuses the one review per proposal, so `ReviewingDocumentation.create` is never called twice.

**Decision:** Reviews are created by the reviewer (`/reviews/open`), not by a reaction on `submit`. Considered creating the review automatically on submit, but `submit` does not know who the reviewer is, and the MVP has no reviewer assignment.

**Verify:** The full cycle in one test: submit → open review → request changes → modify → submit → the review is pending again → approve → the proposal is approved.

# Phase R5: Composition checks

## R5.1 Check the composition design

**Belongs to:** backend step 7.1.

- `bun run check:design` and `bun run generate && bun run check`.
- Review `generated/application.md` and confirm that every reaction lists the trigger, condition, and effect described above.
- Confirm that there are no cycles: `revise` and `reopen` do not trigger `submit`, so R4.5 and R4.6 cannot loop.

**Verify:** All checks pass.

# Out of scope

- Notifications to reviewers (for example, "a proposal is waiting for you"). The review queue former covers this need for the MVP.
- Reactions for InvestigatingChanges, comments, and suggestions.
- Assigning reviewers, or requiring several approvals.
