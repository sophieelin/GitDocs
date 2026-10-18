# GitTrace Vue Frontend Plan

## Goal

Build a Vue 3 frontend that uses the backend endpoints in `plan-endpoints.md` to cover the MVP journey in `user-journey-mvp.md`:

1. Sign in.
2. Enter a public GitHub repository.
3. Choose a commit and view its documentation tree.
4. Build a proposed structure, explain it, and save it.
5. Submit it for approval (status: *Pending Approval*).
6. As a second developer, compare the current and proposed structures.
7. Approve the proposal, or request changes, and see the *Approved* status.

**Order:** `plan.md` decides when each step happens. The screens are built in thin slices, right after the endpoints they use: V1–V3 in Phase 3, V4 in Phase 4, V5–V6 in Phase 5, and V7 in Phases 6 and 7. Backend step numbers in this file are from an older version of the plan.

## Working rules

- One screen or one shared piece per diff.
- Use the typed client generated from the backend (`generated/wire.ts`). Never write request or response types by hand.
- Keep tree editing in plain TypeScript functions, separate from components, so it can be unit tested.
- Show every `{ error }` response to the user as a readable message.
- Match the UI sketches for the screens in scope: 3 (restructuring proposal), 4 (review), and 5 (revised proposal).

## Stack decisions

- **Vue 3 + Vite + TypeScript**, in `P1/code/web/`. This replaces the "plain HTML, CSS, and TypeScript served by Bun" frontend described in `P1/code/AGENTS.md`. Update that file and the `dev:frontend` script in the same diff as V1.1.
- **vue-router** for screens. Considered a single page that switches between panels, like the message-board example, but the journey has six screens and links between users (a review link) need URLs.
- **Composables instead of Pinia.** The only shared state is the session and the current user. Add Pinia only if that grows.
- **Vite dev proxy:** `/api` goes to `http://localhost:3000`, so the browser has one origin and no CORS setup is needed.
- **Vitest** for the tree-editing functions only. The screens are checked by hand with two browser profiles.

# Phase V1: Scaffold

## V1.1 Vue app skeleton

**Diff:** `web/index.html`, `web/vite.config.ts`, `web/src/main.ts`, `web/src/App.vue`, `package.json`, `AGENTS.md`

- Add `vue`, `vue-router`, `vite`, `@vitejs/plugin-vue`, and `vue-tsc`.
- Point `dev:frontend` at Vite, and add the `/api` proxy.
- Add `vue-tsc --noEmit` to `check`, or as a separate `check:web` script.
- Delete the old `web/server.ts` reference.

**Verify:** `bun run dev` serves a page that says "GitTrace," and `bun run check` passes.

## V1.2 Router and layout

**Diff:** `web/src/router.ts`, `web/src/components/AppHeader.vue`

Routes: `/sign-in`, `/repositories`, `/repositories/:repository/commits`, `/repositories/:repository/commits/:sha`, `/proposals`, `/proposals/:proposal`, `/proposals/:proposal/edit`, `/reviews`, `/reviews/:review`.

**Verify:** Each route renders a placeholder.

# Phase V2: API client and session

## V2.1 Typed API client

**Diff:** `web/src/api.ts`

Create the client with `createHttpClient<...>` from `@mit-sdg/sync-engine-http/client`, typed by `generated/wire.ts`, with `baseUrl: "/api"`. This is the same approach as the message-board example's `src/client.ts`.

**Verify:** `vue-tsc` passes, and a call to `/auth/current` without a session returns an error object.

## V2.2 Session composable and route guard

**Diff:** `web/src/session.ts`, `web/src/router.ts`

- `useSession()` holds the session token and username, and adds `session` to every request.
- Save the token in `localStorage`, inside `try`/`catch`, so a reload keeps the user signed in. On startup, check it with `/auth/current`.
- A route guard sends signed-out users to `/sign-in`.
- Sign-out calls `/auth/sign-out` and clears the token.

**Verify:** Sign in, reload the page, and stay signed in. Sign out, and protected routes redirect.

## V2.3 Error messages

**Diff:** `web/src/errors.ts`, `web/src/components/ErrorBanner.vue`

