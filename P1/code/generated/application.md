<!-- Generated from the Application assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Application — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `register(username: String, password: String) : returns (account: Account)`
  - Refuses `INVALID_USERNAME`: A username must contain 3 to 32 letters, numbers, underscores, or hyphens.
  - Refuses `WEAK_PASSWORD`: A password must contain 8 to 128 characters.
  - Refuses `USERNAME_TAKEN`: That username is already registered.
- `authenticate(username: String, password: String) : returns (account: Account)`
  - Refuses `INVALID_CREDENTIALS`: The username or password is incorrect.

#### Queries

- `_registered(username: String) : one (registered: Flag)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [GitDocs Application Types](../design/types.md), line 12.

### InvestigatingChanges

Defined in [InvestigatingChanges](../design/concepts/InvestigatingChanges.md), line 1.

#### Actions

- `submit(investigator: User, owner: String, name: String, commit: String, title: String, affected: AffectedList, evidence: EvidenceList, at: DateTime) : returns (investigation: Investigation)`
  - Refuses `INVALID_REPOSITORY`: A repository needs an owner and a name.
  - Refuses `INVALID_COMMIT`: An investigation needs a full commit SHA.
  - Refuses `INVALID_TITLE`: An investigation needs a title of at most 120 characters.
  - Refuses `INVALID_AFFECTED_DOCUMENTATION`: Name at least one affected documentation file, each once, with a reason.
  - Refuses `INVALID_EVIDENCE`: Give at least one piece of evidence.

#### Queries

- `_get(investigation: Investigation) : optional (investigation: Investigation, owner: String, name: String, commit: String, investigator: User, title: String, submittedAt: DateTime)`
- `_affected(investigation: Investigation) : many (path: String, reason: String)`
- `_evidence(investigation: Investigation) : many (text: String)`
- `_forRepository(owner: String, name: String) : many (investigation: Investigation, commit: String, investigator: User, title: String, submittedAt: DateTime)`
- `_forCommit(owner: String, name: String, commit: String) : many (investigation: Investigation, investigator: User, title: String, submittedAt: DateTime)`

#### Instances

- `InvestigatingChanges` — instance of `InvestigatingChanges` — [GitDocs Application Types](../design/types.md), line 17.
  - `User` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 18.

### RestructuringDocumentation

Defined in [RestructuringDocumentation](../design/concepts/RestructuringDocumentation.md), line 1.

#### Actions

- `create(author: User, investigation: Investigation, owner: String, name: String, commit: String, title: String, currentStructure: DocumentationTree, at: DateTime) : returns (restructuring: Restructuring)`
  - Refuses `INVALID_PROPOSAL_SOURCE`: A proposal needs a repository and a full commit SHA.
  - Refuses `INVALID_PROPOSAL_TITLE`: A proposal needs a title of at most 120 characters.
  - Refuses `INVALID_STRUCTURE`: That is not a documentation structure.
- `modify(restructuring: Restructuring, author: User, title: String, proposedStructure: DocumentationTree, rationale: String, at: DateTime) : returns ()`
  - Refuses `PROPOSAL_NOT_FOUND`: There is no such proposal.
  - Refuses `NOT_PROPOSAL_AUTHOR`: Only the proposal's author can change it.
  - Refuses `NOT_DRAFT`: Only a draft proposal can be changed.
  - Refuses `INVALID_PROPOSAL_TITLE`: A proposal needs a title of at most 120 characters.
  - Refuses `INVALID_STRUCTURE`: That is not a documentation structure.
- `submit(restructuring: Restructuring, author: User, at: DateTime) : returns ()`
  - Refuses `PROPOSAL_NOT_FOUND`: There is no such proposal.
  - Refuses `NOT_PROPOSAL_AUTHOR`: Only the proposal's author can change it.
  - Refuses `NOT_DRAFT`: Only a draft proposal can be changed.
  - Refuses `RATIONALE_MISSING`: Explain the proposed structure before submitting it.
- `discard(restructuring: Restructuring, author: User) : returns ()`
  - Refuses `PROPOSAL_NOT_FOUND`: There is no such proposal.
  - Refuses `NOT_PROPOSAL_AUTHOR`: Only the proposal's author can change it.
  - Refuses `NOT_DRAFT`: Only a draft proposal can be changed.
- `approve(restructuring: Restructuring, at: DateTime) : returns ()`
  - Refuses `PROPOSAL_NOT_FOUND`: There is no such proposal.
  - Refuses `PROPOSAL_NOT_PENDING`: Only a proposal pending approval can be approved.

#### Queries

- `_get(restructuring: Restructuring) : optional (restructuring: Restructuring, author: User, investigation: Investigation, owner: String, name: String, commit: String, title: String, rationale: String, status: Status, currentStructure: DocumentationTree, proposedStructure: DocumentationTree, createdAt: DateTime, updatedAt: DateTime)`
- `_forRepository(owner: String, name: String) : many (restructuring: Restructuring, author: User, investigation: Investigation, commit: String, title: String, status: Status, updatedAt: DateTime)`
- `_pendingApproval(owner: String, name: String) : many (restructuring: Restructuring, author: User, investigation: Investigation, commit: String, title: String, updatedAt: DateTime)`

#### Instances

- `RestructuringDocumentation` — instance of `RestructuringDocumentation` — [GitDocs Application Types](../design/types.md), line 20.
  - `Investigation` is `InvestigatingChanges.Investigation` — [GitDocs Application Types](../design/types.md), line 22.
  - `User` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 21.

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

- `Sessioning` — instance of `Sessioning` — [GitDocs Application Types](../design/types.md), line 14.
  - `Subject` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 15.

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### (proposal) is a draft by (user)

Authored path: `Proposals.Reading.ProposalIsDraftByUser`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 40.

```view
(proposal) is a draft by (user) — inputs (proposal, user); outputs (); bindings ()
  where RestructuringDocumentation._get (restructuring: proposal) has (author: user, status: "DRAFT")
