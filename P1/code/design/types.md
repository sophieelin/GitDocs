# GitDocs Application Types

Every concept instance the application selects, with its external types bound.

A session represents the account whose password was accepted, so Sessioning's
subject is an Authenticating account. The developer who opens an investigation
is the signed-in account, so InvestigatingChanges' user is an Authenticating
account too. A restructuring proposal is written by the signed-in account and
responds to one submitted investigation. A review is opened by the signed-in
account, of one restructuring proposal.

```instances
instantiate Authenticating

instantiate Sessioning with
  Subject is Authenticating.Account

instantiate InvestigatingChanges with
  User is Authenticating.Account

instantiate RestructuringDocumentation with
  User is Authenticating.Account
  Investigation is InvestigatingChanges.Investigation

instantiate ReviewingDocumentation with
  Restructuring is RestructuringDocumentation.Restructuring
  User is Authenticating.Account
```
