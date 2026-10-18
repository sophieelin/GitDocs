# GitDocs MVP: TypeScript, MongoDB, GitHub API, and Vue

## Goal

Build GitDocs incrementally using TypeScript, MongoDB, the GitHub REST API, sync-engine, and Vue.

The MVP supports this workflow:

1. A developer registers and signs in.
2. They open a public GitHub repository and see its commits and current documentation.
3. They open an investigation of a commit, which shows the code and documentation structures side by side.
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
- **Access control is enforced in the backend.** The frontend may hide a button, but every rule about who may do what is checked by a view or reaction on the server, and each one has an HTTP test that calls the endpoint directly as the wrong user (`tests/http/access-control.test.ts`).
- **No manual refreshes.** Every screen that shows server data loads it with `useRefreshOnFocus` (`web/src/refresh.ts`), so it reloads each time the tab is opened again, and after each of its own actions.

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

Define the operations needed by GitDocs:

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

**Phase completion:** GitDocs can retrieve real commits and a documentation tree for a selected commit.

# Phase 2: Shared backend scaffolding ✅ Done (2.4 moved to 3.4)

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

Moved to 3.4 (`{ db }`). No concepts existed yet, so there was nothing to assemble. The `{ github }` input planned for the ConnectingRepositories concept was removed with that concept.

## 2.5 Add the backend entry point ✅

**Diff:** `src/main.ts`

- Start the handler using `Bun.serve`.
- Listen on port 3000.
- Keep server startup logic separate from concept implementations.

**Verify:** Start the backend and confirm it listens successfully.

# Phase 3: Slice 1 — Sign in

**At the end:** you can open GitDocs in a browser, register, sign in, reload, and stay signed in.

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

**Verify:** `bun run dev` shows a "GitDocs" page, and each route shows a placeholder.

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

# Phase 4: Slice 2 — Open a repository and see its documentation

**At the end:** you can open a real public repository, pick a commit, and see its documentation tree. Repositories you opened are listed as recent ones.

**No concept (decision of 2026-10-17).** Reading a repository's commits and documentation tree does not get its own concept; the ConnectingRepositories steps were removed.

**How the backend reads GitHub (decided 2026-10-17):** two plain routes in `src/http.ts`, such as `/api/github/commits` and `/api/github/tree`, answered before sync-engine's handler. They use the existing `GitHubApi` adapter and `buildDocumentationTree`, so `GITHUB_TOKEN` stays on the server. They store nothing and make no decisions, which is the case where sync-engine's design guide allows a thin adapter instead of a concept.

**Recent repositories (decided 2026-10-17):** remembered in the browser's `localStorage`, per username, not in MongoDB. They last across reloads, sign-outs, and browser restarts on the same browser, need no concept, and store nothing on the server. There is no connect or disconnect.

## 4.1 GitHub routes

**Diff:** see `plan-endpoints.md` E3: `/api/github/commits` and `/api/github/tree`.

**Verify:** Route tests pass with `StubGitHubFetcher`. Then, with the backend running, use `curl` to list `sophieelin/PaperNet`'s commits and read its tree.

## 4.2 Repository, commit, and tree screens

**Diff:** see `plan-vue.md` V4.1, then V4.2, then V4.3, one screen per diff.

**Verify:** After each screen, open it in the browser and check it as in that V step.

**Follow the UI sketches (decided 2026-10-18).** The screens in 4.2 showed a separate page per commit, but in the sketches a commit is looked at inside an *investigation* (sketch 2), and a repository has its own home page (sketch 1). The rest of Phase 4 follows the sketches:

