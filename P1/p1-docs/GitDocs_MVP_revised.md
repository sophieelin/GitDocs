# GitDocs MVP

**Stack:** TypeScript, Bun, MongoDB, sync-engine, Vue, GitHub REST API

## MVP workflow

1. Register and sign in.
2. Open a public GitHub repository and browse its commits and documentation.
3. Submit an investigation for a commit.
4. Create and submit a documentation restructuring proposal.
5. A second user reviews the proposal and approves it or requests changes.

The investigation agent, Copilot, evidence collection, and GitHub pull-request creation are not part of this MVP.

I used `sophieelin/PaperNet` for the real-repository checks.

---

# Phase 1: GitHub API

**Status: Done**

### 1.1 Configuration
**Files:** `.env.example`

- Add optional `GITHUB_TOKEN`.
- Keep the token on the backend and out of version control.

**Check:** The app starts without a token for public repositories.

### 1.2 Fetcher interface and types
**Files:** `src/github/GitHubFetcher.ts`, `src/github/types.ts`

Define operations to list commits and retrieve a commit's file tree. Add application types for repositories, commits, and tree entries. Do not pass raw GitHub responses through the application.

**Check:** TypeScript compiles.

### 1.3 GitHub API adapter
**File:** `src/github/GitHubApi.ts`

Implement `GitHubFetcher` with the GitHub REST API. Handle authorization, unsuccessful responses, invalid repositories, missing commits, recursive trees, and GitHub's `truncated` flag.

**Check:** TypeScript compiles.

### 1.4 Integration tests
**Files:** `tests/github/list-commits.integration.test.ts`, `tests/github/get-tree.integration.test.ts`

Test commit listing and tree retrieval against a public repository. Include invalid SHAs and failed API responses. Avoid tests that assume the latest commit never changes.

**Check:** Run both integration tests.

### 1.5 Documentation tree
**File:** `src/github/documentationTree.ts`

Build a tree from Markdown files, preserving paths and folders. Include root-level files such as `README.md`; do not assume all docs live in `docs/`.

**Check:** Unit tests cover root files, nested folders, and no Markdown files.

### 1.6 Manual integration script
**File:** `scripts/test-github.ts`

Accept a repository owner and name, list commits, retrieve a selected tree, and print the documentation tree.

**Check:** Run it against a real repository.

### 1.7 Stub fetcher
**File:** `tests/github/StubGitHubFetcher.ts`

Implement `GitHubFetcher` with fixed data for `sophieelin/my-repo` at two commits.

**Check:** Unit tests run offline; integration tests run against GitHub.

**Phase complete when:** GitDocs can retrieve real commits and a documentation tree.

---

# Phase 2: Backend setup

**Status: Done**

### 2.1 MongoDB helpers
**Files:** `src/db.ts`, `tests/test-db.ts`

- Add database connection and cleanup.
- Configure `mongodb-memory-server` for tests.
- Add `test` or `test:memory` scripts only if missing.

**Check:** Run an insert-and-read test.

### 2.2 HTTP handler
**File:** `src/http.ts`

Use `createHttpHandler` from `@mit-sdg/sync-engine-http/handler` to create the handler from the assembled application and gateway. Do not add application endpoints yet.

**Check:** TypeScript compiles.

### 2.3 Server entry point
**File:** `src/main.ts`

Start the handler with `Bun.serve` on port 3000. Keep startup code separate from concepts.

**Check:** Start the backend and confirm it listens.

---

# Phase 3: Sign in

**Goal:** Users can register, sign in, reload, and remain signed in.

### 3.1 Specifications
**Files:** `design/concepts/Authenticating.md`, `design/concepts/Sessioning.md`

Copy the specifications from the sync-engine message-board example, including actions, queries, and refusals.

**Check:** `bun run check:design`

### 3.2 Authentication
**Files:** `src/concepts/Authenticating.ts`, `tests/concepts/Authenticating.test.ts`

