# GitTrace Backend MVP: TypeScript, MongoDB, and GitHub API

## Goal

Build the GitTrace backend incrementally using TypeScript, MongoDB, the GitHub REST API, and sync-engine.

The MVP supports this workflow:

1. A developer registers and signs in.
2. They connect a GitHub repository.
3. They select a commit and view its documentation tree.
4. They create, edit, and submit a restructuring proposal.
5. A second developer reviews the proposal.
6. The reviewer approves it or requests changes.
7. The proposal's status reflects the decision.

The first priority is to get the backend working end to end. The frontend, investigation agent, and automatic pull request creation are out of scope for this round.

## Working rules

- Make one small, independently reviewable diff at a time.
- Give every diff a clear purpose and a specific verification command.
- Do not combine a new concept, its entire implementation, its endpoints, and its tests into one large change.
- Run the design checker after specification changes and the TypeScript checker after implementation changes.
- Add tests as each action is implemented.
- Use the real GitHub API from the beginning. Keep the API adapter separate from the concepts so it can be tested independently.
- Use MongoDB for persistent state and `mongodb-memory-server` for isolated tests.
- Follow the existing sync-engine examples for concept classes, registries, floors, compositions, and reactions.
- Do not implement features merely because they might be useful later.

# Phase 1: GitHub API integration

Start with the part of the product that retrieves real repository data. Keep it independent of MongoDB and sync-engine until the API behavior is understood.

## 1.1 Add GitHub configuration

**Diff:** `.env.example`

- Add an optional `GITHUB_TOKEN` environment variable.
- Keep actual credentials out of version control.
- Ensure the token is read only by backend code.

**Verify:** The application can start without a token when using a public repository.

## 1.2 Define the GitHub fetcher interface

**Diff:** `src/github/GitHubFetcher.ts`

Define the operations needed by GitTrace:

- List commits for a repository.
- Retrieve the file tree at a specific commit SHA.

Keep the interface independent of HTTP, MongoDB, and sync-engine.

**Verify:** TypeScript compiles.

## 1.3 Define the application-level types

**Diff:** `src/github/types.ts`

Define the minimal data structures for:

- Repository owner and name.
- Commit SHA and message.
- Tree entries and file paths.

Use application-level types rather than passing complete GitHub API responses throughout the backend.

**Verify:** TypeScript compiles.

## 1.4 Implement the GitHub REST API adapter

**Diff:** `src/github/GitHubApi.ts`

- Implement `GitHubFetcher`.
- Use GitHub's REST API to list commits and retrieve a commit's tree.
- Send authorization headers when a token is configured.
- Handle unsuccessful HTTP responses, invalid repository names, and missing commits.
- Handle recursive tree responses and GitHub's `truncated` indicator.

**Verify:** TypeScript compiles.

## 1.5 Test commit listing against GitHub

**Diff:** `tests/github/test-list-commits.ts`

- Use a known public repository.
- Confirm that real commit SHAs and messages are returned.
- Avoid assertions that depend on the latest commit remaining unchanged.

**Verify:** Run the integration test against GitHub.

## 1.6 Test retrieving a commit tree

**Diff:** `tests/github/test-get-tree.ts`

- Retrieve a tree for a known commit SHA.
- Confirm that file paths are returned.
- Test an invalid SHA and an unsuccessful API response.

**Verify:** Run the integration test.

## 1.7 Convert repository paths into a documentation tree

**Diff:** `src/github/documentationTree.ts`

- Filter for Markdown files.
- Preserve their paths and nested folder structure.
- Support root-level files such as `README.md`.
- Do not assume all documentation is stored under `docs/`.

**Verify:** Add unit tests for root files, nested folders, and an empty result.

## 1.8 Add a manual GitHub integration script

**Diff:** `scripts/test-github.ts`

Create a small script that:

1. Accepts a repository owner and name.
2. Lists its commits.
3. Retrieves a selected commit's tree.
4. Prints the resulting documentation tree.

**Verify:** Run it against a real repository.

## 1.9 Add a fake fetcher for deterministic tests

**Diff:** `tests/github/FakeGitHubFetcher.ts`

