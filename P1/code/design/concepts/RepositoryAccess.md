# RepositoryAccess

## Purpose

Remember for a short time whether a user can push to a repository on GitHub,
so only people who could carry out a change can propose or approve it.

## Principle
After GitHub answers that a user can push to a repository, `record` keeps that,
and `authorize` for the user and the repository succeeds. Another user, or the
same user for another repository, is refused. When GitHub answers that the user
cannot push, or 30 minutes after the answer, `authorize` is refused again until
GitHub is asked anew. Owner and name are matched without regard to case, as
GitHub does.

## Types

```types
external User
  The account the answer is about.
```

## State

```state
a set of Grants with
  a user User
  a repository String
  a canPush Flag
  an expiresAt DateTime
  Rule: repository is the owner and name in lowercase, and there is at most one grant per user and repository.
```

## Actions

```actions
record (user: User, owner: String, name: String, canPush: Flag, at: DateTime) : returns ()
  where owner or name is empty
  then
    refuses INVALID_REPOSITORY "A repository needs an owner and a name."
  where owner and name are given
  then
    set the grant of user for the repository to canPush, expiring 30 minutes after at
    returns

authorize (user: User, owner: String, name: String, at: DateTime) : returns ()
  where user has no grant for the repository that can push and has not expired by at
  then
    refuses NO_PUSH_ACCESS "Only people who can push to this repository on GitHub can change its proposals."
  where user has such a grant
  then
    returns
```

## Queries

```queries
_canPush (user: User, owner: String, name: String, at: DateTime) : one (canPush: Flag)
  answers false when there is no grant that can push and has not expired by at
```