Implement registration and sign-in with MongoDB, following the example's password handling.

**Check:** `bun run test:memory` covers registration, sign-in, wrong passwords, and duplicate usernames.

### 3.3 Sessions
**Files:** `src/concepts/Sessioning.ts`, `tests/concepts/Sessioning.test.ts`

Implement session creation, current-user lookup, and sign-out.

**Check:** `bun run test:memory` covers session creation, lookup, and sign-out.

### 3.4 Register concepts
**Files:** concept registries, `src/concepts.ts`, `src/assembly.ts`, `design/types.md`, `generated.config.ts`

- Register both concepts with a `"mongo"` floor.
- Make `assembleApplication` accept `{ db }`.
- Bind `Sessioning.Subject` to `Authenticating.Account`.

**Check:** `bun run generate && bun run check`

### 3.5 HTTP endpoints
Follow `plan-endpoints.md` E1–E2. Add shared HTTP setup and `/auth/register`, `/auth/sign-in`, `/auth/sign-out`, and `/auth/current`.

**Check:** Endpoint tests pass. With the server running, register and sign in using `curl`.

### 3.6 Frontend and sign-in screen
Follow `plan-vue.md` V1–V3. Add the Vue scaffold, API client, session handling, error handling, and sign-in screen.

**Check:** `bun run dev` shows the app and its routes. Verify the sign-in screen as described in `plan-vue.md`.

### Try it

1. Register user A and sign in.
2. Reload; A remains signed in.
3. Sign out; protected pages redirect to sign-in.
4. Try a wrong password; an error appears.
5. Register user B in a private window.

---

# Phase 4: Repositories and investigations

**Goal:** Users can browse a repository, inspect a commit, and submit an investigation.

## Repository behavior

- GitHub reads use plain routes in `src/http.ts`: `/api/github/commits` and `/api/github/tree`. They use `GitHubApi` and `buildDocumentationTree`; they do not store state.
- Recent repositories are stored in browser `localStorage`, keyed by username.
- A repository has a workspace at `/repositories/:owner/:name`.
- The sidebar links to Home, Investigations, Proposals, and Reviews for the current repository. Show links only for working pages.
- The top bar shows a breadcrumb and username. The GitDocs logo and username link back to `/repositories`. There is no repository dropdown.
- Investigations, proposals, and reviews are scoped to a repository.

### 4.1 GitHub routes
Follow `plan-endpoints.md` E3. Add `/api/github/commits` and `/api/github/tree`.

**Check:** Route tests use `StubGitHubFetcher`. Use `curl` to read PaperNet's commits and tree.

### 4.2 App layout
**Files:** `web/src/App.vue`, `web/src/components/AppSidebar.vue`, `web/src/components/AppTopBar.vue`

Replace `AppHeader.vue`. Match the layout in `ui-sketches`: repository sidebar, breadcrumb, cards, buttons, and folder tree.

**Check:** `bun run check`; inspect each existing page in the browser.

### 4.3 Repository Home and routes
**Files:** `web/src/pages/RepositoryHomePage.vue`, `web/src/router.ts`

Add the repository home page at `/repositories/:owner/:name`. Show the repository name, 30 recent commits, and the current documentation tree. Remove the separate `CommitsPage.vue` and `TreePage.vue`. Add repository-scoped routes for investigations, proposals, and reviews.

**Check:** PaperNet shows its commits and current documentation. Recent repositories persist after reload.

### 4.4 Return code and documentation trees
**Files:** `src/github/documentationTree.ts`, `src/github/routes.ts`

Make `/api/github/tree` return both trees: all repository files under `code` and Markdown files under `documentation`.

**Check:** Stub-based route tests cover both trees.

### 4.5 Commit details
**Files:** `src/github/types.ts`, `src/github/GitHubFetcher.ts`, `src/github/GitHubApi.ts`, `src/github/routes.ts`, `tests/github/StubGitHubFetcher.ts`, `web/src/pages/CommitPage.vue`

