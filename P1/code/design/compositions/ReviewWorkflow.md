# Review Workflow

Restructuring is a reaction, not a concept. A review's decision and its
proposal's status are kept in step by it, and InvestigatingChanges stays the
authority on the status; a review only asks it to change. A proposal is
approved only through its review, so the documentation changes only after
review.

When a reviewer approves a review,
[the review's investigation is approved](reaction:ReviewWorkflow.ApprovalApprovesInvestigation)
at the same instant, so the investigation's last change matches the review's.
From then on, the proposal gives the git commands that carry out its changes.

- **False interval:** between the two actions, the review is approved while
  the investigation is still submitted. The approve endpoint waits until the
  flow settles before it answers, so the reviewer never sees this interval.
- **Failed repair:** if the investigation is no longer submitted,
  InvestigatingChanges refuses with `INVESTIGATION_NOT_PENDING`. The review
  stays approved and the investigation keeps its status. In the MVP this cannot
  happen through the endpoints, because a proposal has one review and only that
  review approves it. Every answer reads the investigation's real status, and
  commands are shown only for an approved one, so no one sees a false
  *Approved*.
