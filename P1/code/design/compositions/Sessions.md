# Sessions

Sessions connect a GitHub identity to opaque, independently expiring GitDocs
sessions.

Signing in is GitHub's OAuth web flow, in two plain routes rather than
endpoints, because they redirect the browser and call GitHub.
`GET /api/auth/github` sends the browser to GitHub with a fresh state, kept in
a short-lived cookie. GitHub sends it back to `GET /api/auth/github/callback`,
which refuses a state that does not match the cookie, exchanges the code for a
token, and asks GitHub who it belongs to. Then it calls Authenticating's
`authenticate` with that GitHub id, login, and the token sealed, and Sessioning's
`start` for the returned account, whose reference is its username. The caller
never names the subject: it comes from GitHub. The session is handed to the
page in the fragment of a redirect to `/signed-in`, which is never sent to a
server.

A third plain route, `POST /api/github/access` with a session and a
repository, asks GitHub with the account's own token whether it can push
there, and records the answer with RepositoryAccess' `record`. A token GitHub
no longer accepts answers `UNAUTHORIZED`, so the user signs in again.

An [active session resolves to its subject username](reaction:Sessions.CurrentAccount.CurrentUser).
Every other GitDocs endpoint resolves the user this way, so a request never names
its own user. An unknown, ended, or expired session does not identify a current
account. The frontend calls this endpoint to restore a signed-in user after a
page reload.

```endpoints
Sessions.CurrentAccount.CurrentUser at /auth/current
```

[Signing out ends the presented active session](reaction:Sessions.LeavingApplication.SignOut).
Other sessions for the same account remain independent, and an ended session no
longer grants access to GitDocs.

```endpoints
Sessions.LeavingApplication.SignOut at /auth/sign-out
```
