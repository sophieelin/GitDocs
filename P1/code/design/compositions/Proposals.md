# Proposals

A proposal argues for a different documentation structure in response to a
submitted investigation. Each request is resolved through its active session
first, so the author is always the signed-in account.

A current account may [start a proposal from an investigation](reaction:Proposals.Writing.CreateProposal)
with a title and the documentation structure it saw at the investigated commit.
The repository and commit are read from the investigation, so a caller cannot
name a different commit; an investigation that does not exist answers
`INVESTIGATION_NOT_FOUND`. The proposal starts as a draft whose proposed
structure equals the current one.

```endpoints
Proposals.Writing.CreateProposal at /proposals/create
```

The author may [save the draft](reaction:Proposals.Writing.ModifyProposal) with
a new title, proposed structure, and rationale,
[submit it](reaction:Proposals.Writing.SubmitProposal) once it has a rationale,
or [discard it](reaction:Proposals.Writing.DiscardProposal). These need no view:
RestructuringDocumentation itself refuses anyone but the author
(`NOT_PROPOSAL_AUTHOR`) and anything but a draft (`NOT_DRAFT`), so a direct call
cannot skip the check. Each answers the proposal's identity.

Submitting names the proposal's one reviewer, by username. The reviewer must be
a registered account other than the proposal's author; otherwise the answer is
`INVALID_REVIEWER` and the draft is not submitted. Once the proposal is
submitted, a review is opened with that reviewer at the same instant, so it
shows up in the reviewer's queue below. Submitting and opening are two actions:
if opening were refused after the submit, the proposal would be pending with no
review. That cannot happen in the MVP, because only submitting opens a review
and a proposal is submitted once. A missing proposal answers
`PROPOSAL_NOT_FOUND`.

```endpoints
Proposals.Writing.ModifyProposal at /proposals/modify
Proposals.Writing.SubmitProposal at /proposals/submit
Proposals.Writing.DiscardProposal at /proposals/discard
```

A current account may [read a proposal](reaction:Proposals.Reading.GetProposal).
The answer is [the proposal with its current and proposed structures](former:Proposals.Reading.ProposalDetail):
its author, investigation, repository, commit, title, rationale, status, both
structures, and when it was created and last changed, together with
[its review](view:Policy.TheReviewOf)'s identity, reviewer, and decision, which
are empty while it has none. Who may read it follows three views, one per
branch, because a condition cannot say "or":

- when [the proposal is submitted](view:Proposals.Reading.ProposalIsSubmitted),
  that is, pending approval or approved, any current account reads it;
- when [it is a draft by the requester](view:Proposals.Reading.ProposalIsDraftByUser),
  its author reads it;
- when [it is a draft by someone else](view:Proposals.Reading.ProposalIsDraftByOther),
  the answer is `PROPOSAL_NOT_FOUND`, the same as for a proposal that does not
  exist, so others cannot tell that the draft exists.

```endpoints
Proposals.Reading.GetProposal at /proposals/get
```

A current account may [list a repository's proposals](reaction:Proposals.Reading.ListProposals).
The answer follows the same rule as reading one:
[the proposals of the repository that the requester may see](former:Proposals.Reading.RepositoryProposals)
are every submitted proposal, with its author and status, and the requester's
own drafts, each the most recently changed first. Another account's drafts are
not listed. The two are separate lists, because a condition cannot say "or".

```endpoints
Proposals.Reading.ListProposals at /proposals/list
```

A current account may [list the proposals waiting for its review](reaction:Proposals.Reading.ListProposalsUnderReview)
in a repository. The answer is
[the repository's proposals waiting for the requester's review](former:Proposals.Reading.ReviewQueue):
each proposal pending approval whose author named the requester as reviewer,
the longest waiting first, in the same shape as a submitted proposal in the
list above but without a status. An author never sees their own proposals
here, because they cannot be their own reviewer.

```endpoints
Proposals.Reading.ListProposalsUnderReview at /proposals/under-review
```