- **A repository workspace (decided 2026-10-18).** Investigations, proposals, and reviews belong to one repository, so after you open a repository, everything is scoped to it, as in sketch 1 ("GitDocs  my-repo"):
  - URLs include the repository: `/repositories/:owner/:name` (Home), `/repositories/:owner/:name/investigations` (and `/:investigation`), `/repositories/:owner/:name/proposals` (and `/:proposal`), `/repositories/:owner/:name/reviews`.
  - A left sidebar with the repository's name (its Home, such as "PaperNet"), Investigations, Proposals, and Reviews for the current repository. Only working pages get links.
  - A top bar with a breadcrumb ("PaperNet › Proposals") and the signed-in user. There is no repository dropdown (removed 2026-10-18 at the user's request): to change repositories, click the username or the GitDocs logo to go back to `/repositories`.
  - `/repositories` stays as the starting page before a repository is chosen: open one or pick a recent one.
  - Every stored investigation and proposal records its repository (owner and name), and every list shows only the current repository's items.
- The repository's Home at `/repositories/:owner/:name` shows its recent commits and current documentation structure. It replaces 4.2's separate commit and tree pages.
- Simple saved investigations: InvestigatingChanges joins the MVP, minimally. Opening a commit creates an investigation with its own URL, listed under the repository's Investigations, showing Code Structure and Documentation Structure side by side. A proposal will start from an investigation. No agent, evidence, or Copilot yet.

## 4.3 Layout following the UI sketches

**Diff:** `web/src/App.vue`, `web/src/components/AppSidebar.vue`, `web/src/components/AppTopBar.vue` (replacing `AppHeader.vue`), shared styles.

- Sidebar: GitDocs, then the repository's name (its Home), Investigations, Proposals, and Reviews for the current repository. Before a repository is chosen, only Repositories.
- Top bar: a breadcrumb ("PaperNet › Proposals", the name linking to Home) and the username, which links back to `/repositories` like the GitDocs logo, with a sign-out button.
- Cards, buttons, and the `› folder/` tree style from the sketches.

**Verify:** `bun run check`, and a screenshot of each existing page matches the sketches' layout. The username and the logo both go back to `/repositories`.

## 4.4 Code tree in the tree route

**Diff:** `src/github/documentationTree.ts`, `src/github/routes.ts`, tests.

`/api/github/tree` also returns `code`: every file in the repository at that commit, nested in its folders, for the Code Structure panel. `documentation` stays Markdown only.

**Verify:** Route tests with `StubGitHubFetcher` check both trees.

## 4.5 Repository Home

**Diff:** `web/src/pages/RepositoryHomePage.vue`, `web/src/router.ts` (all repository routes under `/repositories/:owner/:name`); remove `CommitsPage.vue` and `TreePage.vue`.

At `/repositories/:owner/:name`: the repository name, its recent commits, and its current documentation structure (at the newest commit). Each commit has an "Investigate" button (step 4.9). The Investigations, Proposals, and Reviews routes under the repository show placeholders until their steps.

**Verify:** In the browser, PaperNet's page shows 30 commits and its five current READMEs.

## 4.6 InvestigatingChanges specification for the MVP

**Diff:** `design/concepts/InvestigatingChanges.md`

- Add the repository (owner and name) to an investigation, and use one commit per investigation.
- The investigator is a User; the AI agent is out of scope.
- Add queries to get one investigation and to list a user's investigations.
- Opening the same commit twice reopens the existing investigation instead of creating another.

**Verify:** `bun run check:design`

## 4.7 Implement and register InvestigatingChanges

**Diff:** `src/concepts/InvestigatingChanges.ts`, its registry, `src/concepts.ts`, `src/http.ts` (`publicErrors`), `design/types.md`, `tests/concepts/InvestigatingChanges.test.ts`

**Verify:** `bun run test:memory` covers opening, opening the same commit again, getting, listing, and every refusal. `bun run generate && bun run check`.

## 4.8 Investigation endpoints

**Diff:** `src/compositions/Investigations.ts`, `design/compositions/Investigations.md`, tests.

`/investigations/open` (session, owner, name, commit), `/investigations/get` (session, investigation), `/investigations/list` (session, owner, name). Only signed-in users. The list shows every investigation in that repository, with who opened it, because the repository is a shared workspace.

**Verify:** Endpoint tests, including that the list shows only that repository's investigations, and another user's investigation in the same repository.

## 4.9 Investigation screens

**Diff:** `web/src/pages/InvestigationsPage.vue`, `web/src/pages/InvestigationPage.vue`, router.

The repository's list at `/repositories/:owner/:name/investigations`, and `/repositories/:owner/:name/investigations/:investigation` with Code Structure and Documentation Structure side by side, as in sketch 2 (without Evidence and Copilot). Home's "Investigate" button opens one.

**Verify:** In the browser, as in the Try it check below.

## ✋ Try it: Phase 4

1. As A, open `sophieelin/PaperNet`. Its page shows its commits and current documentation. After a reload, it is in your recent repositories.
2. Open `sophieelin/PaperNett`, which is misspelled. You see "repository not found."
3. PaperNet's commits match GitHub's commit list.
4. Investigate commit `d8ab205`. The Documentation Structure includes `csail_hack/README.md`, and the Code Structure shows the `csail_hack/` code.
5. Investigate commit `6d4a4c6`. `csail_hack/README.md` is gone, and `README.md` at the root and the four `lib/agents` READMEs are still there.
6. Both investigations are listed under PaperNet's Investigations, and investigating `d8ab205` again opens the same one.
7. Click your username to go back to your repositories, and open another one. Its Investigations list does not show PaperNet's.

# Phase 5: Slice 3 — Create, save, and submit a proposal

**At the end:** you can write a proposal from a commit's tree, save it, and submit it. It shows *Pending Approval*.

## 5.1 Update the specification

**Diff:** `design/concepts/RestructuringDocumentation.md`

- Add the author, repository (owner and name), and commit to each proposal, and the investigation it started from.
- Add queries to get one proposal and to list a repository's proposals (the repository workspace's Proposals page), with the author on each.
- Decide whether author-only actions check the author themselves (see `history.md`, 2026-10-17, "Plans for reactions and views").

