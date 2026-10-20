<!-- Generated from the Application assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Application — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `authenticate(githubId: String, login: String, token: Secret) : returns (account: Account)`
  - Refuses `INVALID_IDENTITY`: GitHub did not give a usable identity.
  - Refuses `USERNAME_TAKEN`: That GitHub name belongs to another account here.

#### Queries

- `_registered(username: String) : one (registered: Flag)`
- `_token(username: String) : optional (token: Secret)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [GitDocs Application Types](../design/types.md), line 15.

### InvestigatingChanges

Defined in [InvestigatingChanges](../design/concepts/InvestigatingChanges.md), line 1.

#### Actions

- `start(investigator: User, owner: String, name: String, commit: String, title: String, currentStructure: DocumentationTree, at: DateTime) : returns (investigation: Investigation)`
  - Refuses `INVALID_REPOSITORY`: A repository needs an owner and a name.
  - Refuses `INVALID_COMMIT`: An investigation needs a full commit SHA.
  - Refuses `INVALID_TITLE`: An investigation needs a title of at most 120 characters.
  - Refuses `INVALID_STRUCTURE`: That is not a documentation structure.
- `modify(investigation: Investigation, investigator: User, title: String, operations: OperationList, rationale: String, at: DateTime) : returns ()`
  - Refuses `INVESTIGATION_NOT_FOUND`: There is no such investigation.
  - Refuses `NOT_INVESTIGATOR`: Only the investigation's author can change it.
  - Refuses `NOT_DRAFT`: Only a draft investigation can be changed.
  - Refuses `INVALID_TITLE`: An investigation needs a title of at most 120 characters.
  - Refuses `INVALID_OPERATIONS`: Those changes do not fit the documentation structure.
- `highlight(investigation: Investigation, investigator: User, path: String, from: Number, to: Number, start: Number, end: Number, text: String, kind: HighlightKind, replacement: String, at: DateTime) : returns (highlight: Highlight)`
  - Refuses `INVESTIGATION_NOT_FOUND`: There is no such investigation.
  - Refuses `NOT_INVESTIGATOR`: Only the investigation's author can change it.
  - Refuses `NOT_DRAFT`: Only a draft investigation can be changed.
  - Refuses `INVALID_HIGHLIGHT`: A highlight needs a file, the text it is on, and a comment.
  - Refuses `SUGGESTIONS_OVERLAP`: A suggestion cannot overlap another suggestion in the same file.
- `unhighlight(investigation: Investigation, investigator: User, highlight: Highlight, at: DateTime) : returns ()`
  - Refuses `INVESTIGATION_NOT_FOUND`: There is no such investigation.
  - Refuses `NOT_INVESTIGATOR`: Only the investigation's author can change it.
  - Refuses `NOT_DRAFT`: Only a draft investigation can be changed.
  - Refuses `HIGHLIGHT_NOT_FOUND`: There is no such highlight on this investigation.
- `submit(investigation: Investigation, investigator: User, at: DateTime) : returns ()`
  - Refuses `INVESTIGATION_NOT_FOUND`: There is no such investigation.
  - Refuses `NOT_INVESTIGATOR`: Only the investigation's author can change it.
  - Refuses `NOT_DRAFT`: Only a draft investigation can be changed.
  - Refuses `NO_CHANGES`: Change the documentation structure or suggest an edit before submitting.
  - Refuses `RATIONALE_MISSING`: Explain the proposed changes before submitting them.
- `discard(investigation: Investigation, investigator: User) : returns ()`
  - Refuses `INVESTIGATION_NOT_FOUND`: There is no such investigation.
  - Refuses `NOT_INVESTIGATOR`: Only the investigation's author can change it.
  - Refuses `NOT_DRAFT`: Only a draft investigation can be changed.
- `approve(investigation: Investigation, at: DateTime) : returns ()`
  - Refuses `INVESTIGATION_NOT_FOUND`: There is no such investigation.
  - Refuses `INVESTIGATION_NOT_PENDING`: Only a submitted investigation can be approved.
- `apply(investigation: Investigation, investigator: User, commit: String, at: DateTime) : returns ()`
  - Refuses `INVESTIGATION_NOT_FOUND`: There is no such investigation.
  - Refuses `NOT_INVESTIGATOR`: Only the investigation's author can change it.
  - Refuses `NOT_APPROVED`: Only an approved investigation can be applied, and only once.
  - Refuses `INVALID_COMMIT`: Give the full SHA of the commit that applied the changes.

#### Queries

- `_get(investigation: Investigation) : optional (investigation: Investigation, investigator: User, owner: String, name: String, commit: String, title: String, rationale: String, status: Status, appliedCommit: String, currentStructure: DocumentationTree, operations: OperationList, proposedStructure: DocumentationTree, createdAt: DateTime, updatedAt: DateTime)`
- `_highlights(investigation: Investigation) : many (highlight: Highlight, path: String, from: Number, to: Number, start: Number, end: Number, text: String, kind: HighlightKind, replacement: String)`
- `_forRepository(owner: String, name: String) : many (investigation: Investigation, investigator: User, commit: String, title: String, status: Status, updatedAt: DateTime)`
- `_forCommit(owner: String, name: String, commit: String) : many (investigation: Investigation, investigator: User, title: String, status: Status, updatedAt: DateTime)`
- `_commands(investigation: Investigation) : many (command: String)`

#### Instances

- `InvestigatingChanges` — instance of `InvestigatingChanges` — [GitDocs Application Types](../design/types.md), line 23.
  - `User` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 24.

### RepositoryAccess

Defined in [RepositoryAccess](../design/concepts/RepositoryAccess.md), line 1.

#### Actions

- `record(user: User, owner: String, name: String, canPush: Flag, at: DateTime) : returns ()`
  - Refuses `INVALID_REPOSITORY`: A repository needs an owner and a name.
- `authorize(user: User, owner: String, name: String, at: DateTime) : returns ()`
  - Refuses `NO_PUSH_ACCESS`: Only people who can push to this repository on GitHub can change its proposals.

#### Queries

- `_canPush(user: User, owner: String, name: String, at: DateTime) : one (canPush: Flag)`

#### Instances

- `RepositoryAccess` — instance of `RepositoryAccess` — [GitDocs Application Types](../design/types.md), line 20.
  - `User` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 21.

### ReviewingDocumentation

Defined in [ReviewingDocumentation](../design/concepts/ReviewingDocumentation.md), line 1.

#### Actions

- `open(proposal: Proposal, reviewer: User, at: DateTime) : returns (review: Review)`
  - Refuses `REVIEW_EXISTS`: This proposal already has a review.
- `approve(review: Review, reviewer: User, at: DateTime) : returns ()`
  - Refuses `REVIEW_NOT_FOUND`: There is no such review.
  - Refuses `NOT_REVIEWER`: Only the review's reviewer can decide it.
  - Refuses `REVIEW_NOT_PENDING`: This review has already been decided.

#### Queries

- `_get(review: Review) : optional (review: Review, proposal: Proposal, reviewer: User, decision: Decision, openedAt: DateTime, updatedAt: DateTime)`
- `_forProposal(proposal: Proposal) : optional (review: Review, reviewer: User, decision: Decision, openedAt: DateTime, updatedAt: DateTime)`

#### Instances

- `ReviewingDocumentation` — instance of `ReviewingDocumentation` — [GitDocs Application Types](../design/types.md), line 26.
  - `Proposal` is `InvestigatingChanges.Investigation` — [GitDocs Application Types](../design/types.md), line 27.
  - `User` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 28.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(subject: Subject) : returns (session: Session, expiresAt: DateTime)`