Add `getCommit(repository, sha)` using `GET /repos/{owner}/{repo}/commits/{sha}`. Return the message, author, date, and changed files, including status, previous path for renames, line counts, and patch. Add `/api/github/commit` and a commit page at `/repositories/:owner/:name/commits/:sha`.

The page shows the commit details, whether documentation changed, and each changed file's diff. Move the **Investigate** button from Home to this page. Link back to the commit from its investigation.

**Check:** Stub-based route tests and an integration test for a fixed commit pass. PaperNet commit `6d4a4c6` shows `csail_hack/README.md` as removed and identifies a documentation change.

### 4.6 InvestigatingChanges specification
**File:** `design/concepts/InvestigatingChanges.md`

An investigation has a repository, one commit, an investigator, a title, affected documentation, and evidence. The AI agent is out of scope.

Submitting requires:
- A title.
- At least one affected documentation file, each with a reason.
- At least one evidence item.
- No repeated affected paths.

Add queries for one investigation, its affected files and evidence, investigations in a repository, and investigations for a commit.

**Check:** `bun run check:design`

### 4.7 Implement and register InvestigatingChanges
**Files:** `src/concepts/InvestigatingChanges.ts`, its registry, `src/concepts.ts`, `src/http.ts`, `design/types.md`, `tests/concepts/InvestigatingChanges.test.ts`

Implement submission and queries. Submitting an investigation for the same commit more than once is allowed; each submission is separate.

**Check:** `bun run test:memory` covers successful submissions and every refusal. Then run `bun run generate && bun run check`.

### 4.8 Investigation endpoints
**Files:** `src/compositions/Investigations.ts`, `design/compositions/Investigations.md`

Add:
- `/investigations/submit`
- `/investigations/get`
- `/investigations/list`
- `/investigations/for-commit`

Require a signed-in user. The list is scoped to the repository and includes the investigator.

**Check:** Endpoint tests cover repository scoping and investigations submitted by other users.

### 4.9 Investigation screens
**Files:** `web/src/pages/NewInvestigationPage.vue`, `web/src/pages/InvestigationsPage.vue`, `web/src/pages/InvestigationPage.vue`, `web/src/pages/CommitPage.vue`

- **Investigate** opens `/repositories/:owner/:name/commits/:sha/investigations/new`.
- Nothing is saved until the user submits the form.
- The form includes a title, affected documentation with a reason for each file, and evidence.
- The submitted investigation is read-only.
- Show affected files highlighted in the investigation's code and documentation structures.
- List investigations on the commit page and repository's Investigations page.

**Check:** `bun run check` and the browser walkthrough below.

### Try it

1. Open `sophieelin/PaperNet`. Confirm its commits and documentation are shown.
2. Open `sophieelin/PaperNett`; show a repository-not-found error.
3. Open commit `6d4a4c6`. Confirm `csail_hack/README.md` is marked removed and the diff opens.
4. Click **Investigate** on a commit. The new-investigation form shows both structures. Leaving without submitting saves nothing.
5. Submit an investigation with a title, an affected file and reason, and evidence. The submitted page shows the details and highlights the file.
6. Try submitting without a title, affected file, or evidence; each attempt should show an error.
7. Submit a second investigation of the same commit as user B. Both investigations appear in the commit and repository lists.
8. Open a different repository. PaperNet's investigations should not appear there.

---

# Phase 5: Create and submit proposals

**Goal:** A user can edit a documentation tree, save a proposal, and submit it for review.

### 5.1 Update the specification
**File:** `design/concepts/RestructuringDocumentation.md`

Each proposal stores its author, repository, commit, and source investigation. Add queries for one proposal and a repository's proposals.

A proposal starts from a submitted investigation and requires a title. Only its author can edit, submit, or discard it. Add approval in Phase 6 and revision in Phase 7.

