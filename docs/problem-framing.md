# Problem Framing

### Domain

The domain of this project is **software maintenance and code-history investigation**, specifically helping developers understand how existing code evolved and why it has its current implementation. Software projects evolve continuously as developers add features, fix bugs, refactor code, and integrate changes. Developers use **Git**, a version control system, to work on changes independently. They typically create branches, make a series of commits, and eventually merge their work into the main codebase.

Maintaining this software requires developers to understand not only what the current code does, but sometimes why it exists in its current form. A developer may encounter an unusual dependency, an old workaround, or an implementation that seems unnecessarily complex and need to understand its history before safely changing it. Git records commits, branches, file changes, and diffs, while collaborative development platforms can connect changes to pull requests, reviews, issues, and discussions. Together, these artifacts contain information about both what changed and the context surrounding those changes.

However, the history of a piece of code is not necessarily a linear timeline. A developer investigating one piece of code may need to identify relevant changes across multiple commits and branches, then connect those changes to related pull requests, issues, or discussions. In a large codebase, many unrelated changes can make this difficult, while related work may be spread across different contributors and points in time. The developer must determine which pieces of the project's history are relevant and how they fit together.

This challenge becomes more pronounced as development becomes increasingly parallel. Large projects may have many contributors working simultaneously, and developers can now delegate programming tasks to AI coding agents, with each agent producing its own changes or branches. When several people or agents work on related parts of a codebase, understanding one piece of code may require distinguishing among multiple overlapping streams of work and determining how they contributed to the current implementation.

### Bad situations

1. Extracting changes from two AI coding agents

A developer asks two AI coding agents to work on the same application at the same time. Agent 1 works on the middleware on one branch, while Agent 2 works on a related feature on another branch. As they work, both agents make several commits, and some of their changes overlap with or depend on each other.

Later, the developer decides that they only want the middleware work from Agent 1 on a different branch. That branch already contains several commits of its own, and the two agents' branches have since diverged and been modified further.

The developer now has to figure out which commits from Agent 1 contain the middleware changes, which parts were affected by Agent 2's work, and which changes need to come along for the middleware to work correctly. Looking through the commits one at a time makes it difficult to understand how the changes connect across the two branches.

The developer can see the individual commits and diffs, but cannot easily see the overall structure of the work. They have to mentally piece together the branches and their relationships while deciding what to extract and apply to the other branch. This creates a risk of bringing along unrelated changes, leaving behind necessary changes, or introducing bugs during the transfer.

2. Onboarding to an unfamiliar codebase

A developer joins a project and is asked to fix a bug in a part of the codebase they have never worked on before. They can understand what the current code does, but do not know why certain implementation decisions were made.

They look through the code's history and find many commits from different developers. The diffs span from introducing the current behavior, refactoring different features, and fixing related bugs. The developer also finds relevant pull requests and issue discussions, but these pieces of information are spread across different parts of the development history.

The developer has to determine which changes are relevant to the code they are investigating and how those changes led to the current implementation. Without a clear overview of these relationships, they move between commits, branches, pull requests, and issues and mentally reconstruct the history.

Until they understand this context, they cannot confidently determine whether the code is behaving incorrectly or whether an unusual implementation is intentional. This makes what should be a relatively small debugging task take significantly longer.

Onboarding is slowed because in order for developers to thoroughly understand the codebase, they must reconstruct the history and reasoning behind unfamiliar code written by other developers.

3. Debugging a regression

A developer discovers that a feature that previously worked is now behaving incorrectly. Several changes have been made to the feature over the past few weeks by different developers, across multiple branches and pull requests.

The developer knows roughly when the problem started, but there are many potentially relevant changes. They inspect commits and diffs to narrow down what changed, then follow related branches and pull requests to understand how those changes fit together.

The problem is that the regression may not come from a single commit. Several changes may have interacted to produce the current behavior, making it difficult to determine which parts of the history are actually relevant.

The developer has to piece together the sequence and relationships between these changes before they can identify the likely cause. This turns what initially appears to be a small bug into time-consuming task, which increases the risk of reverting or modifying a change that was not actually responsible for the problem.

### Corroboration

Developers frequently rely on software history to understand existing code, but the information in that history is often difficult to interpret. Codoban et al. surveyed 217 developers and found that 66% identified non-informative commit messages as a challenge, making it the most commonly reported difficulty in examining committed changes. The study also found that 47% experienced information overload from the volume of commits. Developers reported difficulty locating relevant changes and understanding the intent behind them, particularly when they had to examine many commits and diffs.