- `current(session: Session) : returns (subject: Subject)`
  - Refuses `UNKNOWN_SESSION`: This session is not active.
- `end(session: Session) : returns (ended: Flag)`
  - Refuses `UNKNOWN_SESSION`: This session is not active.

#### Queries

- `_active(session: Session) : optional (subject: Subject, expiresAt: DateTime)`

#### Instances

- `Sessioning` — instance of `Sessioning` — [GitDocs Application Types](../design/types.md), line 17.
  - `Subject` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 18.

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### (proposal) is a draft by (user)

Authored path: `Proposals.Reading.ProposalIsDraftByUser`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 118.

```view
(proposal) is a draft by (user) — inputs (proposal, user); outputs (); bindings ()
  where InvestigatingChanges._get (investigation: proposal) has (investigator: user, status: "DRAFT")
```

### (proposal) is a draft by someone other than (user)

Authored path: `Proposals.Reading.ProposalIsDraftByOther`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 120.

```view
(proposal) is a draft by someone other than (user) — inputs (proposal, user); outputs (); bindings ()
  where
    InvestigatingChanges._get (investigation: proposal) has (status: "DRAFT")
    InvestigatingChanges._get (investigation: proposal) and not (investigator: user)
```

### (proposal) is approved

Authored path: `Proposals.Reading.ProposalIsApproved`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 110.

```view
(proposal) is approved — inputs (proposal); outputs (); bindings (status)
  where
    InvestigatingChanges._get (investigation: proposal) has (status)
    status is among ["APPROVED", "APPLIED"]
```

### (proposal) is submitted

Authored path: `Proposals.Reading.ProposalIsSubmitted`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 116.

```view
(proposal) is submitted — inputs (proposal); outputs (); bindings (status)
  where
    InvestigatingChanges._get (investigation: proposal) has (status)
    status is among ["SUBMITTED", "APPROVED", "APPLIED"]
```

### the review of (proposal)

Authored path: `Policy.TheReviewOf`.
- Covered by [Policy](../design/compositions/Policy.md), line 9.
- Covered by [Proposals](../design/compositions/Proposals.md), line 108.

