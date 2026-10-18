# GitDocs Endpoints and Formers Plan

## Goal

Plan the HTTP layer of the backend:

- **Endpoints** connect an HTTP request to concept actions: receive the input, resolve the session, check policy views, call actions, and respond.
- **Formers** build the response for read requests. They join concept queries and views into one result, such as a proposal together with its review.

This plan goes with `plan.md`, which decides when each step happens: E1–E2 in Phase 3, E3 in Phase 4, E4 in Phase 5 (except E4.3), E4.3 and E5 in Phases 6 and 7. Backend step numbers in this file are from an older version of the plan. Views come from `plan-reactions.md`.

## Working rules

- One endpoint group (one composition file) per diff. Within it, add endpoints one at a time if the diff gets large.
- Every endpoint except register and sign-in receives a `session` and resolves the user with `Sessioning.current({ session })`. A request never names its own user.
- Every concept refusal and policy failure is sent as an error **category**, never as its own code: the HTTP adapter's error body is only `{ "error": "CATEGORY" }`, with the matching status (see E1.1). Each refusal code must be listed in `publicErrors` in `src/http.ts`; a missing one is sent as `INTERNAL_ERROR` (500). Nothing fails silently.
- The **Errors** columns below name the concepts' refusal codes. The client sees only their categories, so the frontend shows one message per category on each screen, and checks input itself where one category covers several cases (decision of 2026-10-17).
- Every endpoint has input and output validators in `src/compositions/validators.ts`.
- A former is only for a read that combines several sources or needs a specific shape. An endpoint that returns one action's result responds with it directly.
- Each endpoint is tested by calling the HTTP handler in-process, and checked by hand with `curl`.

# Phase E1: Shared HTTP setup

Do this phase after backend step 2.5 and before step 3.8.

## E1.1 Base path and error mapping

**Diff:** `src/http.ts`

- Serve every endpoint under `/api`, so the Vue frontend (`plan-vue.md`) and the API can share an origin.
- List every refusal code in `publicErrors`, with the category the client receives. Use this guide when adding a concept's codes:

| Kind of refusal | Category | Status |
| --------------- | -------- | ------ |
| Invalid input (such as `INVALID_USERNAME`, `WEAK_PASSWORD`) | `INVALID_REQUEST` | 400 |
| Not signed in or wrong credentials (such as `UNKNOWN_SESSION`, `INVALID_CREDENTIALS`) | `UNAUTHORIZED` | 401 |
| Signed in but not allowed (such as `NOT_PROPOSAL_AUTHOR`, `NOT_REVIEWER`, `CANNOT_*`) | `FORBIDDEN` | 403 |
| Missing (such as `*_NOT_FOUND`) | `NOT_FOUND` | 404 |
| Duplicate or wrong status (such as `USERNAME_TAKEN`, `ALREADY_SUBMITTED`, `REVIEW_EXISTS`) | `CONFLICT` | 409 |

There is no category for "GitHub is unavailable", so `GITHUB_UNAVAILABLE` (E3) is sent as `INTERNAL_ERROR` (500).

**Verify:** `bun run check`, and a request to an unknown path returns the handler's 404.

## E1.2 Validators

**Diff:** `src/compositions/validators.ts`

Start with the shared shapes: `sessionOnlyInput`, `credentialsInput`, `issuedSessionOutput`, and `errorOutput`. Add each endpoint's own validators in the same diff as that endpoint.

**Verify:** `bun run check`

## E1.3 Endpoint test helper

**Diff:** `tests/http/client.ts`

- Build the handler from the test-assembled application (`plan-reactions.md` R1.1) and call it with `Request` objects. No server and no port are needed.
- Add helpers `register(name)` and `signIn(name)` that return a session, so later tests can act as two users.

**Verify:** A test sends one request and receives the handler's 404.

# Phase E2: Session endpoints (backend step 3.8)

**Diff:** `src/compositions/Sessions.ts`, `design/compositions/Sessions.md`

Follow the message-board example's `Sessions` composition.

| Endpoint | Input | Output | Errors |
| -------- | ----- | ------ | ------ |
| `/auth/register` | username, password | account, session, expiresAt | `INVALID_USERNAME`, `WEAK_PASSWORD` → 400; `USERNAME_TAKEN` → 409 |
| `/auth/sign-in` | username, password | account, session, expiresAt | `INVALID_CREDENTIALS` → 401 |
| `/auth/current` | session | username | `UNKNOWN_SESSION` → 401 |
| `/auth/sign-out` | session | signedOut | `UNKNOWN_SESSION` → 401 |

`/auth/current` is added to the backend plan's list, because the frontend needs it to restore a signed-in user after a page reload.

No formers are needed.

**Verify:** Tests for each endpoint, including a reused session after sign-out. Then `curl` each endpoint against `bun run start`.

# Phase E3: Repository endpoints (backend step 4.7)

**Diff:** `src/compositions/Repositories.ts`, `design/compositions/Repositories.md`