```

### (proposal) is a draft by someone other than (user)

Authored path: `Proposals.Reading.ProposalIsDraftByOther`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 42.

```view
(proposal) is a draft by someone other than (user) — inputs (proposal, user); outputs (); bindings ()
  where
    RestructuringDocumentation._get (restructuring: proposal) has (status: "DRAFT")
    RestructuringDocumentation._get (restructuring: proposal) and not (author: user)
```

### (proposal) is submitted

Authored path: `Proposals.Reading.ProposalIsSubmitted`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 38.

```view
(proposal) is submitted — inputs (proposal); outputs (); bindings ()
  where RestructuringDocumentation._get (restructuring: proposal) has (status: "PENDING_APPROVAL")
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### a proposal with its current and proposed structures

Authored path: `Proposals.Reading.ProposalDetail`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 33.

```former
Former "a proposal with its current and proposed structures" — inputs (proposal); bindings (author, investigation, owner, name, commit, title, rationale, status, currentStructure, proposedStructure, createdAt, updatedAt); promises exactly one record — forms:
  a record of
    where RestructuringDocumentation._get (restructuring: proposal) has (author, commit, createdAt, currentStructure, investigation, name, owner, proposedStructure, rationale, status, title, updatedAt)
    author
    commit
    createdAt
    currentStructure
    investigation
    name
    owner
    proposal
    proposedStructure
    rationale
    status
    title
    updatedAt
```

### an investigation with its affected documentation and evidence

Authored path: `Investigations.Reading.InvestigationDetail`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 21.

```former
Former "an investigation with its affected documentation and evidence" — inputs (investigation); bindings (owner, name, commit, investigator, title, submittedAt, path, reason, text); promises exactly one record — forms:
  a record of
    where InvestigatingChanges._get (investigation) has (commit, investigation, investigator, name, owner, submittedAt, title)
    affected: each InvestigatingChanges._affected (investigation) has (path, reason)
      form a record of
        path
        reason
    commit
    evidence: each InvestigatingChanges._evidence (investigation) has (text)
      form a record of
        text
    investigation
    investigator
    name
    owner
    submittedAt
    title
```

### the investigations of a commit

Authored path: `Investigations.Reading.CommitInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 34.

```former
Former "the investigations of a commit" — inputs (owner, name, commit); bindings (investigation, investigator, title, submittedAt); promises exactly one record — forms:
  a record of
    investigations: each InvestigatingChanges._forCommit (commit, name, owner) has (investigation, investigator, submittedAt, title)
      arranged by submittedAt, descending
      form a record of
        investigation
        investigator
        submittedAt
        title