Implement the same interface with fixed test data. Use it for concept tests so that most tests do not require a network connection.

**Verify:** The unit tests work offline, and the real integration tests work separately.

**Phase completion:** GitTrace can retrieve real commits and a documentation tree for a selected commit.

# Phase 2: Shared backend scaffolding

## 2.1 Add the MongoDB connection helper

**Diff:** `src/db.ts`

- Implement database connection and cleanup.
- Keep connection management outside the concept classes.

**Verify:** Connect to the development database.

## 2.2 Add the database test helper

**Diff:** `tests/test-db.ts`

- Configure `mongodb-memory-server`.
- Add `test` and `test:memory` scripts if they do not already exist.
- Keep test database setup reusable.

**Verify:** Run a small insert-and-read test.

## 2.3 Add the HTTP handler

**Diff:** `src/http.ts`

Use `createHttpHandler` from `@mit-sdg/sync-engine-http/handler` to create the HTTP handler from an assembled application and gateway.

Do not add application endpoints yet.

**Verify:** TypeScript compiles.

## 2.4 Add application assembly

**Diff:** `src/assembly.ts`

- Assemble the application with the registered concepts and MongoDB floor.
- Inject the GitHub adapter where required.
- Avoid requiring a live MongoDB connection merely to assemble the application, if supported by the framework.

**Verify:** Application assembly succeeds.

## 2.5 Add the backend entry point

**Diff:** `src/main.ts`

- Start the handler using `Bun.serve`.
- Listen on port 3000.
- Keep server startup logic separate from concept implementations.

**Verify:** Start the backend and confirm it listens successfully.

# Phase 3: Authentication and sessions

Use the existing sync-engine message-board example as the reference.

## 3.1 Add the authentication specification

**Diff:** `design/concepts/Authenticating.md`

Copy the existing example's specification and retain its actions, queries, and refusal behavior.

**Verify:** `bun run check:design`

## 3.2 Add the session specification

**Diff:** `design/concepts/Sessioning.md`

Copy the session specification from the same example.

**Verify:** `bun run check:design`

## 3.3 Implement authentication in TypeScript

**Diff:** `src/concepts/Authenticating.ts`

- Implement the required actions using MongoDB.
- Preserve the specification's API.
- Follow the example's password-handling conventions.

**Verify:** Test account creation and authentication.

## 3.4 Register authentication

**Diff:** `src/concepts/Authenticating.registry.ts`

Register the concept with its specification, refusals, and floors.

**Verify:** `bun run generate && bun run check`

## 3.5 Implement sessions in TypeScript

**Diff:** `src/concepts/Sessioning.ts`

- Implement session creation and lookup.
- Implement sign-out according to the specification.
- Bind each session to an authenticated account.

**Verify:** Test session creation, current-user lookup, and sign-out.

## 3.6 Register sessions

**Diff:** `src/concepts/Sessioning.registry.ts`

Register the session concept and add it to the concept set.

**Verify:** `bun run generate && bun run check`

## 3.7 Add type instantiations

**Diff:** `design/types.md`

Instantiate `Authenticating` and `Sessioning`, with `Sessioning.Subject` bound to `Authenticating.Account`.

Register the file in `generated.config.ts`.

**Verify:** Run the design checker and generated checks.

## 3.8 Add session endpoints

**Diff:** `src/compositions/Sessions.ts`

Add:

- `/auth/register`
- `/auth/sign-in`
- `/auth/sign-out`

**Diff:** `design/compositions/Sessions.md`

Document the endpoints, reactions, and request/response contracts.

**Verify:** Run the checks, start the backend, and test each endpoint with `curl`.

# Phase 4: ConnectingRepositories concept

Wrap the GitHub adapter in a sync-engine concept. Keep API retrieval in the adapter and repository-connection state in MongoDB.

## 4.1 Write the concept specification

**Diff:** `design/concepts/ConnectingRepositories.md`

Define the required operations:

- Connect a user to a repository.
- Disconnect a repository.
- List a user's connected repositories.
- List commits for a repository.
- Retrieve the documentation tree at a selected commit.