| Endpoint | Input | Output | Errors |
| -------- | ----- | ------ | ------ |
| `/repositories/connect` | session, owner, name | repository | `REPOSITORY_NOT_FOUND`, `ALREADY_CONNECTED` |
| `/repositories/disconnect` | session, repository | (empty) | `REPOSITORY_NOT_CONNECTED` |
| `/repositories/list` | session | repositories (former) | — |
| `/repositories/commits` | session, repository | commits | `REPOSITORY_NOT_CONNECTED`, `GITHUB_UNAVAILABLE` |
| `/repositories/tree` | session, repository, sha | tree, truncated | `REPOSITORY_NOT_CONNECTED`, `COMMIT_NOT_FOUND` |

`/repositories/disconnect` is added to the backend plan's list, because step 4.4 implements disconnect.

## E3.1 Former: the user's repositories

```ts
const RepositoriesOf = former("the repositories of (user)", ({ user }, { repository, owner, name }) =>
  form({
    repositories: each(ConnectingRepositories._connections({ user }).is({ repository, owner, name }))
      .form({ repository, owner, name }),
  }),
);
```

An empty list is a valid answer, not an error.

`/repositories/commits` and `/repositories/tree` return their concept action's result directly, because they read from GitHub through the fetcher, not from stored state. They use the `(user) has connected (repository)` view.

**Verify:** Tests use the fake fetcher. Then use `curl` against a real public repository.

# Phase E4: Proposal endpoints (backend step 5.9)

**Diff:** `src/compositions/Proposals.ts`, `design/compositions/Proposals.md`

| Endpoint | Input | Output | Errors |
| -------- | ----- | ------ | ------ |
| `/proposals/create` | session, repository, sha, currentStructure, rationale | proposal | `REPOSITORY_NOT_CONNECTED` |
| `/proposals/modify` | session, proposal, proposedStructure, rationale | (empty) | `NOT_PROPOSAL_AUTHOR`, `NOT_DRAFT` |
| `/proposals/submit` | session, proposal | (empty) | `NOT_PROPOSAL_AUTHOR`, `NOT_DRAFT` |
| `/proposals/discard` | session, proposal | (empty) | `NOT_PROPOSAL_AUTHOR`, `NOT_DRAFT` |
| `/proposals/get` | session, proposal | proposal detail (former) | `PROPOSAL_NOT_FOUND` |
| `/proposals/mine` | session | proposal summaries (former) | — |
| `/proposals/under-review` | session | review queue (former) | — |

`/proposals/discard` and `/proposals/mine` are added to the backend plan's list. `discard` exists in the spec (step 5.8), and `mine` is how an author sees the *Approved* status that the MVP journey requires.

## E4.1 Former: proposal detail

`the proposal detail (proposal)`: the proposal's author, repository, commit, rationale, status, current structure, and proposed structure, plus its review's reviewer and status through `whether(theReviewOf({ proposal }))`. A proposal with no review keeps its row with an empty review.

## E4.2 Former: proposal summary list

`the proposals of (user)`: `each` over the user's proposals, with the id, repository, commit, status, and last change. No trees, so the list stays small.

## E4.3 Former: review queue

`the review queue for (user)`: `each` over proposals pending approval whose author is not the user, in the summary shape from E4.2.

**Verify:** Tests check that a second user cannot modify, that `get` returns both trees, and that the queue hides a user's own proposals. Then `curl` the create → modify → submit → get sequence.

# Phase E5: Review endpoints (backend step 6.7)

**Diff:** `src/compositions/Reviews.ts`, `design/compositions/Reviews.md`

| Endpoint | Input | Output | Errors |
| -------- | ----- | ------ | ------ |
| `/reviews/open` | session, proposal | review | `CANNOT_REVIEW_OWN_PROPOSAL`, `PROPOSAL_NOT_PENDING`, `REVIEW_EXISTS` |
| `/reviews/get` | session, review | review detail (former) | `REVIEW_NOT_FOUND` |
| `/reviews/approve` | session, review | proposal detail (former) | `NOT_REVIEWER`, `REVIEW_NOT_PENDING` |
| `/reviews/request-changes` | session, review | proposal detail (former) | `NOT_REVIEWER`, `REVIEW_NOT_PENDING` |

`/reviews/approve` and `/reviews/request-changes` respond with the proposal detail after the reaction from `plan-reactions.md` (R4.4 or R4.5) has run, so the reviewer sees the proposal's real new status in the same response.

## E5.1 Former: review detail

`the review detail (review)`: the reviewer, the review status, and the proposal detail from E4.1, so the review screen can compare the current and proposed structures from one response.

**Verify:** A two-account test runs the full cycle over the handler: submit → open → request changes → modify → submit → approve, and checks each response's status. Then do the same with `curl`, as in backend step 7.2.

# Phase E6: Contract checks

## E6.1 Generated wire contract

- `bun run generate` updates `generated/wire.ts`, which the Vue client imports (`plan-vue.md`).
- Confirm that every endpoint and error code in this plan appears in `generated/application.md`.

**Verify:** `bun run generate && bun run check` and `bun run test:memory`.

# Out of scope

- Endpoints for comments, suggestions, and investigations.
- Paging for commits and proposals.
- Cookies for sessions. The session token is sent in the request body, as in the sync-engine example. Moving it to an HTTP-only cookie can come later.
