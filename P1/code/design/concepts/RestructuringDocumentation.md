# RestructuringDocumentation

## Purpose

Let a developer propose and justify a different documentation structure, in
response to an investigation of a commit, without requiring the documentation
to mirror the code, so a structural change to the docs is argued for before it
is made.

## Principle

Ari starts proposal `p-1`, "Organize the agents docs", from investigation
`inv-1` of commit `6d4a4c6` in `sophieelin/PaperNet`. The proposal keeps the
documentation structure as it was at that commit and starts with the same
structure as its proposal. Ari moves `csail_hack/lib/agents/README.md` to the
root in the proposed structure and saves; the current structure is unchanged.
Submitting without a rationale is refused. Ari writes the rationale and submits,
and the proposal is pending approval. Further edits are refused, as are Bo's
attempts to edit or submit it. A draft Ari no longer wants can be discarded.
PaperNet's proposals list `p-1` with its title, author, and status, and its
proposals pending approval list `p-1` too. Once `p-1` is approved, it is no
longer pending approval, and approving it again is refused.

## Types

```types
external User
  The developer who writes a proposal.
external Investigation
  The investigation a proposal responds to.
opaque DocumentationTree
  Documentation files nested in folders by path: folders with names, paths, subfolders, and files.
Status is DRAFT or PENDING_APPROVAL or APPROVED
  The lifecycle states a proposal may occupy.
```

## State

```state
a set of Restructurings with
  an author User
  an investigation Investigation
  an owner String
  a name String
  a commit String
  a title String
  a currentStructure DocumentationTree
  a proposedStructure DocumentationTree
  a rationale String
  a status Status
  a createdAt DateTime
  an updatedAt DateTime
  Rule: owner and name are compared without regard to letter case, as on GitHub; commit is a full 40-character SHA in lowercase.
  Rule: currentStructure never changes after the proposal is created.
```

## Actions

```actions
create(author: User, investigation: Investigation, owner: String, name: String, commit: String, title: String, currentStructure: DocumentationTree, at: DateTime) : returns (restructuring: Restructuring)
  where owner or name is empty, or commit is not a full 40-character commit SHA
  then
    refuses INVALID_PROPOSAL_SOURCE "A proposal needs a repository and a full commit SHA."
  where title is empty or longer than 120 characters
  then
    refuses INVALID_PROPOSAL_TITLE "A proposal needs a title of at most 120 characters."
  where currentStructure is not a documentation tree
  then
    refuses INVALID_STRUCTURE "That is not a documentation structure."
  where every part is valid
  then
    add a new restructuring with author, investigation, owner, name, commit, title, currentStructure, currentStructure as its proposedStructure, an empty rationale, status DRAFT, and at as its createdAt and updatedAt
    returns restructuring

modify(restructuring: Restructuring, author: User, title: String, proposedStructure: DocumentationTree, rationale: String, at: DateTime) : returns ()
  where restructuring is not in Restructurings
  then
    refuses PROPOSAL_NOT_FOUND "There is no such proposal."
  where author is not the restructuring's author
  then
    refuses NOT_PROPOSAL_AUTHOR "Only the proposal's author can change it."
  where the restructuring's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft proposal can be changed."
  where title is empty or longer than 120 characters
  then
    refuses INVALID_PROPOSAL_TITLE "A proposal needs a title of at most 120 characters."
  where proposedStructure is not a documentation tree
  then
    refuses INVALID_STRUCTURE "That is not a documentation structure."
  where the author's draft is valid
  then
    set the restructuring's title, proposedStructure, and rationale, and at as its updatedAt
    returns

submit(restructuring: Restructuring, author: User, at: DateTime) : returns ()
  where restructuring is not in Restructurings
  then
    refuses PROPOSAL_NOT_FOUND "There is no such proposal."
  where author is not the restructuring's author
  then
    refuses NOT_PROPOSAL_AUTHOR "Only the proposal's author can change it."
  where the restructuring's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft proposal can be changed."
  where the restructuring's rationale is empty
  then
    refuses RATIONALE_MISSING "Explain the proposed structure before submitting it."
  where the author's draft has a rationale
  then
    set the restructuring's status to PENDING_APPROVAL and at as its updatedAt
    returns

discard(restructuring: Restructuring, author: User) : returns ()
  where restructuring is not in Restructurings
  then
    refuses PROPOSAL_NOT_FOUND "There is no such proposal."
  where author is not the restructuring's author
  then
    refuses NOT_PROPOSAL_AUTHOR "Only the proposal's author can change it."
  where the restructuring's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft proposal can be changed."
  where the restructuring is the author's draft
  then
    remove restructuring
    returns

approve(restructuring: Restructuring, at: DateTime) : returns ()
  where restructuring is not in Restructurings
  then
    refuses PROPOSAL_NOT_FOUND "There is no such proposal."
  where the restructuring's status is not PENDING_APPROVAL
  then
    refuses PROPOSAL_NOT_PENDING "Only a proposal pending approval can be approved."
  where the restructuring is pending approval
  then
    set the restructuring's status to APPROVED and at as its updatedAt
    returns
```

## Queries

```queries
_get(restructuring: Restructuring) : optional (restructuring: Restructuring, author: User, investigation: Investigation, owner: String, name: String, commit: String, title: String, rationale: String, status: Status, currentStructure: DocumentationTree, proposedStructure: DocumentationTree, createdAt: DateTime, updatedAt: DateTime)
  answers the proposal with both of its structures
  answers no row for an unknown or discarded proposal

_forRepository(owner: String, name: String) : many (restructuring: Restructuring, author: User, investigation: Investigation, commit: String, title: String, status: Status, updatedAt: DateTime)
  answers every proposal in the repository, without its structures, compared without regard to letter case
  orders rows by updatedAt, the most recently changed first
  answers no rows for a repository with no proposals

_pendingApproval(owner: String, name: String) : many (restructuring: Restructuring, author: User, investigation: Investigation, commit: String, title: String, updatedAt: DateTime)
  answers every proposal in the repository whose status is PENDING_APPROVAL, without its structures, compared without regard to letter case
  orders rows by updatedAt, the longest waiting first
  answers no rows for a repository with no proposals pending approval
```
