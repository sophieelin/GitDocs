# GitTrace MVP: TypeScript, MongoDB, GitHub API, and Vue

## Goal

Build GitTrace incrementally using TypeScript, MongoDB, the GitHub REST API, sync-engine, and Vue.

The MVP supports this workflow:

1. A developer registers and signs in.
2. They connect a GitHub repository.
3. They select a commit and view its documentation tree.
4. They create, edit, and submit a restructuring proposal.
5. A second developer reviews the proposal.
6. The reviewer approves it or requests changes.
7. The proposal's status reflects the decision.

From Phase 3 on, the plan is built in **thin slices**. Each phase adds one part of the workflow all the way through: concept, endpoints, and screen. Each phase ends with a **Try it** check that you do by hand in the browser. The investigation agent and automatic pull request creation are out of scope.

## Working rules

- Make one small, independently reviewable diff at a time.
- Give every diff a clear purpose and a specific verification command.
- Do not combine a new concept, its entire implementation, its endpoints, and its tests into one large change.
- Run the design checker after specification changes and the TypeScript checker after implementation changes.
- Add tests as each action is implemented.
- Use the real GitHub API from the beginning. Keep the API adapter separate from the concepts so it can be tested independently.
- Concept and endpoint tests use `StubGitHubFetcher` (`tests/github/StubGitHubFetcher.ts`) so they run offline. Only the integration tests and the Try it checks use real GitHub.
- Use MongoDB for persistent state and `mongodb-memory-server` for isolated tests.
- Follow the existing sync-engine examples for concept classes, registries, floors, compositions, and reactions.
- Do not implement features merely because they might be useful later.
- Do not start a phase until the previous phase's Try it check passes.

## Related plans

The detailed steps for views and reactions, endpoints, and screens are in their own plans. This plan says **when** each of their steps happens:

- `plan-reactions.md`: steps R1–R5
- `plan-endpoints.md`: steps E1–E6
- `plan-vue.md`: steps V1–V8

## Try it setup

For every Try it check:

1. Start MongoDB: `bun run db:up`
2. Start the backend and frontend: `bun run dev`
3. Open the frontend URL that `bun run dev` prints.

Use `sophieelin/PaperNet` as the real repository. Commit `6d4a4c6` ("clean codebase") deletes `csail_hack/README.md`, so it is a real example of a code change that changed the documentation structure.

For two users, use one normal browser window and one private window.

# Phase 1: GitHub API integration ✅ Done

Start with the part of the product that retrieves real repository data. Keep it independent of MongoDB and sync-engine until the API behavior is understood.

## 1.1 Add GitHub configuration ✅

**Diff:** `.env.example`

- Add an optional `GITHUB_TOKEN` environment variable.
- Keep actual credentials out of version control.
- Ensure the token is read only by backend code.

**Verify:** The application can start without a token when using a public repository.

## 1.2 Define the GitHub fetcher interface ✅

**Diff:** `src/github/GitHubFetcher.ts`

Define the operations needed by GitTrace:

- List commits for a repository.
- Retrieve the file tree at a specific commit SHA.

Keep the interface independent of HTTP, MongoDB, and sync-engine.

**Verify:** TypeScript compiles.

## 1.3 Define the application-level types ✅

**Diff:** `src/github/types.ts`

Define the minimal data structures for:

- Repository owner and name.
- Commit SHA and message.
- Tree entries and file paths.

Use application-level types rather than passing complete GitHub API responses throughout the backend.

**Verify:** TypeScript compiles.

## 1.4 Implement the GitHub REST API adapter ✅

**Diff:** `src/github/GitHubApi.ts`

- Implement `GitHubFetcher`.
- Use GitHub's REST API to list commits and retrieve a commit's tree.
- Send authorization headers when a token is configured.
- Handle unsuccessful HTTP responses, invalid repository names, and missing commits.
- Handle recursive tree responses and GitHub's `truncated` indicator.

**Verify:** TypeScript compiles.

