# InvestigatingChanges

## Purpose

Let a developer build the case for a different documentation structure after a
commit that may have changed the structure or responsibilities of the system:
which passages of the documentation no longer hold and why, the changes to the
structure that would fix them, and the rationale, so a structural change is
argued for, and approved, before anything in the repository changes.

## Principle

After starting an investigation of a commit, the investigator highlights the
passages that no longer hold, each with a comment, and plans changes to the
documentation structure: moving or renaming files and folders, creating files
and folders, and removing empty folders. Once the plan has a rationale, they
submit it, and it no longer changes. If a passage was highlighted by mistake,
the investigator removes it before submitting, and a draft they no longer want
can be discarded. Once a submitted investigation is approved, it gives the git
commands that make its changes; the investigator runs them in a clone of the
repository, writes any new files, pushes, and records the commit that applied
them.

## Types

```types
external User
  The developer who writes an investigation.
opaque DocumentationTree
  Documentation files nested in folders by path: folders with names, paths, subfolders, and files.
opaque OperationList
  Changes to a documentation structure, in order: each moves a file or folder from one path to another (a rename is a move within its folder), creates a file or an empty folder at a path, or removes an empty folder.
Status is DRAFT or SUBMITTED or APPROVED or APPLIED
  The lifecycle states an investigation may occupy.
```

## State

```state
a set of Investigations with
  an investigator User
  an owner String
  a name String
  a commit String
  a title String
  a currentStructure DocumentationTree
  an operations OperationList
  a proposedStructure DocumentationTree
  a rationale String
  a status Status
  an appliedCommit String
  a createdAt DateTime
  an updatedAt DateTime
  Rule: owner and name are compared without regard to letter case, as on GitHub; commit is a full 40-character SHA in lowercase.
  Rule: currentStructure never changes after the investigation is started.
  Rule: proposedStructure is always currentStructure with operations applied in order.
  Rule: appliedCommit is empty until the investigation is APPLIED, and then a full 40-character SHA in lowercase.

a seq of Highlights with
  an investigation Investigation
  a path String
  a from Number
  a to Number
  a start Number
  an end Number
  a text String
  Rule: from and to are line numbers in the file at the investigation's commit, counted from 1, and from is at most to.
  Rule: the highlight is on the text from character start of line from up to, but not including, character end of line to, counting characters from 0; on one line, start is less than end.
```

## Actions

