# GitDocs: Design Document

## 1. Overview

GitDocs is a workspace for developers to investigate code changes and propose corresponding documentation updates. It addresses the gap between code and documentation: when a codebase changes, developers may not know which documents need updating or how to reorganize them. GitDocs provides a structured workflow for documenting these decisions and reviewing proposed changes with teammates.

The core design principle is that **AI can assist with investigation, but developers remain responsible for documentation decisions.**

**Key versions referenced below**

| What | Commit |
|---|---|
| Initial concept specifications (P1) | [`docs/concept-specifications.md` @ 311c7b2](https://github.com/sophieelin/GitDocs/blob/311c7b238e311450f7134522a0dd728fc1f423d3/docs/concept-specifications.md) |
| Initial UI sketches (P1) | [`docs/ui-sketches.md` @ cecf498](https://github.com/sophieelin/GitDocs/blob/cecf49866c7aa81e7fe4980d115bd97f081c592a/docs/ui-sketches.md) |
| Implementation plan prompts | [`P1/p1-docs/drafts/` @ 2dd2151](https://github.com/sophieelin/GitDocs/tree/2dd2151/P1/p1-docs/drafts) |
| Restructuring folded into a reaction | [`P1/code/design/` @ 6ee8996](https://github.com/sophieelin/GitDocs/tree/6ee89962fd7dac758b65ac14df0926faabdf22d3/P1/code/design) |
| Edit suggestions replace comments | [ccb2fb2](https://github.com/sophieelin/GitDocs/commit/ccb2fb2f319c161d1e33080383f17b5ab1a51cf8) |
| Reviewer notifications | [76d0c3a](https://github.com/sophieelin/GitDocs/commit/76d0c3afb425aa85362f95653311aec9d0b45af5) |
| Final concept specifications (GitHub sign-in) | [`P1/code/design/concepts/` @ 0840d29](https://github.com/sophieelin/GitDocs/tree/0840d297532122dd82c34c3eec7b8ed274b637e3/P1/code/design/concepts) |
| Visual design study (P3) | [`P1/p1-docs/design-study.pdf` @ f9c9ea1](https://github.com/sophieelin/GitDocs/blob/f9c9ea1c96f6ffa0e2c8bd8d492c48a4c38b8d85/P1/p1-docs/design-study.pdf) |
| Public home page | [`HomePage.vue` @ 97c88c2](https://github.com/sophieelin/GitDocs/blob/97c88c216fb554ae6da31df92345e760b6b08169/P1/code/web/src/pages/HomePage.vue) |

## 2. Final Design

The [initial concept design](https://github.com/sophieelin/GitDocs/blob/311c7b238e311450f7134522a0dd728fc1f423d3/docs/concept-specifications.md) had three concepts: Investigating Changes, Restructuring Documentation, and Reviewing Documentation. In the [final design](https://github.com/sophieelin/GitDocs/tree/0840d297532122dd82c34c3eec7b8ed274b637e3/P1/code/design/concepts), restructuring is no longer its own concept:

- **Investigating Changes:** Holds the whole proposal for a commit: highlighted passages with comments, suggested text edits, planned structure changes (rename, move, add files and folders), and the rationale.
- **Reviewing Documentation:** Lets a named teammate inspect a proposal and approve it.
- **Restructuring (now a reaction):** When a review is approved, a [reaction](https://github.com/sophieelin/GitDocs/blob/6ee89962fd7dac758b65ac14df0926faabdf22d3/P1/code/design/compositions/ReviewWorkflow.md) approves the proposal, which then produces a patch and Git commands.
- **Supporting concepts:** Authenticating, Sessioning, and RepositoryAccess. Only users with push access to the repository can propose or approve changes.

In P1, the three concepts formed a chain in which an investigation fed a restructuring, which was then reviewed. In the final design, the author builds the whole proposal inside Investigating Changes and submits it to Reviewing Documentation. When the reviewer approves, a reaction marks the proposal approved, so restructuring is now a step in the workflow rather than a separate concept.

The main workflow is:

1. Sign in with GitHub and open a public repository.
2. Inspect its commits, code changes, and documentation.
3. Create a proposal containing the rationale, proposed documentation structure, and suggested text edits.
4. Submit the proposal to a named teammate for review.
5. The reviewer approves the proposal.
6. After approval, the author applies the changes using the generated Git patch and records the commit.

Proposals move through four states: **Draft → Submitted → Approved → Applied**. Drafts remain editable, while submitted proposals become read-only during review.

## 3. Changes from P1: Initial Concept

The initial concept envisioned a broader documentation evolution platform for enterprise codebases, including AI-assisted investigation, evidence gathering, and automated GitHub pull request creation. The final design narrows this vision to a manageable MVP.

- **Merged investigations and proposals:** Users couldn't tell an investigation apart from a proposal, so the two became one. The interface now shows only *Proposals* ([6ee8996](https://github.com/sophieelin/GitDocs/commit/6ee89962fd7dac758b65ac14df0926faabdf22d3)).
- **Evidence became highlights:** Abstract "evidence" records were replaced by highlighting the exact passages that no longer hold, each with a comment.
- **Simplified states:** The planned "Changes Requested" state and the `revise` action were dropped. Submitted proposals are read-only, and approval is the review's only decision.
- **Reduced automation:** The initial concept included an AI agent that could identify commits requiring documentation changes, gather evidence, and help generate proposals. The MVP focuses on manually opening repositories and creating proposals. Advanced agent investigation and automatic detection of affected documentation are deferred.
- **Simplified GitHub integration:** The MVP supports public repositories only. Sign-in is GitHub OAuth only ([0840d29](https://github.com/sophieelin/GitDocs/commit/0840d297532122dd82c34c3eec7b8ed274b637e3)). I chose this over app passwords plus GitHub linking because the app can't work without GitHub authorization anyway.
- **Changed proposal application:** Instead of automatically opening a GitHub pull request after approval, GitDocs generates a patch and Git commands that the developer can run manually ([64f6c96](https://github.com/sophieelin/GitDocs/commit/64f6c96)). This keeps the workflow useful without requiring automated repository write access.
- **Consolidated related changes:** A single proposal can contain multiple structural changes and text-edit suggestions. This keeps related documentation updates together for review.
- **Preserved human control:** Agent recommendations remain separate from the proposal itself. Developers choose which changes to include, and reviewers make the approval decision.

## 4. Changes from P3: Visual Design

The [design study](https://github.com/sophieelin/GitDocs/blob/f9c9ea1c96f6ffa0e2c8bd8d492c48a4c38b8d85/P1/p1-docs/design-study.pdf) aimed for a minimalist look: mostly black and white with small pops of muted color. The interface evolved from the [sketches'](https://github.com/sophieelin/GitDocs/blob/cecf49866c7aa81e7fe4980d115bd97f081c592a/docs/ui-sketches.md) Documentation Map and Evolution Proposals into a more workflow-oriented workspace.

- **Repository-centered navigation:** The final sidebar shows the repository's Home, Proposals, and Reviews. Investigations no longer have their own section, since they merged into proposals.
- **More contextual investigation:** Repository pages show commits and current documentation. Proposal pages show the documentation tree and the Markdown file side by side in an IDE-style editor ([bb523aa](https://github.com/sophieelin/GitDocs/commit/bb523aa)). Users type to suggest text or select text to comment.
- **More actionable review:** General comments were replaced with explicit edit suggestions that show the original text struck through, the proposed replacement, and a reason ([ccb2fb2](https://github.com/sophieelin/GitDocs/commit/ccb2fb2f319c161d1e33080383f17b5ab1a51cf8)). Reviewers can understand the intended change without having to interpret a vague comment.
- **Clearer feedback and status:** Reviewers receive Home-page notifications and a Reviews queue when proposals need attention ([76d0c3a](https://github.com/sophieelin/GitDocs/commit/76d0c3afb425aa85362f95653311aec9d0b45af5)). Status badges show where each proposal stands.
- **Muted palette and typography:** The first build ([b296e82](https://github.com/sophieelin/GitDocs/commit/b296e82)) used a lavender sidebar. It now uses warm neutrals from the study's palette, saving color for status badges and diffs. Page titles use a serif, and code, trees, and commands share one monospace font.
- **Public home page:** Signed-out visitors see a plain introduction with a real example of the tree before and after plus the Git commands ([97c88c2](https://github.com/sophieelin/GitDocs/commit/97c88c216fb554ae6da31df92345e760b6b08169)). The other pages now share its theme.
- **Stronger interaction validation:** The final design rejects invalid document names, missing rationales, missing reviewers, and self-review. Saved changes persist after reloading, and submitted proposals cannot be edited during review.

## 5. Final Scope and Rationale

The final MVP prioritizes a complete, testable workflow over a larger set of partially implemented features. End-to-end testing ([f9c9ea1](https://github.com/sophieelin/GitDocs/commit/f9c9ea1c96f6ffa0e2c8bd8d492c48a4c38b8d85)) verified sign-in, repository navigation, proposal creation and editing, submission, review, approval, and patch application. It also checked invalid inputs, permissions, and persistence.

Features deferred to a later version include automated investigation, agent follow-up questions, highlighted code, new documents for missing documentation, multi-commit investigations, private repositories, and automatic pull request creation.

These decisions keep GitDocs focused on its central purpose: helping developers understand how code changes affect documentation and coordinate well-reasoned updates through an explicit review process.
