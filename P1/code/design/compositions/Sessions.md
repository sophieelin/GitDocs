# Sessions

Sessions connect accepted account credentials to opaque, independently expiring
GitTrace sessions.

Registration [establishes a new account and starts a session](reaction:Sessions.EnteringApplication.Register)
for the returned account reference, which is that account's username.
[Sign-in](reaction:Sessions.EnteringApplication.SignIn) proves an existing account's
credentials and starts a new session for the returned account reference. In both
cases callers cannot choose a different subject.

```endpoints
Sessions.EnteringApplication.Register at /auth/register
Sessions.EnteringApplication.SignIn at /auth/sign-in
```

An [active session resolves to its subject username](reaction:Sessions.CurrentAccount.CurrentUser).
Every other GitTrace endpoint resolves the user this way, so a request never names
its own user. An unknown, ended, or expired session does not identify a current
account. The frontend calls this endpoint to restore a signed-in user after a
page reload.

```endpoints
Sessions.CurrentAccount.CurrentUser at /auth/current
```

[Signing out ends the presented active session](reaction:Sessions.LeavingApplication.SignOut).
Other sessions for the same account remain independent, and an ended session no
longer grants access to GitTrace.

```endpoints
Sessions.LeavingApplication.SignOut at /auth/sign-out
```
