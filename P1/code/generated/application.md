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

- `Authenticating` — instance of `Authenticating` — [GitDocs Application Types](../design/types.md), line 11.

### InvestigatingChanges

Defined in [InvestigatingChanges](../design/concepts/InvestigatingChanges.md), line 1.

#### Actions

- `open(investigator: User, owner: String, name: String, commit: String, at: DateTime) : returns (investigation: Investigation)`
  - Refuses `INVALID_REPOSITORY`: A repository needs an owner and a name.
  - Refuses `INVALID_COMMIT`: An investigation needs a full commit SHA.

#### Queries

- `_get(investigation: Investigation) : optional (investigation: Investigation, owner: String, name: String, commit: String, investigator: User, openedAt: DateTime)`
- `_forRepository(owner: String, name: String) : many (investigation: Investigation, commit: String, investigator: User, openedAt: DateTime)`

#### Instances

- `InvestigatingChanges` — instance of `InvestigatingChanges` — [GitDocs Application Types](../design/types.md), line 16.
  - `User` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 17.

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

- `Sessioning` — instance of `Sessioning` — [GitDocs Application Types](../design/types.md), line 13.
  - `Subject` is `Authenticating.Account` — [GitDocs Application Types](../design/types.md), line 14.

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### the investigations of a repository

Authored path: `Investigations.Reading.RepositoryInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 27.

```former
Former "the investigations of a repository" — inputs (owner, name); bindings (investigation, commit, investigator, openedAt); promises exactly one record — forms:
  a record of
    investigations: each InvestigatingChanges._forRepository (name, owner) has (commit, investigation, investigator, openedAt)
      arranged by openedAt, descending
      form a record of
        commit
        investigation
        investigator
        openedAt
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

### Investigations.Opening.OpenInvestigation

Authored path: `Investigations.Opening.OpenInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 7.
- Covered by [Investigations](../design/compositions/Investigations.md), line 14.

```reaction
when RequestBoundary.request (commit, name, owner, path: "/investigations/open", requestId, session)
then
  Sessioning.current (session)
```

### Investigations.Opening.OpenInvestigation#2

Authored path: `Investigations.Opening.OpenInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 7.
- Covered by [Investigations](../design/compositions/Investigations.md), line 14.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Opening.OpenInvestigation
where
  at is the current flow's instant
  earlier, RequestBoundary.request (commit, name, owner, path: "/investigations/open", requestId, session)
then
  InvestigatingChanges.open (at, commit, investigator: user, name, owner)
```

### Investigations.Opening.OpenInvestigation#3

Authored path: `Investigations.Opening.OpenInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 7.
- Covered by [Investigations](../design/compositions/Investigations.md), line 14.

```reaction
when InvestigatingChanges.open (at, commit, investigator: user, name, owner, investigation), asked by Investigations.Opening.OpenInvestigation#2
where
  earlier, RequestBoundary.request (commit, name, owner, path: "/investigations/open", requestId, session)
then
  RequestBoundary.respond (investigation, requestId)
```

### Investigations.Reading.GetInvestigation

Authored path: `Investigations.Reading.GetInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 17.
- Covered by [Investigations](../design/compositions/Investigations.md), line 23.

```reaction
when RequestBoundary.request (investigation, path: "/investigations/get", requestId, session)
then
  Sessioning.current (session)
```

### Investigations.Reading.GetInvestigation:found#2

Authored path: `Investigations.Reading.GetInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 17.
- Covered by [Investigations](../design/compositions/Investigations.md), line 23.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Reading.GetInvestigation
where
  earlier, RequestBoundary.request (investigation, path: "/investigations/get", requestId, session)
  InvestigatingChanges._get (investigation) has (commit, investigator, name, openedAt, owner)
then
  RequestBoundary.respond (commit, investigation, investigator, name, openedAt, owner, requestId)
```

### Investigations.Reading.GetInvestigation:missing#2

Authored path: `Investigations.Reading.GetInvestigation`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 17.
- Covered by [Investigations](../design/compositions/Investigations.md), line 23.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Reading.GetInvestigation
where
  earlier, RequestBoundary.request (investigation, path: "/investigations/get", requestId, session)
  no InvestigatingChanges._get (investigation)
then
  RequestBoundary.respond (error: "INVESTIGATION_NOT_FOUND", requestId)
```

### Investigations.Reading.ListInvestigations

Authored path: `Investigations.Reading.ListInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 26.
- Covered by [Investigations](../design/compositions/Investigations.md), line 33.

```reaction
when RequestBoundary.request (name, owner, path: "/investigations/list", requestId, session)
then
  Sessioning.current (session)
```

### Investigations.Reading.ListInvestigations#2

Authored path: `Investigations.Reading.ListInvestigations`.
- Covered by [Investigations](../design/compositions/Investigations.md), line 26.
- Covered by [Investigations](../design/compositions/Investigations.md), line 33.

```reaction
when Sessioning.current (session, subject: user), asked by Investigations.Reading.ListInvestigations
where
  earlier, RequestBoundary.request (name, owner, path: "/investigations/list", requestId, session)
then
  RequestBoundary.respond (repository: former "the investigations of a repository" with (name, owner), requestId)
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
- `/investigations/get` — requires `session`, `investigation`
- `/investigations/list` — requires `session`, `owner`, `name`
- `/investigations/open` — requires `session`, `owner`, `name`, `commit`