## 1.5 Test commit listing against GitHub ✅

**Diff:** `tests/github/list-commits.integration.test.ts`

- Use a known public repository.
- Confirm that real commit SHAs and messages are returned.
- Avoid assertions that depend on the latest commit remaining unchanged.

**Verify:** Run the integration test against GitHub.

## 1.6 Test retrieving a commit tree ✅

**Diff:** `tests/github/get-tree.integration.test.ts`

- Retrieve a tree for a known commit SHA.
- Confirm that file paths are returned.
- Test an invalid SHA and an unsuccessful API response.

**Verify:** Run the integration test.

## 1.7 Convert repository paths into a documentation tree ✅

**Diff:** `src/github/documentationTree.ts`

- Filter for Markdown files.
- Preserve their paths and nested folder structure.
- Support root-level files such as `README.md`.
- Do not assume all documentation is stored under `docs/`.

**Verify:** Add unit tests for root files, nested folders, and an empty result.

## 1.8 Add a manual GitHub integration script ✅

**Diff:** `scripts/test-github.ts`

Create a small script that:

1. Accepts a repository owner and name.
2. Lists its commits.
3. Retrieves a selected commit's tree.
4. Prints the resulting documentation tree.

**Verify:** Run it against a real repository.

## 1.9 Add a stub fetcher for deterministic tests ✅

**Diff:** `tests/github/StubGitHubFetcher.ts`

Implement the same interface with fixed test data: the `sophieelin/my-repo` repository from the UI sketches, at two commits. Use it for concept and endpoint tests so that they do not require a network connection.

**Verify:** The unit tests work offline, and the real integration tests work separately.

**Phase completion:** GitTrace can retrieve real commits and a documentation tree for a selected commit.

# Phase 2: Shared backend scaffolding ✅ Done (2.4 moved to 3.4 and 4.2)

## 2.1 Add the MongoDB connection helper ✅

**Diff:** `src/db.ts`

- Implement database connection and cleanup.
- Keep connection management outside the concept classes.

**Verify:** Connect to the development database.

## 2.2 Add the database test helper ✅

**Diff:** `tests/test-db.ts`

- Configure `mongodb-memory-server`.
- Add `test` and `test:memory` scripts if they do not already exist.
- Keep test database setup reusable.

**Verify:** Run a small insert-and-read test.

## 2.3 Add the HTTP handler ✅

**Diff:** `src/http.ts`

Use `createHttpHandler` from `@mit-sdg/sync-engine-http/handler` to create the HTTP handler from an assembled application and gateway.

Do not add application endpoints yet.

**Verify:** TypeScript compiles.

## 2.4 Add application assembly (moved)

Moved to 3.4 (`{ db }`) and 4.2 (`{ github }`). No concepts existed yet, so there was nothing to assemble.

## 2.5 Add the backend entry point ✅

**Diff:** `src/main.ts`

- Start the handler using `Bun.serve`.
- Listen on port 3000.
- Keep server startup logic separate from concept implementations.

**Verify:** Start the backend and confirm it listens successfully.

# Phase 3: Slice 1 — Sign in

**At the end:** you can open GitTrace in a browser, register, sign in, reload, and stay signed in.

## 3.1 Copy the specifications

**Diff:** `design/concepts/Authenticating.md`, `design/concepts/Sessioning.md`

Copy both from the sync-engine message-board example, keeping their actions, queries, and refusals.

**Verify:** `bun run check:design`

## 3.2 Implement authentication

**Diff:** `src/concepts/Authenticating.ts`, `tests/concepts/Authenticating.test.ts`

Implement the actions on MongoDB, following the example's password handling.

**Verify:** `bun run test:memory` covers registering, signing in, a wrong password, and a duplicate username.

## 3.3 Implement sessions

**Diff:** `src/concepts/Sessioning.ts`, `tests/concepts/Sessioning.test.ts`

Implement session creation, current-user lookup, and sign-out.

