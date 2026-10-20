# Proposals

A proposal argues for a different documentation structure after a commit. It is
one investigation together with the review that evaluates it. The application
shows only proposals: InvestigatingChanges holds the proposal and its status,
and ReviewingDocumentation its review. Restructuring is not a concept: it is
[the reaction](ReviewWorkflow.md) that approves the investigation when its
review is approved, and the git commands the proposal gives from then on, so
nothing changes before the proposal is reviewed. A proposal's identity is its
investigation's. Each request is resolved through
its active session first, so the author is always the signed-in account.

A current account may [start a proposal of a commit](reaction:Proposals.Writing.StartProposal)
with a title and the documentation structure it saw at that commit. The
application supplies the signed-in username as the investigator and the moment
of the request as when it was started, so a caller can choose neither. The
proposal starts as a draft with no highlights and no changes, whose proposed
structure equals the current one. A commit can have many proposals.

```endpoints
Proposals.Writing.StartProposal at /proposals/start
```

The author may [save the draft](reaction:Proposals.Writing.ModifyProposal) with
a new title, its list of changes to the structure, and a rationale. The changes
are moves (a rename is a move within its folder), new files, new folders, and
removed empty folders, in order, and the proposed structure is the current one
with them applied, so the two can never disagree. A list that does not fit the
structure is `INVALID_OPERATIONS`.

While the proposal is a draft, its author may also
[highlight text in a file](reaction:Proposals.Writing.HighlightProposal) at the
proposal's commit, naming the `file`, the first and last lines (`from` and
`to`), where the text starts on the first line and ends on the last (`start`
and `end`, counting characters from 0), and a comment on why it no longer
holds, and [remove a highlight](reaction:Proposals.Writing.UnhighlightProposal)
again. Its `kind` is `COMMENT` for a comment only, or `SUGGESTION` for a
suggested edit, whose `replacement` is the text to put in place of the
highlighted text (empty to delete it); a comment's `replacement` is empty. The
request names the file `file`, because the boundary owns a request's `path`. A
highlight with no comment or no valid range is `INVALID_HIGHLIGHT`, a
suggestion on text another suggestion in the file already covers is
`SUGGESTIONS_OVERLAP`, and removing one the proposal does not have is
`HIGHLIGHT_NOT_FOUND`. A highlight is saved at once, without waiting for the
draft to be saved.

The author may [discard the draft](reaction:Proposals.Writing.DiscardProposal)
or [submit it](reaction:Proposals.Writing.SubmitProposal) once it changes
something, by a change to the structure or a suggestion (`NO_CHANGES`
otherwise), and has a rationale (`RATIONALE_MISSING`). A proposal may change
only text within a document.
None of these need a view: InvestigatingChanges itself refuses anyone but the
author (`NOT_INVESTIGATOR`) and anything but a draft (`NOT_DRAFT`), so a direct
call cannot skip the check. A missing proposal answers
`INVESTIGATION_NOT_FOUND`. Saving, highlighting, and the rest answer the
proposal's identity; highlighting also answers the new highlight's.

Submitting names the proposal's one reviewer, by username. The reviewer must be
a registered account other than the proposal's author; otherwise the answer is
`INVALID_REVIEWER` and the draft is not submitted. Once the proposal is
submitted, a review is opened with that reviewer at the same instant, so it
shows up in the reviewer's queue below. Submitting and opening are two actions:
if opening were refused after the submit, the proposal would be submitted with
no review. That cannot happen in the MVP, because only submitting opens a
review and a proposal is submitted once.

```endpoints
Proposals.Writing.ModifyProposal at /proposals/modify
Proposals.Writing.HighlightProposal at /proposals/highlight
Proposals.Writing.UnhighlightProposal at /proposals/unhighlight
Proposals.Writing.SubmitProposal at /proposals/submit
Proposals.Writing.DiscardProposal at /proposals/discard
```

Approving the review approves the proposal through
[the review workflow](ReviewWorkflow.md). An approved proposal gives the git
commands that make its changes to the structure; the editor also offers a
patch, built in the browser from the files at the commit, that makes both
those changes and the suggested edits. The author runs the commands or applies
the patch in a clone of the repository, pushes, and then
[marks the proposal applied](reaction:Proposals.Applying.ApplyProposal) with
the full SHA of the commit that did it. This needs no view: InvestigatingChanges
itself refuses anyone but the author (`NOT_INVESTIGATOR`), a proposal that is
not approved or is already applied (`NOT_APPROVED`), and a commit that is not a
full SHA (`INVALID_COMMIT`). Marking it applied answers the proposal's
identity.

```endpoints
Proposals.Applying.ApplyProposal at /proposals/apply
```

A current account may [read a proposal](reaction:Proposals.Reading.GetProposal).
The answer is [the proposal with its structures and changes](former:Proposals.Reading.ProposalDetail):
its author, repository, commit, title, rationale, status, applied commit, both
structures, its list of changes, when it was started and last changed, and its
highlights in the order they were added; together with
[its review](view:Policy.TheReviewOf)'s identity, reviewer, and decision, which
are empty while it has none. Only when
[the proposal is approved](view:Proposals.Reading.ProposalIsApproved), that is,
approved or applied, does the answer list its git commands; before that the
list is empty, so no one acts on a change that has not been reviewed. Who may
read it follows three views, one per branch, because a condition cannot say
"or":

- when [the proposal is submitted](view:Proposals.Reading.ProposalIsSubmitted),
  that is, in any status after a draft, any current account reads it;
- when [it is a draft by the requester](view:Proposals.Reading.ProposalIsDraftByUser),
  its author reads it;
- when [it is a draft by someone else](view:Proposals.Reading.ProposalIsDraftByOther),
  the answer is `INVESTIGATION_NOT_FOUND`, the same as for a proposal that does
  not exist, so others cannot tell that the draft exists.

```endpoints
Proposals.Reading.GetProposal at /proposals/get
```

A current account may [list a repository's proposals](reaction:Proposals.Reading.ListProposals)
or [list one commit's proposals](reaction:Proposals.Reading.ListCommitProposals).
Both follow the same rule as reading one:
[the proposals of the repository](former:Proposals.Reading.RepositoryProposals)
and [the proposals of the commit](former:Proposals.Reading.CommitProposals)
that the requester may see are every submitted proposal, with its author,
status, and [review decision](former:Proposals.Reading.ReviewDecision), empty
while it has no review, and the requester's own
drafts, each the most recently changed first. Another account's drafts are not
listed. The two are separate lists, because a condition cannot say "or".

```endpoints
Proposals.Reading.ListProposals at /proposals/list
Proposals.Reading.ListCommitProposals at /proposals/for-commit
```

A current account may [list the proposals waiting for its review](reaction:Proposals.Reading.ListProposalsUnderReview)
in a repository. The answer is
[the repository's proposals waiting for the requester's review](former:Proposals.Reading.ReviewQueue):
each proposal whose status is submitted, not yet approved, and whose author named
the requester as reviewer, the longest waiting first. An author never sees
their own proposals here, because they cannot be their own reviewer.

```endpoints
Proposals.Reading.ListProposalsUnderReview at /proposals/under-review
```