```

### the investigations of a repository

Authored path: `Investigations.Reading.RepositoryInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 32.

```former
Former "the investigations of a repository" — inputs (owner, name); bindings (investigation, commit, investigator, title, submittedAt); promises exactly one record — forms:
  a record of
    investigations: each InvestigatingChanges._forRepository (name, owner) has (commit, investigation, investigator, submittedAt, title)
      arranged by submittedAt, descending
      form a record of
        commit
        investigation
        investigator
        submittedAt
        title
```

### the proposals of a repository that (user) may see

Authored path: `Proposals.Reading.RepositoryProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 52.

```former
Former "the proposals of a repository that (user) may see" — inputs (owner, name, user); bindings (proposal, author, investigation, commit, title, updatedAt); promises exactly one record — forms:
  a record of
    drafts: each RestructuringDocumentation._forRepository (name, owner) has (author: user, commit, investigation, restructuring: proposal, status: "DRAFT", title, updatedAt)
      arranged by updatedAt, descending
      form a record of
        commit
        investigation
        proposal
        title
        updatedAt
    submitted: each RestructuringDocumentation._forRepository (name, owner) has (author, commit, investigation, restructuring: proposal, status: "PENDING_APPROVAL", title, updatedAt)
      arranged by updatedAt, descending
      form a record of
        author
        commit
        investigation
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

### Investigations.Reading.GetInvestigation

Authored path: `Investigations.Reading.GetInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 20.
- Covered by [Investigations](../design/compositions/Investigations.md), line 28.

```reaction
when RequestBoundary.request (investigation, path: "/investigations/get", requestId, session)
then
  Sessioning.current (session)
```

### Investigations.Reading.GetInvestigation:found#2

Authored path: `Investigations.Reading.GetInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 20.
- Covered by [Investigations](../design/compositions/Investigations.md), line 28.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Reading.GetInvestigation
where
  earlier, RequestBoundary.request (investigation, path: "/investigations/get", requestId, session)
  InvestigatingChanges._get (investigation)
then
  RequestBoundary.respond (investigation: former "an investigation with its affected documentation and evidence" with (investigation), requestId)
```

### Investigations.Reading.GetInvestigation:missing#2

Authored path: `Investigations.Reading.GetInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 20.
- Covered by [Investigations](../design/compositions/Investigations.md), line 28.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Reading.GetInvestigation
where
  earlier, RequestBoundary.request (investigation, path: "/investigations/get", requestId, session)
  no InvestigatingChanges._get (investigation)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Investigations.Reading.ListCommitInvestigations

Authored path: `Investigations.Reading.ListCommitInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 33.
- Covered by [Investigations](../design/compositions/Investigations.md), line 40.

```reaction
when RequestBoundary.request (commit, name, owner, path: "/investigations/for-commit", requestId, session)
then
  Sessioning.current (session)
```

### Investigations.Reading.ListCommitInvestigations#2

Authored path: `Investigations.Reading.ListCommitInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 33.
- Covered by [Investigations](../design/compositions/Investigations.md), line 40.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Reading.ListCommitInvestigations
where
  earlier, RequestBoundary.request (commit, name, owner, path: "/investigations/for-commit", requestId, session)
then
  RequestBoundary.respond (commit: former "the investigations of a commit" with (commit, name, owner), requestId)
```

### Investigations.Reading.ListInvestigations

Authored path: `Investigations.Reading.ListInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 31.
- Covered by [Investigations](../design/compositions/Investigations.md), line 39.

```reaction
when RequestBoundary.request (name, owner, path: "/investigations/list", requestId, session)
then
  Sessioning.current (session)
```

### Investigations.Reading.ListInvestigations#2

Authored path: `Investigations.Reading.ListInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 31.
- Covered by [Investigations](../design/compositions/Investigations.md), line 39.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Reading.ListInvestigations
where
  earlier, RequestBoundary.request (name, owner, path: "/investigations/list", requestId, session)
then
  RequestBoundary.respond (repository: former "the investigations of a repository" with (name, owner), requestId)
```

### Investigations.Submitting.SubmitInvestigation

