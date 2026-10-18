# Review Workflow

A review's decision and its proposal's status are kept in step by reactions.
RestructuringDocumentation stays the authority on a proposal's status; a review
only asks it to change.

When a reviewer approves a review,
[the review's proposal is approved](reaction:ReviewWorkflow.ApprovalApprovesProposal)
at the same instant, so the proposal's last change matches the review's.

- **False interval:** between the two actions, the review is approved while
  the proposal is still pending approval. The approve endpoint waits until the
  flow settles before it answers, so the reviewer never sees this interval.
- **Failed repair:** if the proposal is no longer pending, RestructuringDocumentation
  refuses with `PROPOSAL_NOT_PENDING`. The review stays approved and the
  proposal keeps its status. In the MVP this cannot happen through the
  endpoints, because a proposal has one review and only that review approves
  it. Every answer reads the proposal's real status, so no one sees a false
  *Approved*.