The API sends only an error category (`INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, or `INTERNAL_ERROR`), never the concept's own code (see `plan-endpoints.md`, working rules).

- Give each call site its own sentence per category, because the same category means different things on different screens. For example, `CONFLICT` on register is "That username is already taken", and on submit it is "This proposal was already submitted. Ask for changes to edit it again."
- Where one category covers several cases, check the input before sending it. On register, show "A username must be 3 to 32 letters, numbers, underscores, or hyphens" and "A password must be 8 to 128 characters" before calling the API, so a 400 is rare.
- `UNAUTHORIZED` from any call other than sign-in means the session has ended: clear it and go to sign-in.
- `INTERNAL_ERROR` and anything unexpected show a general "Something went wrong. Try again." with the status.

**Verify:** Sign in with a wrong password and see "Wrong username or password." Register a username that is already taken and see "That username is already taken."

# Phase V3: Sign-in

## V3.1 Sign-in and register screen

**Diff:** `web/src/pages/SignInPage.vue`

One form with "Sign in" and "Create account" buttons, calling `/auth/sign-in` or `/auth/register`.

**Verify:** Register two accounts, and sign in with each.

# Phase V4: Repository and commit

## V4.1 Repository screen

**Diff:** `web/src/pages/RepositoriesPage.vue`

- An input for `owner/name`, with a note that only public repositories work.
- Lists connected repositories from `/repositories/list`, with a disconnect button.

**Verify:** Connect a real public repository. A misspelled name shows "Repository not found. Only public repositories work." (the API's `NOT_FOUND`).

## V4.2 Commit selection

**Diff:** `web/src/pages/CommitsPage.vue`

Lists commits (short SHA and first line of the message) from `/repositories/commits`. Choosing one opens the tree screen.

**Verify:** The list matches the repository's recent commits on GitHub.

## V4.3 Documentation tree view

**Diff:** `web/src/components/TreeView.vue`, `web/src/pages/TreePage.vue`

- A recursive component that shows folders and Markdown files, read-only.
- Shows a warning when GitHub returned `truncated`.
- A "Propose a restructuring" button calls `/proposals/create` and opens the editor.

**Verify:** Root-level files such as `README.md` and nested folders both appear.

# Phase V5: Proposal editor

## V5.1 Tree-editing functions

**Diff:** `web/src/tree/edit.ts`, `web/src/tree/edit.test.ts`

Pure functions over the documentation tree: rename, move to a folder, create a folder, and remove an empty folder. Each returns a new tree and refuses invalid edits (such as a name collision or moving a folder into itself).

**Verify:** Vitest tests for each function and each refusal.

## V5.2 Editor screen

**Diff:** `web/src/pages/ProposalEditPage.vue`, `web/src/components/EditableTree.vue`

- The current structure (read-only) next to the proposed structure (editable), as in UI sketch 3.
- A rationale text area.
- "Save" calls `/proposals/modify`. "Submit for review" saves, then calls `/proposals/submit`.
- "Discard" calls `/proposals/discard` after a confirmation.
- The editor opens only for the author of a draft. Otherwise it redirects to the proposal page.

**Verify:** Make edits, save, reload, and see the same edits. Submit, and the status becomes *Pending Approval*.

# Phase V6: Proposals and status

## V6.1 My proposals

**Diff:** `web/src/pages/ProposalsPage.vue`, `web/src/components/StatusBadge.vue`

Lists `/proposals/mine` with a status badge: *Draft*, *Pending Approval*, *Changes Requested*, or *Approved*.

**Verify:** All four statuses appear correctly during the full journey.

## V6.2 Proposal page

**Diff:** `web/src/pages/ProposalPage.vue`

Read-only detail from `/proposals/get`: both structures, rationale, status, and reviewer. After a change request, it shows "Revise," which opens the editor (UI sketch 5).

**Verify:** Open a proposal as its author and as another user.

# Phase V7: Review

## V7.1 Review queue

**Diff:** `web/src/pages/ReviewsPage.vue`

Lists `/proposals/under-review`. Opening one calls `/reviews/open` (or reuses the existing review) and goes to the review page.

**Verify:** The second account sees the first account's proposal, and the first account does not see its own.

## V7.2 Structure comparison

**Diff:** `web/src/tree/diff.ts`, `web/src/tree/diff.test.ts`, `web/src/components/TreeDiff.vue`

Compare the current and proposed trees by file path and mark each file as unchanged, moved, renamed, added, or removed. Show both trees side by side with these marks, as in UI sketch 4.

**Verify:** Vitest tests for each kind of change. Then check the comparison by eye on a real proposal.

## V7.3 Review page

**Diff:** `web/src/pages/ReviewPage.vue`

The comparison, the rationale, and "Approve" and "Request changes" buttons calling `/reviews/approve` and `/reviews/request-changes`. Show the new status from the response.

**Verify:** Approving shows *Approved*. Requesting changes shows *Changes Requested*, and the author can edit again.

# Phase V8: End-to-end walkthrough

## V8.1 Two-browser walkthrough

Run `bun run dev`. Use two browser profiles, one per account, and go through the whole MVP journey, including one request-changes cycle. Record any problems as new steps.

## V8.2 Final checks

- `bun run check` (including `vue-tsc`)
- `bun test` and the Vitest tests
- The walkthrough above

# Out of scope

- UI sketches 1 (agent detection), 2 (investigation and Copilot), and 6 (pull request).
- Comments and suggestions on reviews.
- Editing file contents. The MVP only restructures paths.
- Deploying the frontend container (the `up` script). Add it after the walkthrough passes.
