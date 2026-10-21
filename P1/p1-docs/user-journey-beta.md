# User Journey: Propose, Review, and Apply a Documentation Change

A developer refactors a codebase and realizes that the documentation no longer matches how the system is organized or what it does. They sign in to GitDocs with their GitHub account, open a repository they can push to, and select the commit that made the change. They start a proposal from that commit: they reorganize the documentation structure, suggest edits directly in the affected files, explain each edit, and request a review from a teammate. The teammate is notified, reviews the proposed structure and suggested edits, and approves them. The author then downloads a patch, applies it to the repository, pushes it, and records the commit in GitDocs. GitDocs keeps documentation aligned with a changing codebase by turning a refactor into a reviewable proposal that ends in a real change on GitHub.

## User Journey Steps

1. **Sign in with GitHub:** The developer signs in with their GitHub account. GitDocs uses that account as their identity, so each GitHub account is one GitDocs account.
2. **Open a repository:** The developer enters a public GitHub repository, such as `owner/name`. GitDocs checks with GitHub whether they have push access to it; without push access they can browse, but cannot start, edit, or approve proposals.
3. **Select a code change:** The developer opens a commit associated with a refactor and sees its message, its changed files and their diffs, and whether it already touched the documentation.
4. **Start a proposal:** The developer starts a proposal from the commit with a title. GitDocs shows the documentation as it was at that commit.
5. **Restructure the documentation:** The developer moves, renames, creates, and removes documentation files and folders.
6. **Suggest edits in the files:** The developer types directly into a documentation file, as in an editor. Each edit appears inline, with the removed text struck through and the new text in brackets, like suggestions in Google Docs. Every suggestion needs a short "why" before it is saved. The developer can also highlight passages that need attention.
7. **Request a review:** The developer writes a rationale for the whole proposal, names a reviewer who has a GitDocs account, and submits the proposal. Its status changes to *Pending Approval*.
8. **Get notified:** The reviewer sees a notice on the repository's home page that the author requested their review, and finds the proposal in their review queue.
9. **Review the proposal:** The reviewer compares the current and proposed structures and reads each suggested edit with its reason.
10. **Approve the proposal:** The reviewer, who also needs push access, approves it, and GitDocs marks it *Approved*.
11. **Apply the changes:** The author downloads a patch with every change (the moves and renames, the new files, and the suggested edits) and applies it to a clone of the repository with `git apply`, or copies the git commands for the structure alone. They commit and push.
12. **Record the result:** The author pastes the commit's SHA into GitDocs, which marks the proposal *Applied* and links to that commit.

## Beta Prototype Requirements

The prototype will demonstrate

- Signing in with GitHub (OAuth), one GitDocs account per GitHub account, and no passwords.
- A push-access check for each repository, so only people who can push can start, edit, review, and approve proposals.
- A commit view with the changed files and their diffs, from which a proposal is started.
- A structure editor for moving, renaming, creating, and removing documentation files and folders.
- An inline suggestion editor, where typed edits are shown in brackets with the old text struck through, and each suggestion is saved with a reason.
- Highlights on passages of a file.
- A submission action that names a reviewer and changes the proposal status to *Pending Approval*.
- A review notice and review queue for the named reviewer.
- A reviewer view with an approval action and a visible *Approved* status.
- A downloadable patch and git commands for an approved proposal.
- An *Applied* status that links to the commit that made the change.

## Scope: changes from the MVP

The Beta adds GitHub sign-in. Users sign in with GitHub instead of a username and password. GitDocs asks GitHub for no extra permissions: it learns who the user is, and it uses their token only to ask whether they can push to a repository. Tokens are stored encrypted. Repositories are still read with the GitHub API, using one server-wide token to raise the rate limit, so the Beta still works only with public repositories.

Approving a proposal still does not change the repository by itself. The author applies the approved changes with the patch or the git commands and pushes them, then records the commit in GitDocs. Opening a pull request automatically after approval, which needs GitDocs to write to the repository, is left for a later version.
