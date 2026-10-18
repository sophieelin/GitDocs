# Policy

Views about reviews that more than one answer reads. The author names a
proposal's reviewer when submitting it (see [Proposals](Proposals.md)), so no
view decides who may review, and approving needs none either:
ReviewingDocumentation refuses anyone but the review's reviewer.

A proposal has at most one review, so
[the review of a proposal](view:Policy.TheReviewOf) is optional: it answers the
review's identity, reviewer, and decision, or nothing for a proposal that has
not been submitted. Proposal answers read it under `whether`, so a proposal
without a review still appears, with empty review fields. The review queue
reads it plainly, to keep only the proposals whose reviewer is the requester.