Define refusal cases for unknown repositories and insufficient access.

**Verify:** `bun run check:design`

## 4.2 Add the TypeScript skeleton

**Diff:** `src/concepts/ConnectingRepositories.ts`

- Declare the class and action/query signatures.
- Inject the `GitHubFetcher`.
- Add one error subclass per refusal code.
- Leave the action bodies unimplemented temporarily.

**Verify:** `bun run check`

## 4.3 Register the concept

**Diff:** `src/concepts/ConnectingRepositories.registry.ts`

Register the concept and its required dependencies.

Add its type instantiation to `design/types.md` and include it in the concept set.

**Verify:** `bun run generate && bun run check`

## 4.4 Implement repository connections

**Diff:** `src/concepts/ConnectingRepositories.ts`

- Store connected repositories in MongoDB.
- Associate each connection with the authenticated user.
- Implement connect, disconnect, and list operations.

**Verify:** Test connecting, listing, and disconnecting a repository.

## 4.5 Implement commit listing

**Diff:** `src/concepts/ConnectingRepositories.ts`

Implement the operation that retrieves commits through the injected GitHub fetcher.

**Verify:** Test a successful result and an inaccessible repository.

## 4.6 Implement documentation tree retrieval

**Diff:** `src/concepts/ConnectingRepositories.ts`

Implement retrieval of the documentation tree for a specific commit SHA.

**Verify:** Confirm that the returned tree corresponds to the selected commit.

## 4.7 Add repository endpoints

**Diff:** `src/compositions/Repositories.ts`

Add:

- `/repositories/connect`
- `/repositories/list`
- `/repositories/commits`
- `/repositories/tree`

**Diff:** `design/compositions/Repositories.md`

Document the endpoints and their reactions. Require an authenticated session for every endpoint.

**Verify:** Test each endpoint with `curl` using a real public repository.

# Phase 5: RestructuringDocumentation concept

This concept owns the proposal lifecycle. Keep it focused on creating, editing, submitting, revising, and retrieving proposals.

## 5.1 Update the specification

**Diff:** `design/concepts/RestructuringDocumentation.md`

- Add a repository reference to proposals.
- Add a commit reference so each proposal records its source snapshot.
- Add a query for retrieving a proposal.
- Add a query for listing proposals awaiting review.
- Define the allowed status transitions and refusal cases.

**Verify:** `bun run check:design`

## 5.2 Add the TypeScript skeleton

**Diff:** `src/concepts/RestructuringDocumentation.ts`

- Declare the class.
- Add action and query signatures.
- Add the required error subclasses.
- Leave method bodies as `throw new Error("TODO")`.

**Verify:** `bun run check`

## 5.3 Register the proposal concept

**Diff:** `src/concepts/RestructuringDocumentation.registry.ts`

Register the concept and add its instantiation to `design/types.md`.

Bind its repository type to `ConnectingRepositories.Repository`.

**Verify:** `bun run generate && bun run check`

## 5.4 Implement proposal creation

**Diff:** `src/concepts/RestructuringDocumentation.ts`

Create a proposal in MongoDB with its owner, repository, commit, initial structure, and initial status.

**Verify:** Test creation and retrieval.

## 5.5 Implement draft modification

**Diff:** `src/concepts/RestructuringDocumentation.ts`

Implement editing of a draft proposal. Refuse modifications that are not permitted in its current status.

**Verify:** Test valid edits and edits after submission.

## 5.6 Implement proposal retrieval

**Diff:** `src/concepts/RestructuringDocumentation.ts`

Implement retrieval of one proposal and listing proposals awaiting review.

**Verify:** Test missing proposals and the review queue.

## 5.7 Implement submission

**Diff:** `src/concepts/RestructuringDocumentation.ts`

- Implement the transition from draft to pending approval.
- Use an atomic conditional update.
- Refuse invalid or repeated transitions.

**Verify:** Test successful submission and repeated submission.

## 5.8 Implement revision and discard

**Diff:** `src/concepts/RestructuringDocumentation.ts`

Implement the revision path after a reviewer requests changes. Implement discard only if required by the specification.

