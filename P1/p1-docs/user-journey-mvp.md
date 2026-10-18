f# User Journey: Propose and Approve a Documentation Restructuring

A developer refactors a codebase and realizes that the existing documentation no longer accurately represents how the system is organized. They open GitTrace, connect a GitHub repository, and select the relevant commit. They create a proposal to reorganize the documentation, provide a rationale, and submit it for approval. Another developer reviews the proposed structure and approves it.

## User Journey Steps

1. **Connect a repository:** The developer signs in and enters a public GitHub repository, such as `owner/name`.
2. **Select a code change:** The developer chooses a commit associated with a refactor.
3. **Inspect the documentation:** GitTrace displays the repository's existing documentation structure.
4. **Create a proposal:** The developer reorganizes the documentation structure and explains the proposed changes.
5. **Request approval:** The developer submits the proposal for review.
6. **Review the proposal:** A second developer opens the proposal and compares the current and proposed structures.
7. **Approve the proposal:** The reviewer approves the restructuring, and GitTrace marks it as approved.

## Minimum Prototype Requirements

The prototype will demonstrate

- A repository selection screen where the developer enters a public GitHub repository.
- A view of the current documentation structure.
- A way to create and save a proposed structure.
- A submission action that changes the proposal status to *Pending Approval*.
- A reviewer view with an approval action.
- A visible Approved status after the reviewer approves.

## Scope: public repositories only

The MVP works only with public GitHub repositories. Users never give GitTrace a GitHub token or sign in with GitHub; GitTrace reads public repositories with the GitHub API, optionally using one server-wide token to raise the rate limit. Private repositories, and signing in with GitHub, are left for a later version.

GitTrace is read-only on GitHub in the MVP. Proposals, reviews, and approvals are saved only in GitTrace, and approving a proposal does not change the repository. Writing approved changes back to GitHub as a pull request needs GitHub sign-in (OAuth) and is planned for the Beta.


## Elevator Pitch

GitTrace helps developers keep documentation aligned with a changing codebase by letting them propose structural changes and obtain peer approval through a clear, reviewable workflow.