```view
the review of (proposal) — inputs (proposal); outputs (review, reviewer, decision); bindings () — answers at most one (review, reviewer, decision)
  where ReviewingDocumentation._forProposal (proposal) has (decision, review, reviewer)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### a proposal with its current and proposed structures

Authored path: `Proposals.Reading.ProposalDetail`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 104.
- Covered by [Reviews](../design/compositions/Reviews.md), line 26.

```former
Former "a proposal with its current and proposed structures" — inputs (proposal); bindings (author, owner, name, commit, title, rationale, status, appliedCommit, currentStructure, operations, proposedStructure, createdAt, updatedAt, review, reviewer, decision, highlight, path, from, to, start, end, text, kind, replacement, command); promises exactly one record — forms:
  a record of
    where InvestigatingChanges._get (investigation: proposal) has (appliedCommit, commit, createdAt, currentStructure, investigator: author, name, operations, owner, proposedStructure, rationale, status, title, updatedAt)
    where whether view "the review of (proposal)" with (proposal) has (decision, review, reviewer)
    appliedCommit
    author
    commands: each InvestigatingChanges._commands (investigation: proposal) has (command)
      where view "(proposal) is approved" with (proposal)
      form a record of
        command
    commit
    createdAt
    currentStructure
    decision
    highlights: each InvestigatingChanges._highlights (investigation: proposal) has (end, from, highlight, kind, path, replacement, start, text, to)
      form a record of
        end
        from
        highlight
        kind
        path
        replacement
        start
        text
        to
    name
    operations
    owner
    proposal
    proposedStructure
    rationale
    review
    reviewer
    status
    title
    updatedAt
```

### a review with its proposal

Authored path: `Reviews.Reading.ReviewDetail`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 9.

```former
Former "a review with its proposal" — inputs (review); bindings (proposal, reviewer, decision, openedAt, updatedAt); promises exactly one record — forms:
  a record of
    where ReviewingDocumentation._get (review) has (decision, openedAt, proposal, reviewer, updatedAt)
    decision
    openedAt
    proposal: former "a proposal with its current and proposed structures" with (proposal)
    review
    reviewer
    updatedAt
```

### the review decision of (proposal)

Authored path: `Proposals.Reading.ReviewDecision`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 134.

```former
Former "the review decision of (proposal)" — inputs (proposal); bindings (decision); promises at most one record — forms:
  a record of
    where view "the review of (proposal)" with (proposal) has (decision)
    decision
```

### the proposals of a commit that (user) may see

Authored path: `Proposals.Reading.CommitProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 132.

```former
Former "the proposals of a commit that (user) may see" — inputs (owner, name, commit, user); bindings (proposal, author, title, status, updatedAt); promises exactly one record — forms:
  a record of
    drafts: each InvestigatingChanges._forCommit (commit, name, owner) has (investigation: proposal, investigator: user, status: "DRAFT", title, updatedAt)
      arranged by updatedAt, descending
      form a record of
        proposal
        title
        updatedAt
    submitted: each InvestigatingChanges._forCommit (commit, name, owner) has (investigation: proposal, investigator: author, status, title, updatedAt)
      where status is among ["SUBMITTED", "APPROVED", "APPLIED"]
      arranged by updatedAt, descending
      form a record of
        author
        proposal
        status
        title
        updatedAt
        … former "the review decision of (proposal)" with (proposal), with blank leaves if absent
```

### the proposals of a repository that (user) may see

Authored path: `Proposals.Reading.RepositoryProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 131.

```former
Former "the proposals of a repository that (user) may see" — inputs (owner, name, user); bindings (proposal, author, commit, title, status, updatedAt); promises exactly one record — forms:
  a record of
    drafts: each InvestigatingChanges._forRepository (name, owner) has (commit, investigation: proposal, investigator: user, status: "DRAFT", title, updatedAt)
      arranged by updatedAt, descending
      form a record of
        commit
        proposal
        title
        updatedAt
    submitted: each InvestigatingChanges._forRepository (name, owner) has (commit, investigation: proposal, investigator: author, status, title, updatedAt)
      where status is among ["SUBMITTED", "APPROVED", "APPLIED"]
      arranged by updatedAt, descending
      form a record of
        author
        commit
        proposal
        status
        title
        updatedAt
        … former "the review decision of (proposal)" with (proposal), with blank leaves if absent
```

### the proposals of a repository waiting for (user)'s review

Authored path: `Proposals.Reading.ReviewQueue`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 146.

```former
Former "the proposals of a repository waiting for (user)'s review" — inputs (owner, name, user); bindings (proposal, author, commit, title, updatedAt); promises exactly one record — forms:
  a record of
    proposals: each InvestigatingChanges._forRepository (name, owner) has (commit, investigation: proposal, investigator: author, status: "SUBMITTED", title, updatedAt)
      where view "the review of (proposal)" with (proposal) has (reviewer: user)
      arranged by updatedAt
      form a record of
        author
        commit
        proposal
        title
        updatedAt
```

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### Proposals.Applying.ApplyProposal

Authored path: `Proposals.Applying.ApplyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 92.
- Covered by [Proposals](../design/compositions/Proposals.md), line 100.

```reaction
when RequestBoundary.request (commit, path: "/proposals/apply", proposal, requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Applying.ApplyProposal:found#2

Authored path: `Proposals.Applying.ApplyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 92.
- Covered by [Proposals](../design/compositions/Proposals.md), line 100.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Applying.ApplyProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (commit, path: "/proposals/apply", proposal, requestId, session)
  InvestigatingChanges._get (investigation: proposal) has (name, owner)
