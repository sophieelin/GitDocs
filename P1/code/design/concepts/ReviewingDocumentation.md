# ReviewingDocumentation

## Purpose

Allow another developer to evaluate whether a proposed documentation structure
provides a coherent representation of the system.

## Principle

After a restructuring is submitted for review, the reviewer records concerns
and alternative suggestions and approves the proposal or requests changes. If
the reviewer later thinks of another concern or realizes they made a mistake,
they edit or remove a comment or suggestion, or reopen a review they already
decided so they can revisit it.

## Types

```types
external Restructuring
  A proposed documentation structure being evaluated.
external User
  A developer acting as a reviewer.
external Comment
  A concern the reviewer records about the proposal.
external Suggestion
  An alternative the reviewer proposes for the documentation structure.
Decision is PENDING or CHANGES_REQUESTED or APPROVED
  The decisions a review may hold.
```

## State

```state
a set of Reviews with
  a proposal Restructuring
  a reviewer User
  a comments set of Comments
  a suggestions set of Suggestions
  a decision Decision
  unique proposal and reviewer
```

## Actions

```actions
create(proposal: Restructuring, reviewer: User) : returns (review: Review)
  where no review has proposal and reviewer
  then
    add a new review with proposal, reviewer, empty comments and suggestions, and decision PENDING
    returns review
  where some review has proposal and reviewer
  then
    refuses REVIEW_EXISTS "This reviewer already has a review for this proposal."

comment(review: Review, comment: Comment) : returns ()
  where review is in Reviews and its decision is PENDING
  then
    add comment to the review's comments
    returns
  where review is not in Reviews
  then
    refuses COMMENT_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is not PENDING
  then
    refuses COMMENT_REVIEW_DECIDED "Reopen the review before changing its comments."

editComment(review: Review, comment: Comment, revised: Comment) : returns ()
  where review is in Reviews, its decision is PENDING, and comment is in its comments
  then
    replace comment with revised in the review's comments
    returns
  where review is not in Reviews
  then
    refuses EDIT_COMMENT_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is not PENDING
  then
    refuses EDIT_COMMENT_REVIEW_DECIDED "Reopen the review before changing its comments."
  where comment is not in the review's comments
  then
    refuses EDIT_COMMENT_NOT_FOUND "This comment is not on the review."

removeComment(review: Review, comment: Comment) : returns ()
  where review is in Reviews, its decision is PENDING, and comment is in its comments
  then
    remove comment from the review's comments
    returns
  where review is not in Reviews
  then
    refuses REMOVE_COMMENT_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is not PENDING
  then
    refuses REMOVE_COMMENT_REVIEW_DECIDED "Reopen the review before changing its comments."
  where comment is not in the review's comments
  then
    refuses REMOVE_COMMENT_NOT_FOUND "This comment is not on the review."

suggest(review: Review, suggestion: Suggestion) : returns ()
  where review is in Reviews and its decision is PENDING
  then
    add suggestion to the review's suggestions
    returns
  where review is not in Reviews
  then
    refuses SUGGEST_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is not PENDING
  then
    refuses SUGGEST_REVIEW_DECIDED "Reopen the review before changing its suggestions."

editSuggestion(review: Review, suggestion: Suggestion, revised: Suggestion) : returns ()
  where review is in Reviews, its decision is PENDING, and suggestion is in its suggestions
  then
    replace suggestion with revised in the review's suggestions
    returns
  where review is not in Reviews
  then
    refuses EDIT_SUGGESTION_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is not PENDING
  then
    refuses EDIT_SUGGESTION_REVIEW_DECIDED "Reopen the review before changing its suggestions."
  where suggestion is not in the review's suggestions
  then
    refuses EDIT_SUGGESTION_NOT_FOUND "This suggestion is not on the review."

removeSuggestion(review: Review, suggestion: Suggestion) : returns ()
  where review is in Reviews, its decision is PENDING, and suggestion is in its suggestions
  then
    remove suggestion from the review's suggestions
    returns
  where review is not in Reviews
  then
    refuses REMOVE_SUGGESTION_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is not PENDING
  then
    refuses REMOVE_SUGGESTION_REVIEW_DECIDED "Reopen the review before changing its suggestions."
  where suggestion is not in the review's suggestions
  then
    refuses REMOVE_SUGGESTION_NOT_FOUND "This suggestion is not on the review."

requestChanges(review: Review) : returns ()
  where review is in Reviews and its decision is PENDING
  then
    set the review's decision to CHANGES_REQUESTED
    returns
  where review is not in Reviews
  then
    refuses REQUEST_CHANGES_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is not PENDING
  then
    refuses REQUEST_CHANGES_REVIEW_DECIDED "This review has already been decided."

approve(review: Review) : returns ()
  where review is in Reviews and its decision is PENDING
  then
    set the review's decision to APPROVED
    returns
  where review is not in Reviews
  then
    refuses APPROVE_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is not PENDING
  then
    refuses APPROVE_REVIEW_DECIDED "This review has already been decided."

reopen(review: Review) : returns ()
  where review is in Reviews and its decision is CHANGES_REQUESTED or APPROVED
  then
    set the review's decision to PENDING
    returns
  where review is not in Reviews
  then
    refuses REOPEN_REVIEW_NOT_FOUND "There is no such review."
  where the review's decision is PENDING
  then
    refuses REVIEW_ALREADY_PENDING "This review is already pending."
```

## Queries

```queries
```