**Check:** `bun run check:design`

### 5.2 Implement and register the concept
**Files:** `src/concepts/RestructuringDocumentation.ts`, its registry, `src/concepts.ts`, `design/types.md`

Store the repository as owner and name strings.

**Check:** `bun run generate && bun run check`

### 5.3 Create and edit proposals
**Files:** `src/concepts/RestructuringDocumentation.ts`, `tests/concepts/RestructuringDocumentation.test.ts`

Implement create, modify, get, and discard.

**Check:** `bun run test:memory` covers creating, editing, retrieving, missing proposals, and refusals.

### 5.4 Submit proposals
Submitting moves a draft to `PENDING_APPROVAL` with an atomic conditional update. A submitted proposal cannot be edited.

**Check:** Tests cover successful submission, repeated submission, and editing after submission.

### 5.5 Proposal access
**Files:** `src/compositions/Proposals.ts`, `design/compositions/Proposals.md`

- Authors can read their own drafts.
- Other users receive `404 PROPOSAL_NOT_FOUND` for drafts.
- All signed-in users can read submitted proposals.
- The list shows submitted proposals in the repository and the signed-in user's own drafts.

**Check:** HTTP tests confirm these rules for users A and B.

### 5.6 Proposal endpoints
Follow `plan-endpoints.md` E4, excluding the review queue until Phase 6. Add `/proposals/create`, `/proposals/modify`, `/proposals/submit`, `/proposals/discard`, and `/proposals/get`.

Creating a proposal takes an investigation and reads the repository and commit from it.

**Check:** Endpoint tests pass. Test that another user cannot edit or submit the author's draft and that unauthenticated requests are rejected.

### 5.7 Proposal editor
**Files:** `web/src/tree/edit.ts`, `web/src/components/EditableTree.vue`, `web/src/pages/ProposalEditPage.vue`

Let users select a file or folder and rename, move, add a folder, or remove an empty folder. Start the editor from **Propose a restructuring** on an investigation page.

**Check:** Run `bun test` for `tests/web/treeEdit.test.ts` and follow `plan-vue.md` V5.

### 5.8 Proposal list and detail
**Files:** `web/src/pages/ProposalsPage.vue`, `web/src/pages/ProposalPage.vue`

The repository's Proposals page lists submitted proposals and the signed-in user's drafts, newest first. Show each author and mark the current user's proposals. A draft's author can continue editing it; proposal details are otherwise read-only.

**Check:** Follow `plan-vue.md` V6.

### Try it

1. Open an investigation of PaperNet commit `6d4a4c6` and select **Propose a restructuring**.
2. Give the proposal a title and move `csail_hack/lib/agents/README.md` to the root.
3. Save and reload; the changes remain.
4. Submit. The status becomes **Pending Approval** and editing is disabled.
5. As user B, open the proposal. It is visible but cannot be edited.

---

# Phase 6: Review and approve

**Goal:** A second user can approve a submitted proposal.

### 6.1 Add approval
**Files:** `src/concepts/RestructuringDocumentation.ts`, `tests/concepts/RestructuringDocumentation.test.ts`

Add `approve` and a query for pending proposals. Approval changes `PENDING_APPROVAL` to `APPROVED` in one conditional update.

**Check:** `bun run test:memory` covers invalid transitions and repository-scoped review queues.

### 6.2 Review specification
**File:** `design/concepts/ReviewingDocumentation.md`

Support opening a review, retrieving it, retrieving the review for a proposal, and approving it. There is one review per proposal. Request changes and reopening are added in Phase 7.

**Check:** `bun run check:design`

### 6.3 Implement and register ReviewingDocumentation
**Files:** `src/concepts/ReviewingDocumentation.ts`, its registry, `src/concepts.ts`, `design/types.md`

Bind the review's proposal type to `RestructuringDocumentation.Restructuring`.