then
  RepositoryAccess.authorize (at, name, owner, user)
```

### Proposals.Applying.ApplyProposal:found#3

Authored path: `Proposals.Applying.ApplyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 92.
- Covered by [Proposals](../design/compositions/Proposals.md), line 100.

```reaction
when RepositoryAccess.authorize (at, name, owner, user), asked by Proposals.Applying.ApplyProposal:found#2
where
  earlier, RequestBoundary.request (commit, path: "/proposals/apply", proposal, requestId, session)
then
  InvestigatingChanges.apply (at, commit, investigation: proposal, investigator: user)
```

### Proposals.Applying.ApplyProposal:found#4

Authored path: `Proposals.Applying.ApplyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 92.
- Covered by [Proposals](../design/compositions/Proposals.md), line 100.

```reaction
when InvestigatingChanges.apply (at, commit, investigation: proposal, investigator: user), asked by Proposals.Applying.ApplyProposal:found#3
where
  earlier, RequestBoundary.request (commit, path: "/proposals/apply", proposal, requestId, session)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Applying.ApplyProposal:missing#2

Authored path: `Proposals.Applying.ApplyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 92.
- Covered by [Proposals](../design/compositions/Proposals.md), line 100.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Applying.ApplyProposal
where
  earlier, RequestBoundary.request (commit, path: "/proposals/apply", proposal, requestId, session)
  no InvestigatingChanges._get (investigation: proposal)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Proposals.Reading.GetProposal

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 103.
- Covered by [Proposals](../design/compositions/Proposals.md), line 125.

```reaction
when RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Reading.GetProposal:missing#2

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 103.
- Covered by [Proposals](../design/compositions/Proposals.md), line 125.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.GetProposal
where
  earlier, RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
  no InvestigatingChanges._get (investigation: proposal)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Proposals.Reading.GetProposal:others-draft#2

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 103.
- Covered by [Proposals](../design/compositions/Proposals.md), line 125.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.GetProposal
where
  earlier, RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
  view "(proposal) is a draft by someone other than (user)" with (proposal, user)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Proposals.Reading.GetProposal:own-draft#2

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 103.
- Covered by [Proposals](../design/compositions/Proposals.md), line 125.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.GetProposal
where
  earlier, RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
  view "(proposal) is a draft by (user)" with (proposal, user)
then
  RequestBoundary.respond (proposal: former "a proposal with its current and proposed structures" with (proposal), requestId)
```

### Proposals.Reading.GetProposal:submitted#2

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 103.
- Covered by [Proposals](../design/compositions/Proposals.md), line 125.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.GetProposal
where
  earlier, RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
  view "(proposal) is submitted" with (proposal)
then
  RequestBoundary.respond (proposal: former "a proposal with its current and proposed structures" with (proposal), requestId)
```

### Proposals.Reading.ListCommitProposals

