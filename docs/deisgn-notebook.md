# Design Notebook

## October 5

I changed my project idea to GitDocs, a Documentation Evolution Workspace. The goal is to help developers keep documentation organized as their codebase changes.

The bad situations I’m trying to address are when a new developer needs to onboard and understand an unfamiliar codebase but there isn’t much history explaining why certain architectural decisions were made, or when a developer is making a structural change and isn’t sure how that change should be reflected in the existing documentation. In both cases, the current code and documentation may show what the system looks like, but not necessarily the reasoning behind it.

The idea is to use it with enterprise codebases in Git repositories, where there are many moving parts and multiple teams collaborating. Code is typically organized around modules and dependencies, while documentation is organized around concepts and workflows. Because of this mismatch, when a component is split or moved, the code changes alone don’t necessarily tell you how the documentation should change. Today, these decisions often happen informally through PR comments or side conversations, and the reasoning behind them can easily get lost.

## October 6

I started working out the main user journey. The workflow would start either when an AI agent identifies a commit that may require documentation changes or when a developer opens a proposal themselves. The proposal would bring together the relevant code changes and documentation, and let the developer describe the current and proposed documentation structure and rationale. A teammate could then review the proposal, leave comments, and approve it or request changes. Once approved, the documentation change would be submitted as a normal pull request, with the reasoning preserved alongside it.

I wanted the proposal to remain editable throughout the review process. If a reviewer requests changes, the developer should be able to update the existing proposal and submit it again. 

Additionally, the agent and the developer have different responsibilities. The agent gathers information and makes suggestions. The developer decides what to propose, and the reviewer evaluates the proposal.

## October 10

I started narrowing the project down to an MVP. I wanted to focus on the main workflow of having a platform to open and approve investigatios.

I initially organized the interface around two main areas.

- **Documentation Map:** Shows the existing documentation and helps users understand how it is organized.
- **Evolution Proposals:** Lets users create, edit, and review proposed documentation changes.

I also identified three main concepts.

- **Investigating Changes:** Examines code changes and gathers relevant information. This involves commits, documentation, evidence, users, and agents.
- **Restructuring Documentation:** Represents a proposed change to the documentation structure.
- **Reviewing Documentation:** Lets users comment on proposals, request changes, and approve them.

I wanted the concepts to represent different responsibilities rather than simply match individual pages.

At this point, I prioritized creating and editing proposals, submitting them for review, requesting revisions, and approving them. More advanced agent features and automatic pull request generation were lower priorities.

## October 11

I worked on the proposal states and how they change when users interact with a proposal.

I identified four states.

- **Draft:** The developer is still editing the proposal.
- **Pending Approval:** The proposal has been submitted for review.
- **Changes Requested:** The reviewer has requested revisions.
- **Approved:** The reviewer has approved the proposal.

I wanted each action to have a clear result. Submitting a proposal should change its status, and requesting changes should return it to an editable state.

I also decided that revisions should stay attached to the original proposal. The developer should not need to create a new proposal every time a reviewer requests changes.

Approval should eventually lead to the next step in the workflow. The original plan was for GitDocs to prepare the documentation changes and open a pull request after approval.

## October 13

I continued working on the boundaries between the three concepts.

Investigating Changes is about understanding what happened in the codebase. Relevant information could include code references, repository history, existing documentation, and related discussions.

Restructuring Documentation is about deciding how the documentation should change. This could involve splitting, merging, renaming, or reorganizing documents.

Reviewing Documentation is about evaluating the proposed changes. Reviewers should be able to understand the proposal, leave comments, request revisions, and approve it.

I also wanted developers to be able to ask the agent follow-up questions. The agent should help them understand the evidence instead of simply producing a recommendation that they have to accept or reject.

I kept investigation, proposal creation, and review separate because they serve different purposes. Developers need to understand where a suggestion came from and be able to change it when necessary.

## October 14

I worked on how the main workflow should appear in the interface.

I wanted users to be able to understand the existing documentation, investigate a change, create a proposal, and review it without having to navigate through unrelated features.

The Documentation Map and Evolution Proposals were my initial way of organizing these interactions.