**Check:** `bun run generate && bun run check`

### 6.4 Open and approve reviews
**Files:** `src/concepts/ReviewingDocumentation.ts`, `tests/concepts/ReviewingDocumentation.test.ts`

Use a unique index to prevent multiple reviews for one proposal. Only the assigned reviewer can approve, and approval can happen once.

**Check:** `bun run test:memory` covers opening, duplicate opens, and approval.

### 6.5 Reactions and permissions
**Files:** `src/compositions/Policy.ts`, `src/compositions/ReviewWorkflow.ts`, related design files

Add the policy rules and `ApprovalApprovesProposal` reaction. Authors cannot review their own proposals.

**Check:** Approving a review changes the proposal status to `APPROVED`.

### 6.6 Review endpoints
**Files:** `src/compositions/Reviews.ts`, `tests/http/reviews.test.ts`, `tests/compositions/ReviewWorkflow.test.ts`, `tests/http/access-control.test.ts`

Add `/proposals/under-review`, `/reviews/open`, `/reviews/get`, and `/reviews/approve`. Include review details and the decision in proposal responses. Proposal lists and detail pages must include approved proposals.

Test that:
- Authors cannot open or approve reviews of their own proposals.
- A user who did not open a review cannot approve it.
- A proposal moves to `APPROVED` after its reviewer approves it.

**Check:** Endpoint and access-control tests pass.

### 6.7 Review screens
Follow `plan-vue.md` V7. Add the review queue and proposal review page with current and proposed structures side by side. Add the **Approve** button.

**Check:** Follow the V7 browser checks.

### Try it

1. As user B, open PaperNet's Reviews. User A's proposal appears; A's own proposal does not.
2. Open the proposal and compare the current and proposed structures.
3. Approve it as B.
4. Switch to A's open Proposals page. Its status updates to **Approved** without a manual reload.

---

# Phase 7: Request changes and resubmit (Moved to Beta)

**Goal:** A reviewer can return a proposal to its author, who can edit and resubmit it.

### 7.1 Revise proposals
**Files:** `src/concepts/RestructuringDocumentation.ts`, `tests/concepts/RestructuringDocumentation.test.ts`

Add `revise` to move a proposal back to draft.

**Check:** `bun run test:memory` covers valid and refused revisions.

### 7.2 Request changes and reopen reviews
**Files:** `src/concepts/ReviewingDocumentation.ts`, `tests/concepts/ReviewingDocumentation.test.ts`

Add request-changes and reopen behavior.

**Check:** `bun run test:memory` covers both actions.

### 7.3 Reactions and endpoint
Follow `plan-reactions.md` R4.5–R4.6 and the remaining request-changes steps in `plan-endpoints.md` E5.

**Check:** The full request-changes cycle passes over HTTP.

### 7.4 Frontend
Follow the remaining steps in `plan-vue.md` V7. Add the **Request Changes** button and allow the author to edit and resubmit.

**Check:** Complete the V7 browser checks.

### Try it

1. As A, submit a proposal.
2. As B, request changes.
3. As A, edit and resubmit. The proposal returns to pending review.
4. As B, approve it.

---

# Phase 8: Final checks

### 8.1 Tests

Run:

```sh
bun run check:design
bun run generate && bun run check
bun test
bun run test:memory
```

Use existing script names where possible. Add a missing script in a separate change.

Confirm that tests cover invalid status changes, duplicate records, unauthenticated requests, unauthorized actions, reviewer permissions, and competing updates.

### 8.2 Full walkthrough

Follow `plan-vue.md` V8.1. Start from a clean database with `bun run db:reset` and complete the workflow in two browser sessions.

---

# Out of scope

- Review comments and suggestions.
- Applying an approved proposal or opening a GitHub pull request.
- The investigation agent, evidence generation, Copilot, and automatic identification of affected documentation.
- Private repositories and GitHub sign-in.
