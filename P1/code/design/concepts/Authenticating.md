# Authenticating

## Purpose

Establish an account from a GitHub identity, so each GitHub account is exactly
one account here, and a name alone cannot act as proof of identity.

## Principle
A user signs in through GitHub, which proves their GitHub id and login. The
first time, `authenticate` adds an account whose username is that login, and
`_registered` then reports the username as registered. Signing in again with the
same GitHub id returns the same account, even after the login changes on
GitHub, and keeps the newest token. Another GitHub account that now has a login
already held here is refused, so it never takes over an account's work.

## Types

```types
opaque Secret
  A sealed GitHub token; its representation is the implementer's choice.
```

## State

```state
a set of Accounts with
  a unique githubId String
  a unique username String
  a token Secret
```

## Actions

```actions
authenticate (githubId: String, login: String, token: Secret) : returns (account: Account)
  where githubId is not 1 to 20 digits, login is not 1 to 39 letters, digits, or hyphens, or token is empty
  then
    refuses INVALID_IDENTITY "GitHub did not give a usable identity."
  where githubId is unknown and login is the username of an account
  then
    refuses USERNAME_TAKEN "That GitHub name belongs to another account here."
  where githubId is unknown and login is free
  then
    add a new account with githubId, login as its username, and token
    bind account to that account
    returns account
  where githubId is known
  then
    set the account's token to token
    bind account to that account
    returns account
```

## Queries

```queries
_registered (username: String) : one (registered: Flag)
  answers false for an unknown username

_token (username: String) : optional (token: Secret)
  answers no row for an unknown username
```
