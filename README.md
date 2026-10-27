# GitDocs

## Overview

GitDocs helps teams keep repository documentation organized and up to date. It simplifies documentation maintenance by bringing file restructuring, content editing, and collaborative review into one place.

## How It Works

- **Select a starting point**  
Sign in with GitHub, open a repository, and choose a commit to work from.
- **Make proposed changes**  
Restructure the documentation by adding, moving, or renaming files, and edit their contents.
- **Review and approve**  
A teammate with push access reviews the proposed changes before they are applied.
- **Apply changes**  
GitDocs generates a patch and the Git commands needed to apply the approved changes, then records the resulting commit.

## Deliverables

### P2
- Website: [https://gitdocs.mit-sdg.dev](https://gitdocs.mit-sdg.dev)
- [Visual design study](P1/p1-docs/design-study.pdf)
- [Updated user journey](P1/p1-docs/user-journey-beta.md)
- [Demo video](https://youtu.be/m7VTPr7YKdk)
- [Design notebook](https://github.com/sophieelin/6.1040/blob/main/design-notebook)

### P1
- MVP code: [`P1/code`](P1/code)
- User journey: [`P1/p1-docs`](P1/p1-docs)
- [Demo video](https://youtu.be/BXuCtekfzwA)
- Design document: [`docs/`](docs)

### Project documentation
- [Problem framing and stakeholders](docs/problem-framing.md)
- [Application pitch](docs/application-pitch.md)
- [Concept specifications](docs/concept-specifications.md)
- [UI sketches](docs/ui-sketches.md)
- [User journey](docs/user-journey.md)

## Tech stack

GitDocs is written entirely in TypeScript.

| Area | Technology |
| --- | --- |
| **Frontend** | [Vue 3](https://vuejs.org) and Vue Router, built with [Vite](https://vite.dev). Suggested edits use a [CodeMirror](https://codemirror.net) Markdown editor. |
| **Backend** | A [Bun](https://bun.sh) server built on MIT SDG's sync engine, which organizes the app into concepts and the compositions that connect them. |
| **Database** | [MongoDB](https://www.mongodb.com), run locally in a [Podman](https://podman.io) container. |
| **GitHub integration** | GitHub OAuth for sign-in and the GitHub API for repositories, commits, and files. Users' GitHub tokens are encrypted before they are stored. |
| **Patches** | The [`diff`](https://github.com/kpdecker/jsdiff) library turns approved changes into a patch that Git can apply. |
| **Testing** | Bun's test runner, with an in-memory MongoDB so tests run without a container. |

## Running locally

### Prerequisites

- [Bun](https://bun.sh) (tested with 1.4)
- [Podman](https://podman.io) with Compose support. On macOS, `podman compose` also needs a Compose provider such as `docker-compose` (`brew install docker-compose`)
- A GitHub account, to create the OAuth App used for sign-in

### Setup

1. **Start Podman.** On macOS, Podman runs inside a virtual machine, which must be running before MongoDB can start:
   ```sh
   podman machine init    # first time only
   podman machine start
   ```
2. **Install dependencies:**
   ```sh
   cd P1/code
   bun install
   ```
3. **Create your `.env`:**
   ```sh
   cp .env.example .env
   ```
   `MONGODB_URL` already points at the local MongoDB, so leave it as it is.
4. **Generate a token secret** and paste it into `.env` as `TOKEN_SECRET`:
   ```sh
   openssl rand -base64 32
   ```
5. **Create a GitHub OAuth App** at [github.com/settings/developers](https://github.com/settings/developers) → *New OAuth App*:
   - Homepage URL: `http://127.0.0.1:5173`
   - Authorization callback URL: `http://127.0.0.1:5173/api/auth/github/callback`

   Copy the client ID and a new client secret into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
6. **Optional: add a GitHub token.** A [personal access token](https://github.com/settings/tokens) in `GITHUB_TOKEN` raises the API limit above 60 requests an hour.
7. **Start the app:**
   ```sh
   bun run dev    # starts MongoDB, the backend (port 3000), and the frontend (port 5173)
   ```
   Then open http://127.0.0.1:5173. Use `127.0.0.1`, not `localhost`, so that it matches the OAuth callback URL.
8. **Check that it works:** `bun run check` should pass, and `bun run test:memory` runs the tests without a container.

### Environment variables (`P1/code/.env`)

| Variable | Required | What it is for |
| --- | --- | --- |
| `MONGODB_URL` | yes | Connection string for the local MongoDB |
| `TOKEN_SECRET` | yes | Encrypts users' GitHub tokens before they are stored. Use at least 32 characters, e.g. `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | yes, for sign-in | From a [GitHub OAuth App](https://github.com/settings/developers) with callback URL `http://127.0.0.1:5173/api/auth/github/callback` |
| `GITHUB_CALLBACK_URL` | no | Set this only when the callback URL is not the server's own address, e.g. behind a proxy |
| `GITHUB_TOKEN` | no | Raises GitHub's API rate limit. Public repositories work without it, but only for 60 requests an hour |

### Useful scripts

Run these from `P1/code`:

| Command | What it does |
| --- | --- |
| `bun run dev` | Runs the backend and frontend in development mode |
| `bun run test` | Runs the tests against the local MongoDB (start it first with `bun run db:up`) |
| `bun run test:memory` | Runs the tests with a temporary in-memory MongoDB, so no container is needed |
| `bun run check` | Type-checks the backend, the frontend, and the design files |
| `bun run preview` | Builds the frontend and serves a production build on port 3000 |
| `bun run db:reset` | Deletes all local data |

Signing in needs the GitHub OAuth App values. Without them the app still starts, and the backend logs that sign-in is off.

One test, "without TOKEN_SECRET …", fails when `.env` sets `TOKEN_SECRET`, because Bun loads `.env` for tests too. To run it, blank the variable: `TOKEN_SECRET= bun run test:memory`.

## How the code is organized

The app follows concept design. Each concept is a separate unit of behavior, and compositions connect them.

```
P1/code/
├── design/          # Specs: concepts, compositions, and shared types
├── src/
│   ├── concepts/    # Authenticating, Sessioning, RepositoryAccess,
│   │                # InvestigatingChanges, ReviewingDocumentation
│   ├── compositions/# Policy, Proposals, Reviews, ReviewWorkflow, Sessions
│   ├── github/      # GitHub sign-in, API access, and patch generation
│   └── main.ts      # Server entry point
├── web/             # Vue frontend
└── tests/           # Concept, composition, HTTP, and GitHub tests
```
