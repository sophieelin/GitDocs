# InvestigatingChanges

## Purpose

Record, for a commit that may have changed the structure or responsibilities of
the system, which documentation needs to change and why, together with the
evidence for it, so a restructuring starts from a stated case instead of a
hunch.

## Principle

Ari reads commit `d8ab205` in `sophieelin/PaperNet` and submits investigation
`inv-1` titled "Agents moved under lib/": `csail_hack/README.md` is affected
because it still describes the old layout, and the evidence is "lib/agents/
gained its own README in this commit". The investigation lists that file with
its reason and that evidence item, and records Ari as its investigator. Bo
submits a second investigation of the same commit with a different title; both
are listed for that commit and among PaperNet's investigations, the most
recently submitted first. Another repository's list includes neither. A
submission with no title, no affected documentation, or no evidence is refused,
and nothing is recorded.

## Types

```types
external User
  The developer who submits an investigation.
opaque AffectedList
  The documentation files that need to change, each a path with a reason; paths are distinct.
opaque EvidenceList
  Short evidence texts, in the order given; a text may include a link.
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

a seq of AffectedDocuments with
  an investigation Investigation
  a path String
  a reason String
  unique investigation and path

a seq of EvidenceItems with
  an investigation Investigation
  a text String
```

## Actions

```actions
submit(investigator: User, owner: String, name: String, commit: String, title: String, affected: AffectedList, evidence: EvidenceList, at: DateTime) : returns (investigation: Investigation)
  where owner or name is empty
  then
    refuses INVALID_REPOSITORY "A repository needs an owner and a name."
  where commit is not a full 40-character commit SHA
  then
    refuses INVALID_COMMIT "An investigation needs a full commit SHA."
  where title is empty or longer than 120 characters
  then
    refuses INVALID_TITLE "An investigation needs a title of at most 120 characters."
  where affected is empty, or a path or reason is empty, or a path is repeated
  then
    refuses INVALID_AFFECTED_DOCUMENTATION "Name at least one affected documentation file, each once, with a reason."
  where evidence is empty, or an item is empty
  then
    refuses INVALID_EVIDENCE "Give at least one piece of evidence."
  where every part is valid
  then
    add a new investigation with owner, name, commit, investigator, title, and at as its submittedAt
    add each affected path with its reason, and each evidence item in order
    returns investigation
```

## Queries

```queries
_get(investigation: Investigation) : optional (investigation: Investigation, owner: String, name: String, commit: String, investigator: User, title: String, submittedAt: DateTime)
  answers the investigation's repository, commit, investigator, title, and when it was submitted
  answers no row for an unknown investigation

_affected(investigation: Investigation) : many (path: String, reason: String)
  answers the investigation's affected documentation in the order it was given
  answers no rows for an unknown investigation

_evidence(investigation: Investigation) : many (text: String)
  answers the investigation's evidence in the order it was given
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