Authored path: `Proposals.Reading.ListCommitProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 129.
- Covered by [Proposals](../design/compositions/Proposals.md), line 141.

```reaction
when RequestBoundary.request (commit, name, owner, path: "/proposals/for-commit", requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Reading.ListCommitProposals#2

Authored path: `Proposals.Reading.ListCommitProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 129.
- Covered by [Proposals](../design/compositions/Proposals.md), line 141.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.ListCommitProposals
where
  earlier, RequestBoundary.request (commit, name, owner, path: "/proposals/for-commit", requestId, session)
then
  RequestBoundary.respond (commit: former "the proposals of a commit that (user) may see" with (commit, name, owner, user), requestId)
```

### Proposals.Reading.ListProposals

Authored path: `Proposals.Reading.ListProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 128.
- Covered by [Proposals](../design/compositions/Proposals.md), line 140.

```reaction
when RequestBoundary.request (name, owner, path: "/proposals/list", requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Reading.ListProposals#2

Authored path: `Proposals.Reading.ListProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 128.
- Covered by [Proposals](../design/compositions/Proposals.md), line 140.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.ListProposals
where
  earlier, RequestBoundary.request (name, owner, path: "/proposals/list", requestId, session)
then
  RequestBoundary.respond (repository: former "the proposals of a repository that (user) may see" with (name, owner, user), requestId)
```

### Proposals.Reading.ListProposalsUnderReview

Authored path: `Proposals.Reading.ListProposalsUnderReview`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 144.
- Covered by [Proposals](../design/compositions/Proposals.md), line 152.

```reaction
when RequestBoundary.request (name, owner, path: "/proposals/under-review", requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Reading.ListProposalsUnderReview#2

Authored path: `Proposals.Reading.ListProposalsUnderReview`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 144.
- Covered by [Proposals](../design/compositions/Proposals.md), line 152.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.ListProposalsUnderReview
where
  earlier, RequestBoundary.request (name, owner, path: "/proposals/under-review", requestId, session)
then
  RequestBoundary.respond (repository: former "the proposals of a repository waiting for (user)'s review" with (name, owner, user), requestId)
```

### Proposals.Writing.DiscardProposal

Authored path: `Proposals.Writing.DiscardProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 58.
- Covered by [Proposals](../design/compositions/Proposals.md), line 83.

```reaction
when RequestBoundary.request (path: "/proposals/discard", proposal, requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Writing.DiscardProposal#2

Authored path: `Proposals.Writing.DiscardProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 58.
- Covered by [Proposals](../design/compositions/Proposals.md), line 83.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.DiscardProposal
where
  earlier, RequestBoundary.request (path: "/proposals/discard", proposal, requestId, session)
then
  InvestigatingChanges.discard (investigation: proposal, investigator: user)
```

### Proposals.Writing.DiscardProposal#3

Authored path: `Proposals.Writing.DiscardProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 58.
- Covered by [Proposals](../design/compositions/Proposals.md), line 83.

```reaction
when InvestigatingChanges.discard (investigation: proposal, investigator: user), asked by Proposals.Writing.DiscardProposal#2
where
  earlier, RequestBoundary.request (path: "/proposals/discard", proposal, requestId, session)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Writing.HighlightProposal

Authored path: `Proposals.Writing.HighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 43.
- Covered by [Proposals](../design/compositions/Proposals.md), line 80.

```reaction
when RequestBoundary.request (end, file, from, kind, path: "/proposals/highlight", proposal, replacement, requestId, session, start, text, to)
then
  Sessioning.current (session)
```

### Proposals.Writing.HighlightProposal:found#2

Authored path: `Proposals.Writing.HighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 43.
- Covered by [Proposals](../design/compositions/Proposals.md), line 80.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.HighlightProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (end, file, from, kind, path: "/proposals/highlight", proposal, replacement, requestId, session, start, text, to)
  InvestigatingChanges._get (investigation: proposal) has (name, owner)
then
  RepositoryAccess.authorize (at, name, owner, user)
```

### Proposals.Writing.HighlightProposal:found#3

Authored path: `Proposals.Writing.HighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 43.
- Covered by [Proposals](../design/compositions/Proposals.md), line 80.

```reaction
when RepositoryAccess.authorize (at, name, owner, user), asked by Proposals.Writing.HighlightProposal:found#2
where
  earlier, RequestBoundary.request (end, file, from, kind, path: "/proposals/highlight", proposal, replacement, requestId, session, start, text, to)
then
  InvestigatingChanges.highlight (at, end, from, investigation: proposal, investigator: user, kind, path: file, replacement, start, text, to)
```

### Proposals.Writing.HighlightProposal:found#4

Authored path: `Proposals.Writing.HighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 43.
- Covered by [Proposals](../design/compositions/Proposals.md), line 80.

```reaction
when InvestigatingChanges.highlight (at, end, from, investigation: proposal, investigator: user, kind, path: file, replacement, start, text, to, highlight), asked by Proposals.Writing.HighlightProposal:found#3
where
  earlier, RequestBoundary.request (end, file, from, kind, path: "/proposals/highlight", proposal, replacement, requestId, session, start, text, to)
then
  RequestBoundary.respond (highlight, proposal, requestId)
```

### Proposals.Writing.HighlightProposal:missing#2

Authored path: `Proposals.Writing.HighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 43.
- Covered by [Proposals](../design/compositions/Proposals.md), line 80.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.HighlightProposal
where
  earlier, RequestBoundary.request (end, file, from, kind, path: "/proposals/highlight", proposal, replacement, requestId, session, start, text, to)
  no InvestigatingChanges._get (investigation: proposal)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Proposals.Writing.ModifyProposal

Authored path: `Proposals.Writing.ModifyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 35.
- Covered by [Proposals](../design/compositions/Proposals.md), line 79.

```reaction
when RequestBoundary.request (operations, path: "/proposals/modify", proposal, rationale, requestId, session, title)
then
  Sessioning.current (session)
```

### Proposals.Writing.ModifyProposal:found#2

Authored path: `Proposals.Writing.ModifyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 35.
- Covered by [Proposals](../design/compositions/Proposals.md), line 79.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.ModifyProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (operations, path: "/proposals/modify", proposal, rationale, requestId, session, title)
  InvestigatingChanges._get (investigation: proposal) has (name, owner)
then
  RepositoryAccess.authorize (at, name, owner, user)
```

### Proposals.Writing.ModifyProposal:found#3

Authored path: `Proposals.Writing.ModifyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 35.
- Covered by [Proposals](../design/compositions/Proposals.md), line 79.

```reaction
when RepositoryAccess.authorize (at, name, owner, user), asked by Proposals.Writing.ModifyProposal:found#2
where
  earlier, RequestBoundary.request (operations, path: "/proposals/modify", proposal, rationale, requestId, session, title)
then
  InvestigatingChanges.modify (at, investigation: proposal, investigator: user, operations, rationale, title)
```

### Proposals.Writing.ModifyProposal:found#4

Authored path: `Proposals.Writing.ModifyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 35.
- Covered by [Proposals](../design/compositions/Proposals.md), line 79.

```reaction
when InvestigatingChanges.modify (at, investigation: proposal, investigator: user, operations, rationale, title), asked by Proposals.Writing.ModifyProposal:found#3
where
  earlier, RequestBoundary.request (operations, path: "/proposals/modify", proposal, rationale, requestId, session, title)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Writing.ModifyProposal:missing#2

Authored path: `Proposals.Writing.ModifyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 35.
- Covered by [Proposals](../design/compositions/Proposals.md), line 79.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.ModifyProposal
where
  earlier, RequestBoundary.request (operations, path: "/proposals/modify", proposal, rationale, requestId, session, title)
  no InvestigatingChanges._get (investigation: proposal)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Proposals.Writing.StartProposal

Authored path: `Proposals.Writing.StartProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 24.
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.

```reaction
when RequestBoundary.request (commit, currentStructure, name, owner, path: "/proposals/start", requestId, session, title)
then
  Sessioning.current (session)
```

### Proposals.Writing.StartProposal#2

Authored path: `Proposals.Writing.StartProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 24.
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.StartProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (commit, currentStructure, name, owner, path: "/proposals/start", requestId, session, title)
then
  RepositoryAccess.authorize (at, name, owner, user)
```

### Proposals.Writing.StartProposal#3

Authored path: `Proposals.Writing.StartProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 24.
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.

```reaction
when RepositoryAccess.authorize (at, name, owner, user), asked by Proposals.Writing.StartProposal#2
where
  earlier, RequestBoundary.request (commit, currentStructure, name, owner, path: "/proposals/start", requestId, session, title)
then
  InvestigatingChanges.start (at, commit, currentStructure, investigator: user, name, owner, title)
```

### Proposals.Writing.StartProposal#4

Authored path: `Proposals.Writing.StartProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 24.
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.

```reaction
when InvestigatingChanges.start (at, commit, currentStructure, investigator: user, name, owner, title, investigation: proposal), asked by Proposals.Writing.StartProposal#3
where
  earlier, RequestBoundary.request (commit, currentStructure, name, owner, path: "/proposals/start", requestId, session, title)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Writing.SubmitProposal

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 59.
- Covered by [Proposals](../design/compositions/Proposals.md), line 82.
- Covered by [Reviews](../design/compositions/Reviews.md), line 4.

```reaction
when RequestBoundary.request (path: "/proposals/submit", proposal, requestId, reviewer, session)
then
  Sessioning.current (session)
```

### Proposals.Writing.SubmitProposal:allowed#2

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 59.
- Covered by [Proposals](../design/compositions/Proposals.md), line 82.
- Covered by [Reviews](../design/compositions/Reviews.md), line 4.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.SubmitProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, reviewer, session)
  Authenticating._registered (username: reviewer) has (registered: true)
  InvestigatingChanges._get (investigation: proposal) and not (investigator: reviewer)
  InvestigatingChanges._get (investigation: proposal) has (name, owner)
then
  RepositoryAccess.authorize (at, name, owner, user)
```

### Proposals.Writing.SubmitProposal:allowed#3

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 59.
- Covered by [Proposals](../design/compositions/Proposals.md), line 82.
- Covered by [Reviews](../design/compositions/Reviews.md), line 4.

```reaction
when RepositoryAccess.authorize (at, name, owner, user), asked by Proposals.Writing.SubmitProposal:allowed#2
where
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, reviewer, session)
then
  InvestigatingChanges.submit (at, investigation: proposal, investigator: user)
```

### Proposals.Writing.SubmitProposal:allowed#4

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 59.
- Covered by [Proposals](../design/compositions/Proposals.md), line 82.
- Covered by [Reviews](../design/compositions/Reviews.md), line 4.

```reaction
when InvestigatingChanges.submit (at, investigation: proposal, investigator: user), asked by Proposals.Writing.SubmitProposal:allowed#3
where
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, reviewer, session)
then
  ReviewingDocumentation.open (at, proposal, reviewer)
```

### Proposals.Writing.SubmitProposal:allowed#5

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 59.
- Covered by [Proposals](../design/compositions/Proposals.md), line 82.
- Covered by [Reviews](../design/compositions/Reviews.md), line 4.

```reaction
when ReviewingDocumentation.open (at, proposal, reviewer, review), asked by Proposals.Writing.SubmitProposal:allowed#4
where
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, reviewer, session)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Writing.SubmitProposal:missing#2

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 59.
- Covered by [Proposals](../design/compositions/Proposals.md), line 82.
- Covered by [Reviews](../design/compositions/Reviews.md), line 4.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.SubmitProposal
where
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, reviewer, session)
  no InvestigatingChanges._get (investigation: proposal)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Proposals.Writing.SubmitProposal:own-reviewer#2

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 59.
- Covered by [Proposals](../design/compositions/Proposals.md), line 82.
- Covered by [Reviews](../design/compositions/Reviews.md), line 4.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.SubmitProposal
where
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, reviewer, session)
  InvestigatingChanges._get (investigation: proposal) has (investigator: reviewer)
then
  RequestBoundary.respond (error: "INVALID_REVIEWER", requestId)
```

### Proposals.Writing.SubmitProposal:unknown-reviewer#2

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 59.
- Covered by [Proposals](../design/compositions/Proposals.md), line 82.
- Covered by [Reviews](../design/compositions/Reviews.md), line 4.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.SubmitProposal
where
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, reviewer, session)
  InvestigatingChanges._get (investigation: proposal)
  Authenticating._registered (username: reviewer) has (registered: false)
then
  RequestBoundary.respond (error: "INVALID_REVIEWER", requestId)
```

### Proposals.Writing.UnhighlightProposal

Authored path: `Proposals.Writing.UnhighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.
- Covered by [Proposals](../design/compositions/Proposals.md), line 81.

```reaction
when RequestBoundary.request (highlight, path: "/proposals/unhighlight", proposal, requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Writing.UnhighlightProposal:found#2

Authored path: `Proposals.Writing.UnhighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.
- Covered by [Proposals](../design/compositions/Proposals.md), line 81.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.UnhighlightProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (highlight, path: "/proposals/unhighlight", proposal, requestId, session)
  InvestigatingChanges._get (investigation: proposal) has (name, owner)
then
  RepositoryAccess.authorize (at, name, owner, user)
```

### Proposals.Writing.UnhighlightProposal:found#3

Authored path: `Proposals.Writing.UnhighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.
- Covered by [Proposals](../design/compositions/Proposals.md), line 81.

```reaction
when RepositoryAccess.authorize (at, name, owner, user), asked by Proposals.Writing.UnhighlightProposal:found#2
where
  earlier, RequestBoundary.request (highlight, path: "/proposals/unhighlight", proposal, requestId, session)
then
  InvestigatingChanges.unhighlight (at, highlight, investigation: proposal, investigator: user)
```

### Proposals.Writing.UnhighlightProposal:found#4

Authored path: `Proposals.Writing.UnhighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.
- Covered by [Proposals](../design/compositions/Proposals.md), line 81.

```reaction
when InvestigatingChanges.unhighlight (at, highlight, investigation: proposal, investigator: user), asked by Proposals.Writing.UnhighlightProposal:found#3
where
  earlier, RequestBoundary.request (highlight, path: "/proposals/unhighlight", proposal, requestId, session)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Writing.UnhighlightProposal:missing#2

Authored path: `Proposals.Writing.UnhighlightProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.
- Covered by [Proposals](../design/compositions/Proposals.md), line 81.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.UnhighlightProposal
where
  earlier, RequestBoundary.request (highlight, path: "/proposals/unhighlight", proposal, requestId, session)
  no InvestigatingChanges._get (investigation: proposal)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### ReviewWorkflow.ApprovalApprovesInvestigation

Authored path: `ReviewWorkflow.ApprovalApprovesInvestigation`.
- Covered by [Review Workflow](../design/compositions/ReviewWorkflow.md), line 10.

```reaction
when ReviewingDocumentation.approve (at, review)
where
  ReviewingDocumentation._get (review) has (proposal)
then
  InvestigatingChanges.approve (at, investigation: proposal)
```

### Reviews.Deciding.ApproveReview

Authored path: `Reviews.Deciding.ApproveReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 18.
- Covered by [Reviews](../design/compositions/Reviews.md), line 30.

```reaction
when RequestBoundary.request (path: "/reviews/approve", requestId, review, session)
then
  Sessioning.current (session)
```

### Reviews.Deciding.ApproveReview:found#2

Authored path: `Reviews.Deciding.ApproveReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 18.
- Covered by [Reviews](../design/compositions/Reviews.md), line 30.

```reaction
when Sessioning.current (session, subject: user), asked by Reviews.Deciding.ApproveReview
where
  at is the current flow's instant
  earlier, RequestBoundary.request (path: "/reviews/approve", requestId, review, session)
  ReviewingDocumentation._get (review) has (proposal)
  InvestigatingChanges._get (investigation: proposal) has (name, owner)
then
  RepositoryAccess.authorize (at, name, owner, user)
```

### Reviews.Deciding.ApproveReview:found#3

Authored path: `Reviews.Deciding.ApproveReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 18.
- Covered by [Reviews](../design/compositions/Reviews.md), line 30.

```reaction
when RepositoryAccess.authorize (at, name, owner, user), asked by Reviews.Deciding.ApproveReview:found#2
where
  earlier, RequestBoundary.request (path: "/reviews/approve", requestId, review, session)
then
  ReviewingDocumentation.approve (at, review, reviewer: user)
```

### Reviews.Deciding.ApproveReview:found#4

Authored path: `Reviews.Deciding.ApproveReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 18.
- Covered by [Reviews](../design/compositions/Reviews.md), line 30.

```reaction
when ReviewingDocumentation.approve (at, review, reviewer: user), asked by Reviews.Deciding.ApproveReview:found#3
at the flow's settlement frontier
where
  ReviewingDocumentation._get (review) has (proposal)
  earlier, RequestBoundary.request (path: "/reviews/approve", requestId, review, session)
then
  RequestBoundary.respond (proposal: former "a proposal with its current and proposed structures" with (proposal), requestId)
```

### Reviews.Deciding.ApproveReview:missing#2

Authored path: `Reviews.Deciding.ApproveReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 18.
- Covered by [Reviews](../design/compositions/Reviews.md), line 30.

```reaction
when Sessioning.current (session, subject: user), asked by Reviews.Deciding.ApproveReview
where
  earlier, RequestBoundary.request (path: "/reviews/approve", requestId, review, session)
  no ReviewingDocumentation._get (review)
then
  RequestBoundary.respond (error: "REVIEW_NOT_FOUND", requestId)
```

### Reviews.Deciding.ApproveReview:missing#3

Authored path: `Reviews.Deciding.ApproveReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 18.
- Covered by [Reviews](../design/compositions/Reviews.md), line 30.

```reaction
when RequestBoundary.respond (error: "REVIEW_NOT_FOUND", requestId), asked by Reviews.Deciding.ApproveReview:missing#2
at the flow's settlement frontier
where
  earlier, RequestBoundary.request (path: "/reviews/approve", requestId, review, session)
  ReviewingDocumentation._get (review) has (proposal)
then
  RequestBoundary.respond (proposal: former "a proposal with its current and proposed structures" with (proposal), requestId)
```

### Reviews.Reading.GetReview

Authored path: `Reviews.Reading.GetReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 8.
- Covered by [Reviews](../design/compositions/Reviews.md), line 15.

```reaction
when RequestBoundary.request (path: "/reviews/get", requestId, review, session)
then
  Sessioning.current (session)
```

### Reviews.Reading.GetReview:found#2

Authored path: `Reviews.Reading.GetReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 8.
- Covered by [Reviews](../design/compositions/Reviews.md), line 15.

```reaction
when Sessioning.current (session, subject: user), asked by Reviews.Reading.GetReview
where
  earlier, RequestBoundary.request (path: "/reviews/get", requestId, review, session)
  ReviewingDocumentation._get (review)
then
  RequestBoundary.respond (requestId, review: former "a review with its proposal" with (review))
```

### Reviews.Reading.GetReview:missing#2

Authored path: `Reviews.Reading.GetReview`.
- Covered by [Reviews](../design/compositions/Reviews.md), line 8.
- Covered by [Reviews](../design/compositions/Reviews.md), line 15.

```reaction
when Sessioning.current (session, subject: user), asked by Reviews.Reading.GetReview
where
  earlier, RequestBoundary.request (path: "/reviews/get", requestId, review, session)
  no ReviewingDocumentation._get (review)
then
  RequestBoundary.respond (error: "REVIEW_NOT_FOUND", requestId)
```

### Sessions.CurrentAccount.CurrentUser

Authored path: `Sessions.CurrentAccount.CurrentUser`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 23.
- Covered by [Sessions](../design/compositions/Sessions.md), line 30.

```reaction
when RequestBoundary.request (path: "/auth/current", requestId, session)
then
  Sessioning.current (session)
```

### Sessions.CurrentAccount.CurrentUser#2

Authored path: `Sessions.CurrentAccount.CurrentUser`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 23.
- Covered by [Sessions](../design/compositions/Sessions.md), line 30.

```reaction
when Sessioning.current (session, subject: username), asked by Sessions.CurrentAccount.CurrentUser
where
  earlier, RequestBoundary.request (path: "/auth/current", requestId, session)
then
  RequestBoundary.respond (requestId, username)
```

### Sessions.LeavingApplication.SignOut

Authored path: `Sessions.LeavingApplication.SignOut`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 33.
- Covered by [Sessions](../design/compositions/Sessions.md), line 38.

```reaction
when RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  Sessioning.end (session)
```

### Sessions.LeavingApplication.SignOut#2

Authored path: `Sessions.LeavingApplication.SignOut`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 33.
- Covered by [Sessions](../design/compositions/Sessions.md), line 38.

```reaction
when Sessioning.end (session, ended: signedOut), asked by Sessions.LeavingApplication.SignOut
where
  earlier, RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  RequestBoundary.respond (requestId, signedOut)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/auth/current` — requires `session`
- `/auth/sign-out` — requires `session`
- `/proposals/apply` — requires `session`, `proposal`, `commit`
- `/proposals/discard` — requires `session`, `proposal`
- `/proposals/for-commit` — requires `session`, `owner`, `name`, `commit`
- `/proposals/get` — requires `session`, `proposal`
- `/proposals/highlight` — requires `session`, `proposal`, `file`, `from`, `to`, `start`, `end`, `text`, `kind`, `replacement`
- `/proposals/list` — requires `session`, `owner`, `name`
- `/proposals/modify` — requires `session`, `proposal`, `title`, `operations`, `rationale`
- `/proposals/start` — requires `session`, `owner`, `name`, `commit`, `title`, `currentStructure`
- `/proposals/submit` — requires `session`, `proposal`, `reviewer`
- `/proposals/under-review` — requires `session`, `owner`, `name`
- `/proposals/unhighlight` — requires `session`, `proposal`, `highlight`
- `/reviews/approve` — requires `session`, `review`
- `/reviews/get` — requires `session`, `review`
