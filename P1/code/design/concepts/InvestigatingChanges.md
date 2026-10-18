# InvestigatingChanges

## Purpose

Record, for a commit that may have changed the structure or responsibilities of
the system, which passages of the documentation no longer hold and why, so a
restructuring starts from a stated case instead of a hunch.

## Principle

Ari reads commit `d8ab205` in `sophieelin/PaperNet` and submits investigation
`inv-1` titled "Agents moved under lib/", with one highlight: lines 12 to 18 of
`csail_hack/README.md`, commented "Still describes agents/ at the top level;
they moved under lib/ in this commit". The investigation lists that highlight
with its lines and comment, and records Ari as its investigator. Bo submits a
second investigation of the same commit with a different title; both are listed
for that commit and among PaperNet's investigations, the most recently
submitted first. Another repository's list includes neither. A submission with
no title, or with no highlight, or with a highlight that has no comment or no
valid range of lines, is refused, and nothing is recorded.

## Types

```types
external User
  The developer who submits an investigation.
opaque HighlightList
  Highlighted passages, in the order given: each a documentation file's path, a range of lines in it from and to (1-based, from at most to), and a comment saying why those lines do not work.
```

## State

```state
a set of Investigations with
  an owner String
  a name String
  a commit String
  an investigator User
  a title String
  a submittedAt DateTime
  Rule: owner and name are compared without regard to letter case, as on GitHub; commit is a full 40-character SHA in lowercase.

a seq of Highlights with
  an investigation Investigation
  a path String
  a from Number
  a to Number
  a comment String
  Rule: from and to are line numbers in the file at the investigation's commit, counted from 1, and from is at most to.
```

## Actions

```actions
submit(investigator: User, owner: String, name: String, commit: String, title: String, highlights: HighlightList, at: DateTime) : returns (investigation: Investigation)
  where owner or name is empty
  then
    refuses INVALID_REPOSITORY "A repository needs an owner and a name."
  where commit is not a full 40-character commit SHA
  then
    refuses INVALID_COMMIT "An investigation needs a full commit SHA."
  where title is empty or longer than 120 characters
  then
    refuses INVALID_TITLE "An investigation needs a title of at most 120 characters."
  where highlights is empty, or a highlight has an empty path or comment, or its lines are not whole numbers from 1 with from at most to
  then
    refuses INVALID_HIGHLIGHTS "Highlight at least one passage, each with its lines and a comment."
  where every part is valid
  then
    add a new investigation with owner, name, commit, investigator, title, and at as its submittedAt
    add each highlight with its path, from, to, and comment, in order
    returns investigation
```

## Queries

```queries
_get(investigation: Investigation) : optional (investigation: Investigation, owner: String, name: String, commit: String, investigator: User, title: String, submittedAt: DateTime)
  answers the investigation's repository, commit, investigator, title, and when it was submitted
  answers no row for an unknown investigation

_highlights(investigation: Investigation) : many (path: String, from: Number, to: Number, comment: String)
  answers the investigation's highlights in the order they were given
  answers no rows for an unknown investigation

_forRepository(owner: String, name: String) : many (investigation: Investigation, commit: String, investigator: User, title: String, submittedAt: DateTime)
  answers every investigation in the repository, compared without regard to letter case
  orders rows by submittedAt, the most recently submitted first
  answers no rows for a repository with no investigations

_forCommit(owner: String, name: String, commit: String) : many (investigation: Investigation, investigator: User, title: String, submittedAt: DateTime)
  answers every investigation of that commit in the repository
  orders rows by submittedAt, the most recently submitted first
  answers no rows for a commit with no investigations
```