**Verify:** `bun run test:memory` covers starting a session, looking it up, and using it after sign-out.

## 3.4 Register both concepts

**Diff:** `src/concepts/Authenticating.registry.ts`, `src/concepts/Sessioning.registry.ts`, `src/concepts.ts`, `src/assembly.ts`, `design/types.md`, `generated.config.ts`

- Register both concepts with a `"mongo"` floor.
- Make `assembleApplication` take `{ db }` (moved from 2.4).
- Create `design/types.md` with `Sessioning.Subject` bound to `Authenticating.Account`, and register it.

**Verify:** `bun run generate && bun run check`

## 3.5 Shared HTTP setup

**Diff:** see `plan-endpoints.md` E1.1–E1.3.

**Verify:** As in E1.

## 3.6 Session endpoints

**Diff:** see `plan-endpoints.md` E2: `/auth/register`, `/auth/sign-in`, `/auth/sign-out`, `/auth/current`.

**Verify:** Endpoint tests pass. Then, with `bun run start` running, register and sign in with `curl`.

## 3.7 Frontend scaffold

**Diff:** see `plan-vue.md` V1.1–V1.2.

**Verify:** `bun run dev` shows a "GitTrace" page, and each route shows a placeholder.

## 3.8 API client, session, and errors

**Diff:** see `plan-vue.md` V2.1–V2.3.

**Verify:** As in V2.

## 3.9 Sign-in screen

**Diff:** see `plan-vue.md` V3.1.

**Verify:** As in V3.1.

## ✋ Try it: Phase 3

1. Register account A and sign in.
2. Reload the page. You are still signed in.
3. Sign out. Protected pages send you to sign-in.
4. Sign in with a wrong password. You see an error message, not a blank page.
5. Register account B in a private window.

# Phase 4: Slice 2 — Connect a repository and see its documentation

**At the end:** you can connect a real repository, pick a commit, and see its documentation tree.

## 4.1 Write the specification

**Diff:** `design/concepts/ConnectingRepositories.md`

Connect and disconnect a repository for a user; list a user's repositories; list a repository's commits; get the documentation tree at a commit. Refuse unknown repositories.

**Verify:** `bun run check:design`

## 4.2 Skeleton and registration

**Diff:** `src/concepts/ConnectingRepositories.ts`, `src/concepts/ConnectingRepositories.registry.ts`, `src/concepts.ts`, `src/assembly.ts`, `design/types.md`

- Declare every action and query, and one error class per refusal. Bodies throw `TODO`.
- Inject a `GitHubFetcher`. Make `assembleApplication` take `{ github }` (moved from 2.4): `gitHubApiFromEnv()` for the server and `StubGitHubFetcher` in tests.

**Verify:** `bun run generate && bun run check`

## 4.3 Connections

**Diff:** `src/concepts/ConnectingRepositories.ts`, `tests/concepts/ConnectingRepositories.test.ts`

Connect, disconnect, and list, stored in MongoDB.

**Verify:** `bun run test:memory`, using `StubGitHubFetcher`, covers connecting, listing, disconnecting, and an unknown repository.

## 4.4 Commits and documentation tree

**Diff:** `src/concepts/ConnectingRepositories.ts`, `tests/concepts/ConnectingRepositories.test.ts`

List commits and get the documentation tree at a commit, through the injected fetcher and `documentationTree.ts`.

**Verify:** `bun run test:memory`: the stub's two commits come back newest first, and each commit's tree matches the stub data.

## 4.5 View: the user has connected the repository

**Diff:** see `plan-reactions.md` R1.1 and R2.1.

**Verify:** As in R2.1.

## 4.6 Repository endpoints

**Diff:** see `plan-endpoints.md` E3.

**Verify:** Endpoint tests pass. Then use `curl` to connect `sophieelin/PaperNet` and list its commits.

## 4.7 Repository, commit, and tree screens

**Diff:** see `plan-vue.md` V4.1, then V4.2, then V4.3, one screen per diff.

