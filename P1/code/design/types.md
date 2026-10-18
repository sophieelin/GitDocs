# GitTrace Application Types

Every concept instance the application selects, with its external types bound.

A session represents the account whose password was accepted, so Sessioning's
subject is an Authenticating account.

```instances
instantiate Authenticating

instantiate Sessioning with
  Subject is Authenticating.Account
```