Authored path: `Investigations.Submitting.SubmitInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 8.
- Covered by [Investigations](../design/compositions/Investigations.md), line 17.

```reaction
when RequestBoundary.request (affected, commit, evidence, name, owner, path: "/investigations/submit", requestId, session, title)
then
  Sessioning.current (session)
```

### Investigations.Submitting.SubmitInvestigation#2

Authored path: `Investigations.Submitting.SubmitInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 8.
- Covered by [Investigations](../design/compositions/Investigations.md), line 17.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Submitting.SubmitInvestigation
where
  at is the current flow's instant
  earlier, RequestBoundary.request (affected, commit, evidence, name, owner, path: "/investigations/submit", requestId, session, title)
then
  InvestigatingChanges.submit (affected, at, commit, evidence, investigator: user, name, owner, title)
```

### Investigations.Submitting.SubmitInvestigation#3

Authored path: `Investigations.Submitting.SubmitInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 8.
- Covered by [Investigations](../design/compositions/Investigations.md), line 17.

```reaction
when InvestigatingChanges.submit (affected, at, commit, evidence, investigator: user, name, owner, title, investigation), asked by Investigations.Submitting.SubmitInvestigation#2
where
  earlier, RequestBoundary.request (affected, commit, evidence, name, owner, path: "/investigations/submit", requestId, session, title)
then
  RequestBoundary.respond (investigation, requestId)
```

### Proposals.Reading.GetProposal

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.

```reaction
when RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Reading.GetProposal:missing#2

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.GetProposal
where
  earlier, RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
  no RestructuringDocumentation._get (restructuring: proposal)
then
  RequestBoundary.respond (error: "PROPOSAL_NOT_FOUND", requestId)
```

### Proposals.Reading.GetProposal:others-draft#2

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.GetProposal
where
  earlier, RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
  view "(proposal) is a draft by someone other than (user)" with (proposal, user)
then
  RequestBoundary.respond (error: "PROPOSAL_NOT_FOUND", requestId)
```

### Proposals.Reading.GetProposal:own-draft#2

Authored path: `Proposals.Reading.GetProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.

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
- Covered by [Proposals](../design/compositions/Proposals.md), line 32.
- Covered by [Proposals](../design/compositions/Proposals.md), line 47.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.GetProposal
where
  earlier, RequestBoundary.request (path: "/proposals/get", proposal, requestId, session)
  view "(proposal) is submitted" with (proposal)
then
  RequestBoundary.respond (proposal: former "a proposal with its current and proposed structures" with (proposal), requestId)
```

### Proposals.Reading.ListProposals

Authored path: `Proposals.Reading.ListProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 50.
- Covered by [Proposals](../design/compositions/Proposals.md), line 58.

```reaction
when RequestBoundary.request (name, owner, path: "/proposals/list", requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Reading.ListProposals#2

Authored path: `Proposals.Reading.ListProposals`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 50.
- Covered by [Proposals](../design/compositions/Proposals.md), line 58.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Reading.ListProposals
where
  earlier, RequestBoundary.request (name, owner, path: "/proposals/list", requestId, session)
then
  RequestBoundary.respond (repository: former "the proposals of a repository that (user) may see" with (name, owner, user), requestId)
```

### Proposals.Writing.CreateProposal

Authored path: `Proposals.Writing.CreateProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 7.
- Covered by [Proposals](../design/compositions/Proposals.md), line 15.

```reaction
when RequestBoundary.request (currentStructure, investigation, path: "/proposals/create", requestId, session, title)
then
  Sessioning.current (session)
```

### Proposals.Writing.CreateProposal:found#2

Authored path: `Proposals.Writing.CreateProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 7.
- Covered by [Proposals](../design/compositions/Proposals.md), line 15.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.CreateProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (currentStructure, investigation, path: "/proposals/create", requestId, session, title)
  InvestigatingChanges._get (investigation) has (commit, name, owner)
then
  RestructuringDocumentation.create (at, author: user, commit, currentStructure, investigation, name, owner, title)
```

### Proposals.Writing.CreateProposal:found#3

Authored path: `Proposals.Writing.CreateProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 7.
- Covered by [Proposals](../design/compositions/Proposals.md), line 15.