The study also found that developers were not interested in seeing every change. They wanted to identify changes relevant to their current work, including changes that might overlap with or affect what they were working on. One participant described inspecting recent commits to determine whether any were related to their current changes. These findings suggest that the problem is not a lack of development history, but the difficulty of identifying and understanding the parts of that history that explain the code being investigated.

Recent developer discussions suggest that these difficulties persist. In a Reddit discussion about Git pain points, developers described difficulty finding the commit that introduced a particular piece of code, understanding which branches or worktrees were related, and following changes across stacked branches. One developer described searching through the entire history for the commit that introduced or deleted a small piece of code as painfully slow. Although these responses are anecdotal and do not establish how common these problems are, they provide contemporary examples of developers struggling to connect specific code to its history.

#### Sources

R/Webdev on Reddit: What’s Your #1 Git Pain Point That You’ve Just... Accepted?, www.reddit.com/r/webdev/comments/1ox3b1f/whats_your_1_git_pain_point_that_youve_just/. Accessed 15 Sept. 2026. 
Software History under the Lens: A Study on Why and How Developers Examine It, dig.cs.illinois.edu/papers/codoban-icsme15.pdf. Accessed 15 Sept. 2026. 

### Workarounds and Comparables

#### Git history and command-line investigation

Developers can investigate code history directly using Git commands. These provide detailed information about when code changed (`git log`), who changed it (`git blame`), and what a commit modified (`git show`). The limitation is not a lack of information with the commits. Developers still need to decide which commits to inspect and manually connect changes across branches and files. This works well for targeted questions but can become tedious when the relevant history spans many changes.

#### Pull requests, issues, and discussions

Developers can search pull requests, issues, reviews, and comments to recover the motivation behind changes. These artifacts can provide context that is not apparent from a diff or commit message. However, this information is organized around individual development artifacts. A developer investigating a piece of code may need to move between multiple components, such as code, commits, related pull requests, and associated issues to reconstruct how they fit together.

#### Asking other developers

A developer can ask a teammate who worked on the relevant code or read any comments written on it. This can be faster than searching through historical records when the right person is available and remembers the decision. However, this approach depends on personal knowledge and availability. It is less useful when the original contributor is unavailable or when the relevant work happened long ago.

#### Sourcegraph

Sourcegraph is a major comparable because it already combines code navigation, search, history, and AI-assisted investigation. Developers can view file histories, inspect commit diffs, search changes across branches, and navigate references within unfamiliar code. Its Deep Search feature also uses AI to investigate codebases and synthesize answers. This means the proposed project should not claim to be the first tool to connect developers with code history. Instead, its narrower design question is whether an explicitly visual representation of the relationships among historical changes can provide a useful investigation experience that differs from different search and document-oriented workflows.

#### GitHub Copilot

GitHub Copilot can summarize pull requests, explain changes, analyze commits and reviews, and answer questions about work performed by coding agents.This makes conversational AI another important comparable. However, a conversational answer primarily gives the developer an interpretation. The proposed interface would make the underlying relationships themselves the primary object of interaction, allowing the developer to visually explore the changes and inspect the evidence supporting an explanation.

#### GitKraken

GitKraken provides a visual representation of commits, branches, merges, and diffs, making Git history easier to navigate. However, its visualization is centered on the repository's Git history. This project instead centers on a specific piece of code and visually connects its relevant commits, branches, pull requests, issues, and later changes. The goal is to help developers understand how a particular piece of code evolved and what explains its current state.

#### Opportunity

The existing workarounds demonstrate that the problem is partially addressed rather than completely unsolved. The opportunity is to investigate whether a code-centered visual map can reduce the effort required to organize and understand the historical relationships that developers currently reconstruct across Git, code review, issue tracking, and AI tools.

### Solution sketch

We propose a web application that provides an interactive visual representation of a software project's development history.

The application represents commits as nodes, showing how changes developed across branches and any dependencies on previous commitments. Developers can select a commit to inspect its code changes, associated files, pull requests, issues, and contributors. They can also select a specific piece of code, such as a function, to trace how it evolved, including who introduced it, which commits modified it, and what related work surrounded those changes.

There is also a copilot assistant integrated into the experience. Developers can ask questions about any selected commit or piece of code, such as why a change was made, how it relates to other changes, or why a particular implementation exists. The AI uses the surrounding development history to provide explanations grounded in the available evidence.

The goal is to give developers a visual overview of how a project evolved while allowing them to drill down into specific code and use AI to understand the people, changes, and context behind it.