```actions
start(investigator: User, owner: String, name: String, commit: String, title: String, currentStructure: DocumentationTree, at: DateTime) : returns (investigation: Investigation)
  where owner or name is empty
  then
    refuses INVALID_REPOSITORY "A repository needs an owner and a name."
  where commit is not a full 40-character commit SHA
  then
    refuses INVALID_COMMIT "An investigation needs a full commit SHA."
  where title is empty or longer than 120 characters
  then
    refuses INVALID_TITLE "An investigation needs a title of at most 120 characters."
  where currentStructure is not a documentation tree
  then
    refuses INVALID_STRUCTURE "That is not a documentation structure."
  where every part is valid
  then
    add a new investigation with investigator, owner, name, commit, title, currentStructure, no operations, currentStructure as its proposedStructure, an empty rationale, status DRAFT, an empty appliedCommit, and at as its createdAt and updatedAt
    returns investigation

modify(investigation: Investigation, investigator: User, title: String, operations: OperationList, rationale: String, at: DateTime) : returns ()
  where investigation is not in Investigations
  then
    refuses INVESTIGATION_NOT_FOUND "There is no such investigation."
  where investigator is not the investigation's investigator
  then
    refuses NOT_INVESTIGATOR "Only the investigation's author can change it."
  where the investigation's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft investigation can be changed."
  where title is empty or longer than 120 characters
  then
    refuses INVALID_TITLE "An investigation needs a title of at most 120 characters."
  where operations is not a list of changes, or a change does not apply to the structure the changes before it produce
  then
    refuses INVALID_OPERATIONS "Those changes do not fit the documentation structure."
  where the investigator's draft is valid
  then
    set the investigation's title, operations, rationale, currentStructure with operations applied as its proposedStructure, and at as its updatedAt
    returns

highlight(investigation: Investigation, investigator: User, path: String, from: Number, to: Number, start: Number, end: Number, text: String, at: DateTime) : returns (highlight: Highlight)
  where investigation is not in Investigations
  then
    refuses INVESTIGATION_NOT_FOUND "There is no such investigation."
  where investigator is not the investigation's investigator
  then
    refuses NOT_INVESTIGATOR "Only the investigation's author can change it."
  where the investigation's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft investigation can be changed."
  where path or text is empty, from and to are not whole numbers from 1 with from at most to, start and end are not whole numbers from 0, or the highlight is on one line and start is not less than end
  then
    refuses INVALID_HIGHLIGHT "A highlight needs a file, the text it is on, and a comment."
  where the investigator's highlight is valid
  then
    add a new highlight on investigation with path, from, to, start, end, and text
    set at as the investigation's updatedAt
    returns highlight

unhighlight(investigation: Investigation, investigator: User, highlight: Highlight, at: DateTime) : returns ()
  where investigation is not in Investigations
  then
    refuses INVESTIGATION_NOT_FOUND "There is no such investigation."
  where investigator is not the investigation's investigator
  then
    refuses NOT_INVESTIGATOR "Only the investigation's author can change it."
  where the investigation's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft investigation can be changed."
  where highlight is not one of the investigation's highlights
  then
    refuses HIGHLIGHT_NOT_FOUND "There is no such highlight on this investigation."
  where the highlight is on the investigator's draft
  then
    remove highlight
    set at as the investigation's updatedAt
    returns

submit(investigation: Investigation, investigator: User, at: DateTime) : returns ()
  where investigation is not in Investigations
  then
    refuses INVESTIGATION_NOT_FOUND "There is no such investigation."
  where investigator is not the investigation's investigator
  then
    refuses NOT_INVESTIGATOR "Only the investigation's author can change it."
  where the investigation's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft investigation can be changed."
  where the investigation's rationale is empty
  then
    refuses RATIONALE_MISSING "Explain the proposed structure before submitting it."
  where the investigator's draft has a rationale
  then
    set the investigation's status to SUBMITTED and at as its updatedAt
    returns

discard(investigation: Investigation, investigator: User) : returns ()
  where investigation is not in Investigations
  then
    refuses INVESTIGATION_NOT_FOUND "There is no such investigation."
  where investigator is not the investigation's investigator
  then
    refuses NOT_INVESTIGATOR "Only the investigation's author can change it."
  where the investigation's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft investigation can be changed."
  where the investigation is the investigator's draft
  then
    remove the investigation and its highlights
    returns

approve(investigation: Investigation, at: DateTime) : returns ()
  where investigation is not in Investigations
  then
    refuses INVESTIGATION_NOT_FOUND "There is no such investigation."
  where the investigation's status is not SUBMITTED
  then
    refuses INVESTIGATION_NOT_PENDING "Only a submitted investigation can be approved."
  where the investigation is submitted
  then
    set the investigation's status to APPROVED and at as its updatedAt
    returns

apply(investigation: Investigation, investigator: User, commit: String, at: DateTime) : returns ()
  where investigation is not in Investigations
  then
    refuses INVESTIGATION_NOT_FOUND "There is no such investigation."
  where investigator is not the investigation's investigator
  then
    refuses NOT_INVESTIGATOR "Only the investigation's author can change it."
  where the investigation's status is not APPROVED
  then
    refuses NOT_APPROVED "Only an approved investigation can be applied, and only once."
  where commit is not a full 40-character commit SHA
  then
    refuses INVALID_COMMIT "Give the full SHA of the commit that applied the changes."
  where the investigator's investigation is approved
  then
    set the investigation's status to APPLIED, commit in lowercase as its appliedCommit, and at as its updatedAt
    returns
```

## Queries

```queries
_get(investigation: Investigation) : optional (investigation: Investigation, investigator: User, owner: String, name: String, commit: String, title: String, rationale: String, status: Status, appliedCommit: String, currentStructure: DocumentationTree, operations: OperationList, proposedStructure: DocumentationTree, createdAt: DateTime, updatedAt: DateTime)
  answers the investigation with both of its structures and its changes
  answers no row for an unknown or discarded investigation

_highlights(investigation: Investigation) : many (highlight: Highlight, path: String, from: Number, to: Number, start: Number, end: Number, text: String)
  answers the investigation's highlights in the order they were added
  answers no rows for an unknown or discarded investigation

_forRepository(owner: String, name: String) : many (investigation: Investigation, investigator: User, commit: String, title: String, status: Status, updatedAt: DateTime)
  answers every investigation in the repository, without its structures, compared without regard to letter case
  orders rows by updatedAt, the most recently changed first
  answers no rows for a repository with no investigations

_forCommit(owner: String, name: String, commit: String) : many (investigation: Investigation, investigator: User, title: String, status: Status, updatedAt: DateTime)
  answers every investigation of that commit in the repository, without its structures
  orders rows by updatedAt, the most recently changed first
  answers no rows for a commit with no investigations

_commands(investigation: Investigation) : many (command: String)
  answers, in order, the shell commands that make the investigation's changes in a clone of the repository at its root
  a moved file is `git mv` from its path to its new path; a moved folder is `git mv` for each documentation file in it, so code in the folder stays where it is
  a new file is `touch` and then `git add` for the file, and a removed folder is `rmdir`
  a folder that a change needs is made with `mkdir -p` just before it, only when neither the structure nor an earlier command has it
  quotes every path in single quotes, so a path with spaces or other special characters is passed as it is
  answers no rows for an unknown investigation or one with no changes
```
