# RestructuringDocumentation

## Purpose

Allow developers to construct and justify alternative documentation structures
in response to a set of commits without requiring documentation to mirror the
code structure.

## Principle

After creating a restructuring proposal, the proposal preserves the current
documentation structure and allows the developer to construct and justify an
alternative structure. If the developer wants to keep working on a proposal
they already submitted, they revise it back into a draft, and a draft they no
longer want can be discarded.

## Types

```types
external Commit
  A repository commit.
external DocumentationTree
  The hierarchy connecting documentation items.
Status is DRAFT or UNDER_REVIEW or APPROVED or APPLIED
  The lifecycle states a restructuring may occupy.
```

## State

```state
a set of Restructurings with
  a commits set of Commits
  a currentStructure DocumentationTree
  a proposedStructure DocumentationTree
  a rationale String
  a status Status
```

## Actions

```actions
create(commits: Commits, currentStructure: DocumentationTree, rationale: String) : returns (restructuring: Restructuring)
  where currentStructure is given
  then
    add a new restructuring with commits, currentStructure, currentStructure as its proposedStructure, rationale, and status DRAFT
    returns restructuring

modify(restructuring: Restructuring, proposedStructure: DocumentationTree, rationale: String) : returns ()
  where restructuring is in Restructurings and its status is DRAFT
  then
    set the restructuring's proposedStructure to proposedStructure and its rationale to rationale
    returns
  where restructuring is not in Restructurings
  then
    refuses MODIFY_RESTRUCTURING_NOT_FOUND "There is no such restructuring."
  where the restructuring's status is not DRAFT
  then
    refuses MODIFY_RESTRUCTURING_NOT_DRAFT "Only a draft restructuring can be modified."

submit(restructuring: Restructuring) : returns ()
  where restructuring is in Restructurings and its status is DRAFT
  then
    set the restructuring's status to UNDER_REVIEW
    returns
  where restructuring is not in Restructurings
  then
    refuses SUBMIT_RESTRUCTURING_NOT_FOUND "There is no such restructuring."
  where the restructuring's status is not DRAFT
  then
    refuses SUBMIT_RESTRUCTURING_NOT_DRAFT "Only a draft restructuring can be submitted."

revise(restructuring: Restructuring) : returns ()
  where restructuring is in Restructurings and its status is UNDER_REVIEW or APPROVED
  then
    set the restructuring's status to DRAFT
    returns
  where restructuring is not in Restructurings
  then
    refuses REVISE_RESTRUCTURING_NOT_FOUND "There is no such restructuring."
  where the restructuring's status is DRAFT or APPLIED
  then
    refuses REVISE_RESTRUCTURING_NOT_SUBMITTED "Only a restructuring under review or approved can be revised."

discard(restructuring: Restructuring) : returns ()
  where restructuring is in Restructurings and its status is DRAFT
  then
    remove restructuring
    returns
  where restructuring is not in Restructurings
  then
    refuses DISCARD_RESTRUCTURING_NOT_FOUND "There is no such restructuring."
  where the restructuring's status is not DRAFT
  then
    refuses DISCARD_RESTRUCTURING_NOT_DRAFT "Only a draft restructuring can be discarded."

approve(restructuring: Restructuring) : returns ()
  where restructuring is in Restructurings and its status is UNDER_REVIEW
  then
    set the restructuring's status to APPROVED
    returns
  where restructuring is not in Restructurings
  then
    refuses APPROVE_RESTRUCTURING_NOT_FOUND "There is no such restructuring."
  where the restructuring's status is not UNDER_REVIEW
  then
    refuses APPROVE_RESTRUCTURING_NOT_UNDER_REVIEW "Only a restructuring under review can be approved."

apply(restructuring: Restructuring) : returns ()
  where restructuring is in Restructurings and its status is APPROVED
  then
    set the restructuring's currentStructure to its proposedStructure and its status to APPLIED
    returns
  where restructuring is not in Restructurings
  then
    refuses APPLY_RESTRUCTURING_NOT_FOUND "There is no such restructuring."
  where the restructuring's status is not APPROVED
  then
    refuses APPLY_RESTRUCTURING_NOT_APPROVED "Only an approved restructuring can be applied."
```

## Queries

```queries
```