**Verify:** After each screen, open it in the browser and check it as in that V step.

## ✋ Try it: Phase 4

1. As A, connect `sophieelin/PaperNet`.
2. Connect `sophieelin/PaperNett`, which is misspelled. You see "repository not found."
3. Open PaperNet's commits. They match GitHub's commit list.
4. Open commit `d8ab205`. The tree includes `csail_hack/README.md`.
5. Open commit `6d4a4c6`. `csail_hack/README.md` is gone, and `README.md` at the root and the four `lib/agents` READMEs are still there.

# Phase 5: Slice 3 — Create, save, and submit a proposal

**At the end:** you can write a proposal from a commit's tree, save it, and submit it. It shows *Pending Approval*.

## 5.1 Update the specification

**Diff:** `design/concepts/RestructuringDocumentation.md`

- Add the author, repository, and commit to each proposal.
- Add queries to get one proposal and to list an author's proposals.
- Decide whether author-only actions check the author themselves (see `history.md`, 2026-10-17, "Plans for reactions and views").

**Verify:** `bun run check:design`

## 5.2 Skeleton and registration

**Diff:** `src/concepts/RestructuringDocumentation.ts`, `src/concepts/RestructuringDocumentation.registry.ts`, `src/concepts.ts`, `design/types.md`

Bind its repository type to `ConnectingRepositories.Repository`.

**Verify:** `bun run generate && bun run check`

## 5.3 Create, modify, and get

**Diff:** `src/concepts/RestructuringDocumentation.ts`, `tests/concepts/RestructuringDocumentation.test.ts`

**Verify:** `bun run test:memory` covers creating, editing a draft, getting it back, and a missing proposal.

## 5.4 Submit

**Diff:** `src/concepts/RestructuringDocumentation.ts`, `tests/concepts/RestructuringDocumentation.test.ts`

Draft to pending approval, in one atomic conditional update.

**Verify:** `bun run test:memory`: submitting works once, a second submit is refused, and editing after submitting is refused.

## 5.5 View: the user owns the proposal

**Diff:** see `plan-reactions.md` R3.1.

**Verify:** As in R3.1.

## 5.6 Proposal endpoints

**Diff:** see `plan-endpoints.md` E4, except the review queue (E4.3), which moves to Phase 6.

**Verify:** Endpoint tests pass, including that user B cannot edit A's proposal. Then create and submit a proposal with `curl`.

## 5.7 Proposal editor

**Diff:** see `plan-vue.md` V5.1, then V5.2.

**Verify:** As in V5.

## 5.8 My proposals and proposal page

**Diff:** see `plan-vue.md` V6.1, then V6.2.

**Verify:** As in V6.

## ✋ Try it: Phase 5

1. As A, open PaperNet at commit `6d4a4c6` and start a proposal.
2. Move `csail_hack/lib/agents/README.md` to the root and write a rationale.
3. Save and reload. Your changes are still there.
4. Submit. The status is *Pending Approval*, and you can no longer edit it.
5. As B, open A's proposal. You can see it but not edit it.

# Phase 6: Slice 4 — Review and approve

**At the end:** the full MVP journey works with two users. B approves A's proposal, and A sees *Approved*.

## 6.1 Approve and the review queue in RestructuringDocumentation

**Diff:** `src/concepts/RestructuringDocumentation.ts`, `tests/concepts/RestructuringDocumentation.test.ts`, and the spec if needed

Add `approve` and the query that lists proposals under review.

**Verify:** `bun run test:memory`: only a pending proposal can be approved, and the queue lists only pending proposals.

## 6.2 Review specification

**Diff:** `design/concepts/ReviewingDocumentation.md`

Only what the MVP needs: open a review, get a review, get a proposal's review, and approve. Keep one review per proposal, reopened on resubmission (Phase 7).

**Verify:** `bun run check:design`

## 6.3 Skeleton and registration

**Diff:** `src/concepts/ReviewingDocumentation.ts`, `src/concepts/ReviewingDocumentation.registry.ts`, `src/concepts.ts`, `design/types.md`