```reaction
when RestructuringDocumentation.create (at, author: user, commit, currentStructure, investigation, name, owner, title, restructuring: proposal), asked by Proposals.Writing.CreateProposal:found#2
where
  earlier, RequestBoundary.request (currentStructure, investigation, path: "/proposals/create", requestId, session, title)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Writing.CreateProposal:missing#2

Authored path: `Proposals.Writing.CreateProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 7.
- Covered by [Proposals](../design/compositions/Proposals.md), line 15.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.CreateProposal
where
  earlier, RequestBoundary.request (currentStructure, investigation, path: "/proposals/create", requestId, session, title)
  no InvestigatingChanges._get (investigation)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Proposals.Writing.DiscardProposal

Authored path: `Proposals.Writing.DiscardProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 21.
- Covered by [Proposals](../design/compositions/Proposals.md), line 29.

```reaction
when RequestBoundary.request (path: "/proposals/discard", proposal, requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Writing.DiscardProposal#2

Authored path: `Proposals.Writing.DiscardProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 21.
- Covered by [Proposals](../design/compositions/Proposals.md), line 29.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.DiscardProposal
where
  earlier, RequestBoundary.request (path: "/proposals/discard", proposal, requestId, session)
then
  RestructuringDocumentation.discard (author: user, restructuring: proposal)
```

### Proposals.Writing.DiscardProposal#3

Authored path: `Proposals.Writing.DiscardProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 21.
- Covered by [Proposals](../design/compositions/Proposals.md), line 29.

```reaction
when RestructuringDocumentation.discard (author: user, restructuring: proposal), asked by Proposals.Writing.DiscardProposal#2
where
  earlier, RequestBoundary.request (path: "/proposals/discard", proposal, requestId, session)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Writing.ModifyProposal

Authored path: `Proposals.Writing.ModifyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 18.
- Covered by [Proposals](../design/compositions/Proposals.md), line 27.

```reaction
when RequestBoundary.request (path: "/proposals/modify", proposal, proposedStructure, rationale, requestId, session, title)
then
  Sessioning.current (session)
```

### Proposals.Writing.ModifyProposal#2

Authored path: `Proposals.Writing.ModifyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 18.
- Covered by [Proposals](../design/compositions/Proposals.md), line 27.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.ModifyProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (path: "/proposals/modify", proposal, proposedStructure, rationale, requestId, session, title)
then
  RestructuringDocumentation.modify (at, author: user, proposedStructure, rationale, restructuring: proposal, title)
```

### Proposals.Writing.ModifyProposal#3

Authored path: `Proposals.Writing.ModifyProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 18.
- Covered by [Proposals](../design/compositions/Proposals.md), line 27.

```reaction
when RestructuringDocumentation.modify (at, author: user, proposedStructure, rationale, restructuring: proposal, title), asked by Proposals.Writing.ModifyProposal#2
where
  earlier, RequestBoundary.request (path: "/proposals/modify", proposal, proposedStructure, rationale, requestId, session, title)
then
  RequestBoundary.respond (proposal, requestId)
```

### Proposals.Writing.SubmitProposal

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 20.
- Covered by [Proposals](../design/compositions/Proposals.md), line 28.

```reaction
when RequestBoundary.request (path: "/proposals/submit", proposal, requestId, session)
then
  Sessioning.current (session)
```

### Proposals.Writing.SubmitProposal#2

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 20.
- Covered by [Proposals](../design/compositions/Proposals.md), line 28.

```reaction
when Sessioning.current (session, subject: user), asked by Proposals.Writing.SubmitProposal
where
  at is the current flow's instant
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, session)
then
  RestructuringDocumentation.submit (at, author: user, restructuring: proposal)
```

### Proposals.Writing.SubmitProposal#3

Authored path: `Proposals.Writing.SubmitProposal`.
- Covered by [Proposals](../design/compositions/Proposals.md), line 20.
- Covered by [Proposals](../design/compositions/Proposals.md), line 28.

```reaction
when RestructuringDocumentation.submit (at, author: user, restructuring: proposal), asked by Proposals.Writing.SubmitProposal#2
where
  earlier, RequestBoundary.request (path: "/proposals/submit", proposal, requestId, session)
then
  RequestBoundary.respond (proposal, requestId)
```

### Sessions.CurrentAccount.CurrentUser

Authored path: `Sessions.CurrentAccount.CurrentUser`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 17.
- Covered by [Sessions](../design/compositions/Sessions.md), line 24.

```reaction
when RequestBoundary.request (path: "/auth/current", requestId, session)
then
  Sessioning.current (session)
```

### Sessions.CurrentAccount.CurrentUser#2

Authored path: `Sessions.CurrentAccount.CurrentUser`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 17.
- Covered by [Sessions](../design/compositions/Sessions.md), line 24.

```reaction
when Sessioning.current (session, subject: username), asked by Sessions.CurrentAccount.CurrentUser
where
  earlier, RequestBoundary.request (path: "/auth/current", requestId, session)
then
  RequestBoundary.respond (requestId, username)
```

### Sessions.EnteringApplication.Register

Authored path: `Sessions.EnteringApplication.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 6.
- Covered by [Sessions](../design/compositions/Sessions.md), line 13.

```reaction
when RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  Authenticating.register (password, username)
```

### Sessions.EnteringApplication.Register#2

Authored path: `Sessions.EnteringApplication.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 6.
- Covered by [Sessions](../design/compositions/Sessions.md), line 13.

```reaction
when Authenticating.register (password, username, account), asked by Sessions.EnteringApplication.Register
then
  Sessioning.start (subject: account)
```

### Sessions.EnteringApplication.Register#3

Authored path: `Sessions.EnteringApplication.Register`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 6.
- Covered by [Sessions](../design/compositions/Sessions.md), line 13.

```reaction
when Sessioning.start (subject: account, expiresAt, session), asked by Sessions.EnteringApplication.Register#2
where
  earlier, RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  RequestBoundary.respond (account, expiresAt, requestId, session)
```

### Sessions.EnteringApplication.SignIn

Authored path: `Sessions.EnteringApplication.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 8.
- Covered by [Sessions](../design/compositions/Sessions.md), line 14.

```reaction
when RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  Authenticating.authenticate (password, username)
```

### Sessions.EnteringApplication.SignIn#2

Authored path: `Sessions.EnteringApplication.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 8.
- Covered by [Sessions](../design/compositions/Sessions.md), line 14.

```reaction
when Authenticating.authenticate (password, username, account), asked by Sessions.EnteringApplication.SignIn
then
  Sessioning.start (subject: account)
```

### Sessions.EnteringApplication.SignIn#3

Authored path: `Sessions.EnteringApplication.SignIn`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 8.
- Covered by [Sessions](../design/compositions/Sessions.md), line 14.

```reaction
when Sessioning.start (subject: account, expiresAt, session), asked by Sessions.EnteringApplication.SignIn#2
where
  earlier, RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  RequestBoundary.respond (account, expiresAt, requestId, session)
```

### Sessions.LeavingApplication.SignOut

Authored path: `Sessions.LeavingApplication.SignOut`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 27.
- Covered by [Sessions](../design/compositions/Sessions.md), line 32.

```reaction
when RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  Sessioning.end (session)
```

### Sessions.LeavingApplication.SignOut#2

Authored path: `Sessions.LeavingApplication.SignOut`.
- Covered by [Sessions](../design/compositions/Sessions.md), line 27.
- Covered by [Sessions](../design/compositions/Sessions.md), line 32.

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
- `/auth/register` — requires `username`, `password`
- `/auth/sign-in` — requires `username`, `password`
- `/auth/sign-out` — requires `session`
- `/investigations/for-commit` — requires `session`, `owner`, `name`, `commit`
- `/investigations/get` — requires `session`, `investigation`
- `/investigations/list` — requires `session`, `owner`, `name`
- `/investigations/submit` — requires `session`, `owner`, `name`, `commit`, `title`, `affected`, `evidence`
- `/proposals/create` — requires `session`, `investigation`, `title`, `currentStructure`
- `/proposals/discard` — requires `session`, `proposal`
- `/proposals/get` — requires `session`, `proposal`
- `/proposals/list` — requires `session`, `owner`, `name`
- `/proposals/modify` — requires `session`, `proposal`, `title`, `proposedStructure`, `rationale`
- `/proposals/submit` — requires `session`, `proposal`