**Verify:** Test revision, discard, and invalid transitions.

## 5.9 Add proposal endpoints

**Diff:** `src/compositions/Proposals.ts`

Add:

- `/proposals/create`
- `/proposals/modify`
- `/proposals/submit`
- `/proposals/get`
- `/proposals/under-review`

**Diff:** `design/compositions/Proposals.md`

Document endpoint contracts and reactions. Derive the current user from `Sessioning.current({ session })`.

**Verify:** Test each endpoint over HTTP.

# Phase 6: ReviewingDocumentation concept

Implement only the review operations needed for the MVP. Defer comments and suggestions until the core workflow works.

## 6.1 Update the review specification

**Diff:** `design/concepts/ReviewingDocumentation.md`

Define:

- Creating a review for a submitted proposal.
- Retrieving a review for a proposal.
- Retrieving one review.
- Approving a proposal.
- Requesting changes.

Specify whether one review is reused when a proposal is resubmitted.

**Verify:** `bun run check:design`

## 6.2 Add the TypeScript skeleton

**Diff:** `src/concepts/ReviewingDocumentation.ts`

Add the class, method signatures, and refusal classes. Leave method bodies unimplemented.

**Verify:** `bun run check`

## 6.3 Register the review concept

**Diff:** `src/concepts/ReviewingDocumentation.registry.ts`

Register the concept and instantiate it in `design/types.md`.

Bind the proposal reference to `RestructuringDocumentation.Restructuring`.

**Verify:** `bun run generate && bun run check`

## 6.4 Implement review creation

**Diff:** `src/concepts/ReviewingDocumentation.ts`

- Create a review for a submitted proposal.
- Add a unique index if the specification requires one review per proposal.
- Translate duplicate-key errors into the declared refusal.

**Verify:** Test review creation and duplicate creation.

## 6.5 Implement approval

**Diff:** `src/concepts/ReviewingDocumentation.ts`

- Implement approval.
- Check the review and proposal states.
- Use the declared reaction to transition the proposal to approved.

Keep the proposal's status transition authoritative in `RestructuringDocumentation`.

**Verify:** Test successful approval and invalid approval attempts.

## 6.6 Implement request changes and resubmission

**Diff:** `src/concepts/ReviewingDocumentation.ts`

- Implement request changes.
- Connect the decision to the proposal's revision workflow.
- Reuse or reopen the existing review according to the specification.

**Verify:** Test the complete revision and resubmission cycle.

## 6.7 Add review endpoints

**Diff:** `src/compositions/Reviews.ts`

Add:

- `/reviews/open`
- `/reviews/approve`
- `/reviews/request-changes`
- `/reviews/get`

**Diff:** `design/compositions/Reviews.md`

Document the endpoint contracts and reactions. Require authenticated sessions and enforce reviewer authorization.

**Verify:** Test the endpoints with two separate accounts.

# Phase 7: End-to-end verification

## 7.1 Verify individual concepts

Run the relevant MongoDB tests for authentication, sessions, repository connections, proposals, and reviews.

Check the following:

- Invalid state transitions are refused.
- Duplicate records are rejected where required.
- Users cannot act as another user by supplying an arbitrary identity.
- Unauthenticated requests are rejected.
- Reviewer authorization is enforced.
- Concurrent status updates cannot both succeed when only one transition is valid.

## 7.2 Verify the complete HTTP workflow

Run the backend and execute the following flow with `curl`:

1. Register the first developer.
2. Sign in and retain the session.
3. Connect a real GitHub repository.
4. List commits.
5. Retrieve the documentation tree at a selected commit.
6. Create and modify a proposal.
7. Submit it for review.
8. Sign in as a second developer.
9. Retrieve the proposal and open its review.
10. Approve the proposal.
11. Retrieve the proposal again and verify that its status is `APPROVED`.

Run the request-changes workflow separately.

## 7.3 Final checks

- `bun run check:design`
- `bun run generate && bun run check`
- `bun test`
- `bun run test:memory`
- Manual HTTP verification of the complete workflow

Use the project's existing script names where possible. If a required script is missing, add it in a separate diff.