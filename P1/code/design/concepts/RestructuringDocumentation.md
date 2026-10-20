# RestructuringDocumentation

## Purpose

Let a developer propose and justify a different documentation structure, in
response to an investigation of a commit, without requiring the documentation
to mirror the code, so a structural change to the docs is argued for before it
is made.

## Principle

After creating a restructuring, the restructuring preserves the current
documentation structure and allows the developer to construct and justify an
alternative structure. If the developer wants to keep working on a submitted
restructuring, they revise it back into a draft, and a draft they no longer
want can be discarded.

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

a seq of Comments with
  a restructuring Restructuring
  a path String
  a from Number
  a to Number
  a start Number
  an end Number
  a text String
  Rule: from and to are line numbers in the file at the restructuring's commit, counted from 1, and from is at most to.
  Rule: the comment is on the text from character start of line from up to, but not including, character end of line to, counting characters from 0; on one line, start is less than end.
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

comment(restructuring: Restructuring, author: User, path: String, from: Number, to: Number, start: Number, end: Number, text: String, at: DateTime) : returns (comment: Comment)
  where restructuring is not in Restructurings
  then
    refuses PROPOSAL_NOT_FOUND "There is no such proposal."
  where author is not the restructuring's author
  then
    refuses NOT_PROPOSAL_AUTHOR "Only the proposal's author can change it."
  where the restructuring's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft proposal can be changed."
  where path or text is empty, from and to are not whole numbers from 1 with from at most to, start and end are not whole numbers from 0, or the comment is on one line and start is not less than end
  then
    refuses INVALID_COMMENT "A comment needs a file, the text it is on, and some text."
  where the author's comment is valid
  then
    add a new comment on restructuring with path, from, to, start, end, and text
    set at as the restructuring's updatedAt
    returns comment

uncomment(restructuring: Restructuring, author: User, comment: Comment, at: DateTime) : returns ()
  where restructuring is not in Restructurings
  then
    refuses PROPOSAL_NOT_FOUND "There is no such proposal."
  where author is not the restructuring's author
  then
    refuses NOT_PROPOSAL_AUTHOR "Only the proposal's author can change it."
  where the restructuring's status is not DRAFT
  then
    refuses NOT_DRAFT "Only a draft proposal can be changed."
  where comment is not one of the restructuring's comments
  then
    refuses COMMENT_NOT_FOUND "There is no such comment on this proposal."
  where the comment is on the author's draft
  then
    remove comment
    set at as the restructuring's updatedAt
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

_comments(restructuring: Restructuring) : many (comment: Comment, path: String, from: Number, to: Number, start: Number, end: Number, text: String)
  answers the proposal's comments in the order they were added
  answers no rows for an unknown or discarded proposal

_forRepository(owner: String, name: String) : many (restructuring: Restructuring, author: User, investigation: Investigation, commit: String, title: String, status: Status, updatedAt: DateTime)
  answers every proposal in the repository, without its structures, compared without regard to letter case
  orders rows by updatedAt, the most recently changed first
  answers no rows for a repository with no proposals

_pendingApproval(owner: String, name: String) : many (restructuring: Restructuring, author: User, investigation: Investigation, commit: String, title: String, updatedAt: DateTime)
  answers every proposal in the repository whose status is PENDING_APPROVAL, without its structures, compared without regard to letter case
  orders rows by updatedAt, the longest waiting first
  answers no rows for a repository with no proposals pending approval
```