I also wanted evidence and agent assistance to appear in the context of the investigation. Users should be able to inspect information and ask questions without losing track of what they are working on.

The review interface needed to make comments, requests for changes, and approval distinct from each other. These actions have different outcomes and should not look interchangeable.

## October 15

I continued narrowing the project scope.

I wanted the prototype to demonstrate the main workflow rather than contain many features that were only partially implemented.

The most important part of the idea was helping developers understand how code changes affect documentation and then giving them a way to propose and review changes.

I kept the agent's recommendations separate from the actual proposal. Developers should be able to inspect suggestions and decide what to include.

I also considered GitHub integration. The intended workflow was for an approved proposal to lead to documentation changes and a pull request. I still needed to decide how much of this process should be included in the MVP.

## October 16

I reviewed the concepts and user journey to check that they described the same application.

The three concepts were still Investigating Changes, Restructuring Documentation, and Reviewing Documentation. They represented gathering information, proposing changes, and reviewing those changes.

I also clarified the roles of the developer and reviewer. The developer investigates changes, creates proposals, and revises them. The reviewer comments, requests changes, or approves the proposal.

The main design principle was that GitDocs should help developers make informed decisions about documentation. The agent provides information and suggestions, but the developer remains responsible for the proposal.

I also realized that missing documentation was another problem worth addressing. Sometimes a code change requires a new document rather than a change to an existing one. Changes that span multiple commits could also be difficult to investigate. I decided to leave these cases for a possible beta version instead of expanding the current scope.

I made investigation submission an explicit action. The form should not save an investigation until the user clicks Submit.

I also decided that multiple investigations should be allowed for the same commit. Different developers might investigate the same change for different reasons.

I wanted the investigation page to show highlighted code as well. I left that for beta.

## October 17

I started making the MVP smaller and more concrete so I could implement it in manageable steps.

I decided to start with public GitHub repositories. Users would enter a repository using its owner and name. The application would read repository information through the GitHub API.

I did not want to require every user to configure a personal GitHub token. An optional server-side `GITHUB_TOKEN` could be used to increase the API rate limit. Support for private repositories and user OAuth would be deferred.

I also changed the plan for pull request creation. The MVP would save proposals and reviews inside GitDocs, but it would not automatically create pull requests in GitHub. Creating pull requests would require additional permissions and work to apply the proposed file changes correctly.

For the backend, I decided to use TypeScript and MongoDB. I wanted to build and test the application in small steps, starting with GitHub API integration before adding the other backend features.

At this point, I planned to work on repository integration, shared backend setup, authentication and sessions, proposal creation, and review actions. I wanted to verify each part before connecting the entire workflow.

## October 18

I continued changing the MVP based on the UI sketches and the work needed to make the main workflow usable.

I decided to include saved investigations in the MVP. The application needed a way to keep track of investigations instead of treating them as temporary pages.

I also changed how the repository and investigation pages should work.

The repository page would show the repository's commits and current documentation. The investigation page would show the code structure and documentation structure side by side. I did not want the investigation page to be just a page about one commit.

I planned the sidebar around four areas.

- **Repositories:** The main page for finding and opening repositories.
- **Investigations:** A place to view saved investigations.
- **Proposals:** A place to create and manage documentation restructuring proposals.
- **Reviews:** A place to review proposals and respond to feedback.

I also decided that repository routes should include both the owner and repository name. A repository name alone is not enough to identify a repository because different owners can have repositories with the same name.

For the documentation and code trees, I wanted folders to be easy to navigate. Files within a folder should appear before its subfolders. Indentation, guide lines, and carets should make the folder hierarchy clear.

I kept saved investigations in the MVP, but the more advanced investigation features were still out of scope. The MVP would not include the full agent investigation workflow, evidence collection, Copilot-style questions, or automatically identifying affected documentation.

There are many user interactions I want to fix in Beta, which includes the investigation and proposal front end and user flow. Additionally, there are so many moving parts and they seem redundant, which would be easier if I simplified some parts. In particular, I realized it isn't intuitive how investigations and proposals differ. It might be better to consolidate them into one, and just have the same page for investigating code (looking to see if there are any unconsistencies), as well as sending a proposal. 