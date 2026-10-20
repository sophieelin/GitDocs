# Reviews

A review is the decision of the reviewer a proposal's author named. It is
opened when the proposal is [submitted](reaction:Proposals.Writing.SubmitProposal),
so there is no endpoint for opening one. Each request is resolved through its
active session first, so the reviewer is always the signed-in account.

A current account may [read a review](reaction:Reviews.Reading.GetReview). The
answer is [the review with its proposal](former:Reviews.Reading.ReviewDetail):
its reviewer, decision, when it was opened and last changed, and the full
proposal with both structures, so a review screen needs one request. A review
that does not exist answers `REVIEW_NOT_FOUND`.

```endpoints
Reviews.Reading.GetReview at /reviews/get
```

The reviewer may [approve the review](reaction:Reviews.Deciding.ApproveReview).
This needs no view: ReviewingDocumentation itself refuses anyone but the
reviewer (`NOT_REVIEWER`) and a review already decided (`REVIEW_NOT_PENDING`).
Approving the review approves its proposal through
[the review workflow](ReviewWorkflow.md). The endpoint answers once that has
run, with the proposal as [reading it](former:Proposals.Reading.ProposalDetail)
answers, so the reviewer sees the proposal's real status and its git commands.

```endpoints
Reviews.Deciding.ApproveReview at /reviews/approve
```
