# InvestigatingChanges

## Purpose

Give a commit that may have changed the structure or responsibilities of the
system one shared place where its documentation is looked at, so developers
reason about the same commit together instead of each starting from scratch.

## Principle

Ari opens an investigation of commit `d8ab205` in `sophieelin/PaperNet` and
receives investigation `inv-1`, recorded as opened by Ari. It is listed among
PaperNet's investigations. When Ari opens the same commit again, and when Bo
opens it later, both receive `inv-1` rather than a second investigation, and it
still shows Ari as the one who opened it. Opening commit `6d4a4c6` creates a
second investigation, listed before the first because it was opened later.
Another repository's list does not include either. Opening a commit that is not
a full commit SHA is refused.

## Types

```types
external User
  The developer who opens an investigation.
```

## State

```state
a set of Investigations with
  an owner String
  a name String
  a commit String
  an investigator User
  an openedAt DateTime
  unique owner and name and commit
  Rule: owner and name are compared without regard to letter case, as on GitHub; commit is a full 40-character SHA in lowercase.
```

## Actions

```actions
open(investigator: User, owner: String, name: String, commit: String, at: DateTime) : returns (investigation: Investigation)
  where owner or name is empty
  then
    refuses INVALID_REPOSITORY "A repository needs an owner and a name."
  where commit is not a full 40-character commit SHA
  then
    refuses INVALID_COMMIT "An investigation needs a full commit SHA."
  where an investigation of commit in that repository already exists
  then
    returns investigation
  where no investigation of commit in that repository exists
  then
    add a new investigation with owner, name, commit, investigator, and at as its openedAt
    returns investigation
```

## Queries

```queries
_get(investigation: Investigation) : optional (investigation: Investigation, owner: String, name: String, commit: String, investigator: User, openedAt: DateTime)
  answers the investigation's repository, commit, who opened it, and when
  answers no row for an unknown investigation

_forRepository(owner: String, name: String) : many (investigation: Investigation, commit: String, investigator: User, openedAt: DateTime)
  answers every investigation in the repository, compared without regard to letter case
  orders rows by openedAt, the most recently opened first
  answers no rows for a repository with no investigations
```