**Verify:** `bun run check:design`

## 5.2 Skeleton and registration

**Diff:** `src/concepts/RestructuringDocumentation.ts`, `src/concepts/RestructuringDocumentation.registry.ts`, `src/concepts.ts`, `design/types.md`

The repository is stored as owner and name strings, as in InvestigatingChanges, so there is no repository type to bind.

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

**Diff:** `tests/http/access-control.test.ts` (new)

Access-control tests that call the HTTP handler directly, with no frontend, as two signed-in accounts A and B:

- B calls `/proposals/modify` on A's draft proposal → refused (403), and A's proposal is unchanged when read back with `/proposals/get`.
- B calls `/proposals/submit` on A's draft → refused (403), and it is still a draft.
- A request with no session, or an ended session, → refused (401).

**Verify:** Endpoint tests and access-control tests pass. Then create and submit a proposal with `curl`, and repeat the first access-control case by hand with B's session.

## 5.7 Proposal editor

**Diff:** see `plan-vue.md` V5.1, then V5.2.

**Verify:** As in V5.

## 5.8 Proposals list and proposal page

**Diff:** see `plan-vue.md` V6.1, then V6.2. Both live in the repository workspace: `/repositories/:owner/:name/proposals` lists that repository's proposals, with the author on each and "Mine" marked, and `/repositories/:owner/:name/proposals/:proposal` shows one.

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

**Verify:** `bun run test:memory`: only a pending proposal can be approved, and the queue lists only one repository's pending proposals.

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

**Diff:** `tests/http/access-control.test.ts`

Add review cases:

- A opens a review of their own proposal → refused (403), and no review is created.
- A approves their own proposal, using a review id → refused (403), and the proposal stays *Pending Approval*.
- C, a third account, approves the review that B opened → refused (403).

**Verify:** A two-account endpoint test: A submits, B opens the review and approves, and A's proposal is `APPROVED`. The access-control cases above pass.

## 6.7 Review screens

**Diff:** see `plan-vue.md` V7.1, then V7.2, then V7.3 with only the Approve button.

**Verify:** As in V7.

## ✋ Try it: Phase 6 (MVP complete)

1. As B, open PaperNet's Reviews. A's proposal is there. As A, your own proposal is not in your Reviews.
2. As B, open it. You see the current and proposed structures side by side, with the changes marked.
3. As B, approve.
4. As A, with PaperNet's Proposals already open in another window, switch back to it. The status changes to *Approved* without reloading the page.

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
- The investigation agent, evidence, Copilot, and marking affected documentation. (Simple saved investigations are in the MVP since 2026-10-18.)
- Private repositories and signing in with GitHub.
