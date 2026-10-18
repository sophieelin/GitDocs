# ReviewingDocumentation

## Purpose

Allow another developer to evaluate whether a proposed documentation structure
provides a coherent representation of the system, and record their decision.

## Principle

After Ari submits proposal `p-1`, Bo opens review `r-1` of it, and the review is
pending. The review of `p-1` is `r-1`, with Bo as its reviewer. Cy cannot open a
second review of `p-1`, and cannot approve Bo's review. Bo approves `r-1`, and
its decision is approved; approving it again is refused.

## Types

```types
external Restructuring
  A proposed documentation structure being evaluated.
external User
  A developer acting as a reviewer.
Decision is PENDING or APPROVED
  The decisions a review may hold.
```

## State

```state
a set of Reviews with
  a proposal Restructuring
  a reviewer User
  a decision Decision
  an openedAt DateTime
  an updatedAt DateTime
  unique proposal
```

## Actions

```actions
open(proposal: Restructuring, reviewer: User, at: DateTime) : returns (review: Review)
  where some review has proposal
  then
    refuses REVIEW_EXISTS "This proposal already has a review."
  where no review has proposal
  then
    add a new review with proposal, reviewer, decision PENDING, and at as its openedAt and updatedAt
    returns review

approve(review: Review, reviewer: User, at: DateTime) : returns ()
  where review is not in Reviews
  then
    refuses REVIEW_NOT_FOUND "There is no such review."
  where reviewer is not the review's reviewer
  then
    refuses NOT_REVIEWER "Only the review's reviewer can decide it."
  where the review's decision is not PENDING
  then
    refuses REVIEW_NOT_PENDING "This review has already been decided."
  where the reviewer's review is pending
  then
    set the review's decision to APPROVED and at as its updatedAt
    returns
```

## Queries

```queries
_get(review: Review) : optional (review: Review, proposal: Restructuring, reviewer: User, decision: Decision, openedAt: DateTime, updatedAt: DateTime)
  answers the review's proposal, reviewer, and decision
  answers no row for an unknown review

_forProposal(proposal: Restructuring) : optional (review: Review, reviewer: User, decision: Decision, openedAt: DateTime, updatedAt: DateTime)
  answers the proposal's review
  answers no row for a proposal that has no review
```
