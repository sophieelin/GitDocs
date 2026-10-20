# GitDocs Application Types

Every concept instance the application selects, with its external types bound.

A session represents the account that signed in through GitHub, so Sessioning's
subject is an Authenticating account. Whether an account can push to a
repository is about that account, so RepositoryAccess' user is one too. The developer who writes an
investigation, the draft of a proposal, is the signed-in account, so
InvestigatingChanges' user is an Authenticating account too. A review evaluates
one submitted investigation, by an Authenticating account. Restructuring is not
a concept: approving the review approves the investigation, which then gives
the git commands that carry it out.

```instances
instantiate Authenticating

instantiate Sessioning with
  Subject is Authenticating.Account

instantiate RepositoryAccess with
  User is Authenticating.Account

instantiate InvestigatingChanges with
  User is Authenticating.Account

instantiate ReviewingDocumentation with
  Proposal is InvestigatingChanges.Investigation
  User is Authenticating.Account
```