Bind its proposal type to `RestructuringDocumentation.Restructuring`.

**Verify:** `bun run generate && bun run check`

## 6.4 Open and approve a review

**Diff:** `src/concepts/ReviewingDocumentation.ts`, `tests/concepts/ReviewingDocumentation.test.ts`

Opening a review uses a unique index, and the duplicate-key error becomes the declared refusal.

**Verify:** `bun run test:memory` covers opening, opening twice, and approving.

## 6.5 Review views and the approval reaction

**Diff:** see `plan-reactions.md` R4.1–R4.4.

**Verify:** As in R4.4: approving the review makes the proposal `APPROVED`.

## 6.6 Review endpoints and the review queue

**Diff:** see `plan-endpoints.md` E4.3, then E5 without request-changes.

**Verify:** A two-account endpoint test: A submits, B opens the review and approves, and A's proposal is `APPROVED`.

## 6.7 Review screens

**Diff:** see `plan-vue.md` V7.1, then V7.2, then V7.3 with only the Approve button.

**Verify:** As in V7.

## ✋ Try it: Phase 6 (MVP complete)

1. As B, open the review queue. A's proposal is there. As A, your own proposal is not in your queue.
2. As B, open it. You see the current and proposed structures side by side, with the changes marked.
3. As B, approve.
4. As A, open *My proposals*. The status is *Approved*.

# Phase 7: Slice 5 — Request changes and resubmit

**At the end:** a reviewer can send a proposal back, and the author can fix it and resubmit.

## 7.1 Revise in RestructuringDocumentation

**Diff:** `src/concepts/RestructuringDocumentation.ts`, `tests/concepts/RestructuringDocumentation.test.ts`

Add `revise`, which moves a pending proposal back to draft. Add `discard` only if the spec requires it.

**Verify:** `bun run test:memory` covers revising and the refused cases.

## 7.2 Request changes and reopen in ReviewingDocumentation

**Diff:** `src/concepts/ReviewingDocumentation.ts`, `tests/concepts/ReviewingDocumentation.test.ts`

**Verify:** `bun run test:memory` covers requesting changes and reopening.

## 7.3 Reactions

**Diff:** see `plan-reactions.md` R4.5–R4.6.

**Verify:** As in R4.6: the full cycle in one test.

## 7.4 Request-changes endpoint

**Diff:** the rest of `plan-endpoints.md` E5.

**Verify:** As in E5: the two-account full cycle over HTTP.

## 7.5 Request Changes button

**Diff:** `plan-vue.md` V7.3, the rest of it.

**Verify:** As in V7.3.

## ✋ Try it: Phase 7

1. As A, submit a new proposal.
2. As B, request changes. A sees *Changes Requested* and can edit again.
3. As A, edit and resubmit. B sees it pending again.
4. As B, approve. A sees *Approved*.

# Phase 8: Final checks

## 8.1 Concept checks

Run every concept's tests and check that:

- Invalid state transitions are refused.
- Duplicate records are rejected where required.
- Users cannot act as another user by supplying an arbitrary identity.
- Unauthenticated requests are rejected.
- Reviewer authorization is enforced.
- Concurrent status updates cannot both succeed when only one transition is valid.

## 8.2 Contract and composition checks

See `plan-endpoints.md` E6 and `plan-reactions.md` R5.

## 8.3 Walkthrough

Do `plan-vue.md` V8.1: the full journey in two browsers, from a fresh `bun run db:reset`.

## 8.4 Final commands

- `bun run check:design`
- `bun run generate && bun run check`
- `bun test`
- `bun run test:memory`

Use the project's existing script names where possible. If a required script is missing, add it in a separate diff.

# Out of scope

- Comments and suggestions on reviews.
- Applying an approved proposal (`apply`) and opening a pull request on GitHub.
- InvestigatingChanges and the investigation agent.
- Private repositories and signing in with GitHub.
